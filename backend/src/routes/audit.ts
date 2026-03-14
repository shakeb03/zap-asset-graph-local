import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/audit — filterable audit log timeline
router.get('/', async (req: Request, res: Response) => {
  try {
    const { assetId, action, actor, limit, offset } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (assetId) where.assetId = assetId;
    if (action) where.action = action;
    if (actor) where.actor = actor;

    const take = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    const skip = offset ? Math.max(0, parseInt(offset, 10) || 0) : 0;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { asset: { select: { id: true, name: true, type: true } } },
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      meta: { total, limit: take, offset: skip },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
