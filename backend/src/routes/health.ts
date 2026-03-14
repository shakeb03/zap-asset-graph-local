import { Router, Request, Response } from 'express';
import { AssetStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/health/report — governance health scan
router.get('/report', async (_req: Request, res: Response) => {
  try {
    const [
      allAssets,
      orphaned,
      errorOrPaused,
      dependencyRows,
      workspaceCounts,
    ] = await Promise.all([
      prisma.asset.findMany({ select: { id: true } }),
      prisma.asset.findMany({
        where: { owner: null },
        select: { id: true, name: true, type: true, workspace: true },
      }),
      prisma.asset.findMany({
        where: { status: { in: [AssetStatus.paused, AssetStatus.disabled] } },
        select: { id: true, name: true, status: true, workspace: true },
      }),
      prisma.dependency.findMany({
        select: { dependentId: true, dependencyId: true },
      }),
      prisma.asset.groupBy({
        by: ['workspace'],
        _count: true,
      }),
    ]);

    const assetIds = new Set(allAssets.map((a) => a.id));
    const adj = new Map<string, string[]>();
    for (const d of dependencyRows) {
      if (!adj.has(d.dependentId)) adj.set(d.dependentId, []);
      adj.get(d.dependentId)!.push(d.dependencyId);
    }

    // DFS cycle detection (directed graph): find first cycle if any
    const cycles: string[][] = [];
    const recStack = new Set<string>();
    const path: string[] = [];
    const pathIndex = new Map<string, number>();

    const dfs = (v: string): boolean => {
      recStack.add(v);
      const idx = path.length;
      pathIndex.set(v, idx);
      path.push(v);

      for (const w of adj.get(v) ?? []) {
        if (!pathIndex.has(w)) {
          if (dfs(w)) return true;
        } else if (recStack.has(w)) {
          const start = pathIndex.get(w)!;
          cycles.push(path.slice(start).concat(w));
          return true;
        }
      }
      path.pop();
      pathIndex.delete(v);
      recStack.delete(v);
      return false;
    };
    for (const id of assetIds) {
      if (!pathIndex.has(id) && dfs(id)) break;
    }
    const uniqueCycles = cycles;

    // Single points of failure: assets with 3+ dependents
    const dependentsCount = new Map<string, number>();
    for (const d of dependencyRows) {
      dependentsCount.set(d.dependencyId, (dependentsCount.get(d.dependencyId) ?? 0) + 1);
    }
    const singlePointsOfFailure = allAssets.filter(
      (a) => (dependentsCount.get(a.id) ?? 0) >= 3
    );
    const spofDetails = await prisma.asset.findMany({
      where: { id: { in: singlePointsOfFailure.map((a) => a.id) } },
      select: { id: true, name: true, type: true, workspace: true },
    });
    const dependentCounts = spofDetails.map((a) => ({
      ...a,
      dependentCount: dependentsCount.get(a.id) ?? 0,
    }));

    const perWorkspace = workspaceCounts.map((w) => ({
      workspace: w.workspace,
      assetCount: w._count,
    }));

    // Health score 0-100: deduct for issues
    let score = 100;
    const deductions: string[] = [];
    if (orphaned.length > 0) {
      const d = Math.min(20, orphaned.length * 5);
      score -= d;
      deductions.push(`${orphaned.length} orphaned asset(s)`);
    }
    if (errorOrPaused.length > 0) {
      const d = Math.min(25, errorOrPaused.length * 3);
      score -= d;
      deductions.push(`${errorOrPaused.length} paused/disabled asset(s)`);
    }
    if (uniqueCycles.length > 0) {
      score -= 25;
      deductions.push('Circular dependencies detected');
    }
    if (dependentCounts.length > 0) {
      const d = Math.min(15, dependentCounts.length * 5);
      score -= d;
      deductions.push(`${dependentCounts.length} single point(s) of failure`);
    }
    score = Math.max(0, Math.min(100, score));

    res.json({
      orphaned: {
        count: orphaned.length,
        assets: orphaned,
      },
      errorOrPaused: {
        count: errorOrPaused.length,
        assets: errorOrPaused,
      },
      circularDependencies: {
        detected: uniqueCycles.length > 0,
        cycles: uniqueCycles,
      },
      singlePointsOfFailure: {
        count: dependentCounts.length,
        assets: dependentCounts,
      },
      perWorkspace: perWorkspace,
      healthScore: score,
      deductions: deductions.length ? deductions : ['No issues'],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate health report' });
  }
});

export default router;
