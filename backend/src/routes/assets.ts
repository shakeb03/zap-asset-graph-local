import { Router, Request, Response } from 'express';
import { AssetType, AssetStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/assets — list with filters, include dependencies, stats
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, workspace, status, search } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (type && (type === 'zap' || type === 'connection')) where.type = type;
    if (workspace) where.workspace = workspace;
    if (status && (status === 'active' || status === 'paused' || status === 'disabled')) {
      where.status = status;
    }
    if (search && search.trim()) {
      where.name = { contains: search.trim() };
    }

    const [assets, countByType, countByStatus] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          dependenciesAsDependent: {
            include: { dependency: true },
          },
          dependenciesAsDependency: {
            include: { dependent: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.asset.groupBy({
        by: ['type'],
        _count: true,
      }),
      prisma.asset.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const stats = {
      byType: Object.fromEntries(countByType.map((g) => [g.type, g._count])),
      byStatus: Object.fromEntries(countByStatus.map((g) => [g.status, g._count])),
      total: assets.length,
    };

    res.json({
      data: assets,
      stats,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list assets' });
  }
});

// GET /api/assets/:id — single asset with dependencies and recent audit logs
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: {
        dependenciesAsDependent: { include: { dependency: true } },
        dependenciesAsDependency: { include: { dependent: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 20 },
      },
    });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// GET /api/assets/:id/blast-radius — BFS downstream impact
router.get('/:id/blast-radius', async (req: Request, res: Response) => {
  try {
    const root = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!root) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const visited = new Set<string>([root.id]);
    const queue: string[] = [root.id];
    const impactEdges: { from: string; to: string; relationshipType: string }[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const dependents = await prisma.dependency.findMany({
        where: { dependencyId: currentId },
        include: { dependent: true },
      });
      for (const d of dependents) {
        impactEdges.push({
          from: d.dependentId,
          to: d.dependencyId,
          relationshipType: d.relationshipType,
        });
        if (!visited.has(d.dependentId)) {
          visited.add(d.dependentId);
          queue.push(d.dependentId);
        }
      }
    }

    const impactedIds = [...visited].filter((id) => id !== root.id);
    const impactedAssets = await prisma.asset.findMany({
      where: { id: { in: impactedIds } },
    });

    const total = impactedAssets.length;
    let severity: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (total >= 10) severity = 'high';
    else if (total >= 3) severity = 'medium';
    else if (total >= 1) severity = 'low';

    const message =
      total === 0
        ? `Removing "${root.name}" would not impact any downstream assets.`
        : `Removing "${root.name}" would impact ${total} downstream asset(s).`;

    res.json({
      root: root,
      impactedAssets,
      impactEdges,
      totalImpacted: total,
      severity,
      message,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to compute blast radius' });
  }
});

// POST /api/assets/:id/transfer — transfer ownership
router.post('/:id/transfer', async (req: Request, res: Response) => {
  try {
    const { newOwner, actor } = req.body as { newOwner?: string; actor?: string };
    if (typeof newOwner !== 'string' || typeof actor !== 'string') {
      return res.status(400).json({ error: 'Body must include newOwner and actor (strings)' });
    }

    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const previousOwner = asset.owner ?? null;
    const updated = await prisma.asset.update({
      where: { id: req.params.id },
      data: { owner: newOwner || null },
    });

    await prisma.auditLog.create({
      data: {
        assetId: asset.id,
        action: 'ownership_transferred',
        actor,
        details: JSON.stringify({ previousOwner, newOwner: newOwner || null }),
      },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

export default router;
