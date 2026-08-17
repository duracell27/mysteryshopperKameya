import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Trainee } from '../models/Trainee';
import { DayPlan } from '../models/DayPlan';
import { User } from '../models/User';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/trainees/me — профіль поточного стажера
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const trainee = await Trainee.findOne({ user: req.user!.userId }).populate('user', '-password');
    if (!trainee) return res.status(404).json({ message: 'Профіль стажера не знайдено' });
    const dayPlans = await DayPlan.find().sort({ day: 1 });
    const user = trainee.user as any;
    res.json({ trainee: trainee.toPublic({ name: user.name, position: user.position }, dayPlans) });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// PATCH /api/trainees/me/tasks/:taskId — відмітити/зняти задачу
router.patch('/me/tasks/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const trainee = await Trainee.findOne({ user: req.user!.userId }).populate('user', '-password');
    if (!trainee) return res.status(404).json({ message: 'Профіль стажера не знайдено' });
    const dayPlans = await DayPlan.find().sort({ day: 1 });

    let targetDay: number | null = null;
    for (const plan of dayPlans) {
      if (plan.tasks.id(req.params.taskId)) { targetDay = plan.day; break; }
    }
    if (!targetDay) return res.status(404).json({ message: 'Завдання не знайдено' });

    let td = trainee.days.find((d) => d.day === targetDay);
    if (!td) {
      trainee.days.push({ day: targetDay!, completedTaskIds: [] } as any);
      td = trainee.days[trainee.days.length - 1];
    }
    const taskObjId = new mongoose.Types.ObjectId(req.params.taskId);
    const idx = td.completedTaskIds.findIndex((id) => id.toString() === req.params.taskId);
    if (idx === -1) td.completedTaskIds.push(taskObjId);
    else td.completedTaskIds.splice(idx, 1);

    await trainee.save();
    const user = trainee.user as any;
    res.json({ trainee: trainee.toPublic({ name: user.name, position: user.position }, dayPlans) });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// PUT /api/trainees/me/days/:day/reflection — зберегти рефлексію
router.put('/me/days/:day/reflection', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const dayNum = Number(req.params.day);
    const trainee = await Trainee.findOne({ user: req.user!.userId }).populate('user', '-password');
    if (!trainee) return res.status(404).json({ message: 'Профіль стажера не знайдено' });
    const dayPlans = await DayPlan.find().sort({ day: 1 });

    const td = trainee.days.find((d) => d.day === dayNum);
    const reflData = { ...req.body, submittedAt: new Date() };
    if (!td) {
      trainee.days.push({ day: dayNum, completedTaskIds: [], reflection: reflData } as any);
    } else {
      td.reflection = reflData;
    }
    await trainee.save();
    const user = trainee.user as any;
    res.json({ trainee: trainee.toPublic({ name: user.name, position: user.position }, dayPlans) });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// GET /api/trainees — всі стажери (admin)
router.get('/', authMiddleware, adminOnly, async (_req, res: Response) => {
  try {
    const trainees = await Trainee.find().populate('user', '-password');
    const dayPlans = await DayPlan.find().sort({ day: 1 });
    const valid = trainees.filter((t) => t.user != null);
    res.json({
      trainees: valid.map((t) => {
        const u = t.user as any;
        return t.toPublic({ name: u.name, position: u.position }, dayPlans);
      }),
    });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// POST /api/trainees/:userId — створити профіль стажера (admin)
router.post('/:userId', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    const exists = await Trainee.findOne({ user: user._id });
    if (exists) return res.status(409).json({ message: 'Профіль вже існує' });
    const dayPlans = await DayPlan.find().sort({ day: 1 });
    const trainee = await Trainee.create({
      user: user._id,
      startDate: req.body.startDate || new Date(),
      days: [],
    });
    res.status(201).json({ trainee: trainee.toPublic({ name: user.name, position: user.position }, dayPlans) });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// PATCH /api/trainees/:id — оновити startDate (admin)
router.patch('/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const trainee = await Trainee.findById(req.params.id).populate('user', '-password');
    if (!trainee) return res.status(404).json({ message: 'Стажера не знайдено' });
    if (req.body.startDate !== undefined) trainee.startDate = req.body.startDate;
    await trainee.save();
    const dayPlans = await DayPlan.find().sort({ day: 1 });
    const u = trainee.user as any;
    res.json({ trainee: trainee.toPublic({ name: u.name, position: u.position }, dayPlans) });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

// DELETE /api/trainees/:id — видалити профіль стажера (admin)
router.delete('/:id', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const trainee = await Trainee.findByIdAndDelete(_req.params.id);
    if (!trainee) return res.status(404).json({ message: 'Стажера не знайдено' });
    res.json({ message: 'Видалено' });
  } catch { res.status(500).json({ message: 'Помилка сервера' }); }
});

export default router;
