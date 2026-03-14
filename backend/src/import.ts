import { PrismaClient, AssetType, AssetStatus, DependencyRelationshipType } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type ZapStep = { app: string; event: string; role: string };
type Zap = {
  id: string;
  title: string;
  is_enabled: boolean;
  folder: string;
  links: { html_editor: string };
  steps: ZapStep[];
};
type Connection = { id: string; app: string; status: string };
type ExportData = { zaps: Zap[]; connections: Connection[] };

const IMPORT_ACTOR = 'import';

function loadExport(): ExportData {
  const path = join(__dirname, '..', 'data', 'zapier-export.json');
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as ExportData;
}

function connectionStatus(status: string): AssetStatus {
  if (status === 'active') return AssetStatus.active;
  if (status === 'paused') return AssetStatus.paused;
  return AssetStatus.disabled;
}

function zapStatus(isEnabled: boolean): AssetStatus {
  return isEnabled ? AssetStatus.active : AssetStatus.paused;
}

function getTriggerApp(steps: ZapStep[]): string | null {
  const trigger = steps.find((s) => s.role === 'trigger');
  return trigger ? trigger.app : null;
}

function getActionApps(steps: ZapStep[]): string[] {
  return steps.filter((s) => s.role === 'action').map((s) => s.app);
}

async function main() {
  const data = loadExport();

  // 0. Clear existing data so re-running import doesn't create duplicates (full replace)
  await prisma.dependency.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.asset.deleteMany();

  // 1. Create connection assets first (app name -> asset id)
  const connectionAssetIdsByApp = new Map<string, string>();
  for (const conn of data.connections) {
    const asset = await prisma.asset.create({
      data: {
        name: conn.app,
        type: AssetType.connection,
        status: connectionStatus(conn.status),
        workspace: 'Default',
        triggerApp: null,
        actionApps: null,
      },
    });
    connectionAssetIdsByApp.set(conn.app, asset.id);
    await prisma.auditLog.create({
      data: {
        assetId: asset.id,
        action: 'created',
        actor: IMPORT_ACTOR,
        details: JSON.stringify({ source: 'zapier-export', connectionId: conn.id }),
      },
    });
  }

  // 2. Create zap assets
  const zapAssetIdsByZapId = new Map<string, string>();
  for (const zap of data.zaps) {
    const actionApps = getActionApps(zap.steps);
    const asset = await prisma.asset.create({
      data: {
        name: zap.title,
        type: AssetType.zap,
        status: zapStatus(zap.is_enabled),
        workspace: zap.folder,
        zapierZapId: zap.id,
        zapierEditUrl: zap.links?.html_editor ?? null,
        triggerApp: getTriggerApp(zap.steps),
        actionApps: actionApps.length > 0 ? JSON.stringify(actionApps) : null,
      },
    });
    zapAssetIdsByZapId.set(zap.id, asset.id);
    await prisma.auditLog.create({
      data: {
        assetId: asset.id,
        action: 'created',
        actor: IMPORT_ACTOR,
        details: JSON.stringify({ source: 'zapier-export', zapId: zap.id }),
      },
    });
  }

  // 3. Create dependencies: each zap depends on every connection (app) it uses in steps
  for (const zap of data.zaps) {
    const zapAssetId = zapAssetIdsByZapId.get(zap.id);
    if (!zapAssetId) continue;

    const appsUsed = new Set<string>();
    for (const step of zap.steps) {
      appsUsed.add(step.app);
    }

    for (const appName of appsUsed) {
      const connectionAssetId = connectionAssetIdsByApp.get(appName);
      if (!connectionAssetId) continue;

      await prisma.dependency.upsert({
        where: {
          dependentId_dependencyId_relationshipType: {
            dependentId: zapAssetId,
            dependencyId: connectionAssetId,
            relationshipType: DependencyRelationshipType.uses,
          },
        },
        create: {
          dependentId: zapAssetId,
          dependencyId: connectionAssetId,
          relationshipType: DependencyRelationshipType.uses,
        },
        update: {},
      });
    }
  }

  console.log(`Imported ${data.connections.length} connections, ${data.zaps.length} zaps, and created dependencies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
