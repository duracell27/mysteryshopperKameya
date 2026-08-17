import { Router, Response } from 'express';
import { DayPlan } from '../models/DayPlan';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/dayplans — всі плани (auth)
router.get('/', authMiddleware, async (_req, res: Response) => {
  try {
    const plans = await DayPlan.find().sort({ day: 1 });
    res.json({ dayPlans: plans });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// POST /api/dayplans — створити день (admin)
router.post('/', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const dayNum = Number(req.body.day);
    if (!dayNum) return res.status(400).json({ message: 'Вкажіть номер дня' });
    const exists = await DayPlan.findOne({ day: dayNum });
    if (exists) return res.status(409).json({ message: 'Цей день вже існує' });
    const plan = await DayPlan.create({ day: dayNum, isHoliday: !!req.body.isHoliday, tasks: [] });
    res.status(201).json({ dayPlan: plan });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// DELETE /api/dayplans/:day — видалити день (admin)
router.delete('/:day', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await DayPlan.findOneAndDelete({ day: Number(req.params.day) });
    if (!plan) return res.status(404).json({ message: 'День не знайдено' });
    res.json({ message: 'Видалено' });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// POST /api/dayplans/:day/tasks — додати задачу (admin)
router.post('/:day/tasks', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await DayPlan.findOne({ day: Number(req.params.day) });
    if (!plan) return res.status(404).json({ message: 'День не знайдено' });
    const { title, description, type } = req.body;
    if (!title) return res.status(400).json({ message: 'Вкажіть заголовок' });
    plan.tasks.push({ title, description: description || '', type: type || 'other' } as any);
    await plan.save();
    res.status(201).json({ dayPlan: plan });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// PATCH /api/dayplans/:day/tasks/:taskId — оновити задачу (admin)
router.patch('/:day/tasks/:taskId', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await DayPlan.findOne({ day: Number(req.params.day) });
    if (!plan) return res.status(404).json({ message: 'День не знайдено' });
    const task = plan.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Завдання не знайдено' });
    if (req.body.title !== undefined)       task.title       = req.body.title;
    if (req.body.description !== undefined) task.description = req.body.description;
    if (req.body.type !== undefined)        task.type        = req.body.type;
    await plan.save();
    res.json({ dayPlan: plan });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// PATCH /api/dayplans/:day/holiday — перемикач вихідного (admin)
router.patch('/:day/holiday', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await DayPlan.findOne({ day: Number(req.params.day) });
    if (!plan) return res.status(404).json({ message: 'День не знайдено' });
    plan.isHoliday = !!req.body.isHoliday;
    await plan.save();
    res.json({ dayPlan: plan });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// DELETE /api/dayplans/:day/tasks/:taskId — видалити задачу (admin)
router.delete('/:day/tasks/:taskId', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await DayPlan.findOne({ day: Number(req.params.day) });
    if (!plan) return res.status(404).json({ message: 'День не знайдено' });
    const task = plan.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Завдання не знайдено' });
    task.deleteOne();
    await plan.save();
    res.json({ dayPlan: plan });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

export default router;
