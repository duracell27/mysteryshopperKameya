import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { SystemLog } from '../models/SystemLog';

const router = Router();
router.use(authMiddleware);

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ message: 'Доступ заборонено' });
    return false;
  }
  return true;
}

// Specific routes before wildcard routes to avoid Express matching collisions

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await Notification.countDocuments({ isRead: false });
    return res.json({ count });
  } catch (error) {
    console.error('notifications unread-count error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/system/unread-count', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await SystemLog.countDocuments({ isRead: false });
    return res.json({ count });
  } catch (error) {
    console.error('system unread-count error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/system', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const logs = await SystemLog.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json(logs);
  } catch (error) {
    console.error('system logs error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.patch('/system/read-all', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await SystemLog.updateMany({ isRead: false }, { isRead: true });
    return res.json({ updated: result.modifiedCount });
  } catch (error) {
    console.error('system read-all error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.patch('/system/:id/read', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const log = await SystemLog.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!log) return res.status(404).json({ message: 'Лог не знайдено' });
    return res.json(log);
  } catch (error) {
    console.error('mark system read error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json(notifications);
  } catch (error) {
    console.error('notifications list error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Сповіщення не знайдено' });
    return res.json(notification);
  } catch (error) {
    console.error('mark read error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
