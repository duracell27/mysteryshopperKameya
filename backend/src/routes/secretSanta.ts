import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { SecretSantaEntry } from '../models/SecretSantaEntry';

const router = Router();
router.use(authMiddleware);

// GET /api/secret-santa/my — повертає запис поточного користувача з отримувачем
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await SecretSantaEntry
      .findOne({ userId: new mongoose.Types.ObjectId(req.user!.userId) })
      .populate('recipientId');

    if (!entry) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    return res.json({ entry: entry.toObject() });
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/secret-santa/all — тільки для адміна
router.get('/all', async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const entries = await SecretSantaEntry
      .find()
      .populate('recipientId');

    return res.json({ entries: entries.map(e => e.toObject()) });
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
