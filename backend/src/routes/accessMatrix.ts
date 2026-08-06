import { Router, Request, Response } from 'express';
import { AccessMatrix, DEFAULT_RULES, DEFAULT_LEARNING_RULES } from '../models/AccessMatrix';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/access-matrix — public
router.get('/', async (_req: Request, res: Response) => {
  try {
    const matrix = await AccessMatrix.findOne().lean();
    return res.json({
      rules:         matrix?.rules         ?? DEFAULT_RULES,
      learningRules: matrix?.learningRules ?? DEFAULT_LEARNING_RULES,
    });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PUT /api/access-matrix — admin only
// Accepts { rules? } and/or { learningRules? } — updates only the provided fields
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  const body = req.body as { rules?: unknown; learningRules?: unknown };
  const update: Record<string, unknown> = {};

  if (body.rules !== undefined) {
    if (!Array.isArray(body.rules) || body.rules.length === 0) {
      return res.status(400).json({ message: 'rules має бути непорожнім масивом' });
    }
    update.rules = body.rules;
  }
  if (body.learningRules !== undefined) {
    if (!Array.isArray(body.learningRules) || body.learningRules.length === 0) {
      return res.status(400).json({ message: 'learningRules має бути непорожнім масивом' });
    }
    update.learningRules = body.learningRules;
  }
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: 'Потрібно передати rules або learningRules' });
  }

  try {
    const matrix = await AccessMatrix.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    ).lean();
    return res.json({
      rules:         matrix!.rules,
      learningRules: matrix!.learningRules ?? [],
    });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
