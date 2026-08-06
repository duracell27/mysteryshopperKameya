import { Router, Request, Response } from 'express';
import { AccessMatrix, DEFAULT_RULES } from '../models/AccessMatrix';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/access-matrix — public
router.get('/', async (_req: Request, res: Response) => {
  try {
    const matrix = await AccessMatrix.findOne().lean();
    return res.json({ rules: matrix?.rules ?? DEFAULT_RULES });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PUT /api/access-matrix — admin only
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  const { rules } = req.body as { rules: unknown };
  if (!Array.isArray(rules) || rules.length === 0) {
    return res.status(400).json({ message: 'rules має бути непорожнім масивом' });
  }
  try {
    const matrix = await AccessMatrix.findOneAndUpdate(
      {},
      { rules },
      { new: true, upsert: true }
    ).lean();
    return res.json({ rules: matrix!.rules });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
