# Onboarding 14-day Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести функціонал 14-денного онбордингу з `internshipKameya` в `mysteryshopperKameya` — стажер бачить свій прогрес, адмін керує планами і рефлексіями.

**Architecture:** TypeScript-бекенд отримує дві нові Mongoose-моделі (`DayPlan`, `Trainee`) і три нові роути. React-фронтенд замінює заглушку `OnboardingView` на повноцінний UI та додає нову адмін-вкладку.

**Tech Stack:** Node/Express/TypeScript, Mongoose, React/TypeScript, Tailwind, Anthropic SDK (вже встановлений).

**Spec:** `docs/superpowers/specs/2026-08-17-onboarding-14-integration-design.md`

## Global Constraints

- Backend — TypeScript strict mode, шлях: `backend/src/`
- Frontend — React + TypeScript, шлях: `frontend/src/`
- Стилі — тільки `kameya-burgundy` як акцентний колір (не додавати нових кольорів)
- `apiFetch` з `frontend/src/services/apiFetch.ts` — єдина точка HTTP-запитів на фронті
- Не дублювати управління юзерами — є `UsersView`
- Не додавати EventsLog — є SystemLog

---

## File Map

**Нові файли:**
- `backend/src/models/DayPlan.ts`
- `backend/src/models/Trainee.ts`
- `backend/src/routes/dayplan.ts`
- `backend/src/routes/trainee.ts`
- `backend/src/routes/onboardingAi.ts`
- `frontend/src/services/onboardingService.ts`
- `frontend/src/components/onboarding/DayCard.tsx`
- `frontend/src/components/onboarding/TaskItem.tsx`
- `frontend/src/components/onboarding/ReflectionForm.tsx`
- `frontend/src/components/admin/AdminOnboardingView.tsx`

**Змінені файли:**
- `backend/src/middleware/auth.ts` — додати `adminOnly`
- `backend/src/index.ts` — реєстрація 3 роутів
- `frontend/src/types.ts` — додати 5 інтерфейсів + `Screen.ADMIN_ONBOARDING`
- `frontend/src/components/onboarding/OnboardingView.tsx` — замінити заглушку
- `frontend/src/App.tsx` — додати case `ADMIN_ONBOARDING`
- `frontend/src/components/Layout.tsx` — додати пункт в `ADMIN_NAV`

---

## Task 1: adminOnly middleware + DayPlan model + Trainee model

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Create: `backend/src/models/DayPlan.ts`
- Create: `backend/src/models/Trainee.ts`

**Interfaces:**
- Produces: `adminOnly` middleware, `DayPlan` model, `Trainee` model з методом `toPublic`

- [ ] **Step 1: Додати `adminOnly` до auth.ts**

Відкрити `backend/src/middleware/auth.ts`. Після наявного `authMiddleware` додати:

```typescript
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: 'Доступ заборонено' });
    return;
  }
  next();
};
```

- [ ] **Step 2: Створити `backend/src/models/DayPlan.ts`**

```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITask {
  _id: Types.ObjectId;
  title: string;
  description: string;
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other';
}

export interface IDayPlan extends Document {
  day: number;
  isHoliday: boolean;
  tasks: Types.DocumentArray<ITask & Document>;
}

const taskSchema = new Schema<ITask>({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['theory', 'practice', 'meeting', 'observation', 'other'],
    default: 'other',
  },
});

const dayPlanSchema = new Schema<IDayPlan>({
  day:       { type: Number, required: true, unique: true },
  isHoliday: { type: Boolean, default: false },
  tasks:     [taskSchema],
});

export const DayPlan = mongoose.model<IDayPlan>('DayPlan', dayPlanSchema);
```

- [ ] **Step 3: Створити `backend/src/models/Trainee.ts`**

```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReflection {
  q1: number; q2: number; q3: number;
  q4: string; q5: number;
  comments: string;
  submittedAt: Date;
}

export interface ITraineeDay {
  day: number;
  completedTaskIds: Types.ObjectId[];
  reflection?: IReflection;
}

export interface IAiReport {
  _id: Types.ObjectId;
  analysis: string;
  daysCount: number;
  createdAt: Date;
}

interface DayPlanForPublic {
  day: number;
  isHoliday: boolean;
  tasks: { _id: Types.ObjectId; title: string; description: string; type: string }[];
}

interface PopulatedUser { name: string; position: string; }

export interface ITrainee extends Document {
  user: Types.ObjectId;
  startDate: Date;
  days: ITraineeDay[];
  aiReports: IAiReport[];
  toPublic(user: PopulatedUser, dayPlans: DayPlanForPublic[]): object;
}

const reflectionSchema = new Schema<IReflection>(
  { q1: Number, q2: Number, q3: Number, q4: String, q5: Number, comments: String, submittedAt: Date },
  { _id: false },
);

const traineeDaySchema = new Schema<ITraineeDay>({
  day:              { type: Number, required: true },
  completedTaskIds: [{ type: Schema.Types.ObjectId }],
  reflection:       reflectionSchema,
});

const aiReportSchema = new Schema<IAiReport>({
  analysis:  { type: String, required: true },
  daysCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const traineeSchema = new Schema<ITrainee>(
  {
    user:      { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    startDate: { type: Date, default: Date.now },
    days:      [traineeDaySchema],
    aiReports: [aiReportSchema],
  },
  { timestamps: true },
);

traineeSchema.methods.toPublic = function (
  populatedUser: PopulatedUser,
  dayPlans: DayPlanForPublic[],
): object {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(this.startDate); start.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);

  if (elapsed < 0) {
    return {
      id: this._id.toString(), name: populatedUser.name, position: populatedUser.position,
      startDate: this.startDate, currentDay: null, isCompleted: false, days: [], aiReports: [],
    };
  }

  const DURATION = 14;
  const totalDays = dayPlans.length > 0
    ? Math.max(Math.max(...dayPlans.map((p) => p.day)), DURATION)
    : DURATION;

  const isCompleted = elapsed >= totalDays;
  const currentDay  = isCompleted ? totalDays : elapsed + 1;
  const endDate     = new Date(start);
  endDate.setDate(endDate.getDate() + totalDays - 1);

  return {
    id: this._id.toString(),
    name: populatedUser.name,
    position: populatedUser.position,
    startDate: this.startDate,
    endDate: endDate.toISOString(),
    currentDay,
    isCompleted,
    aiReports: (this.aiReports ?? [])
      .map((r: IAiReport) => ({
        id: r._id.toString(), analysis: r.analysis,
        daysCount: r.daysCount, createdAt: r.createdAt,
      }))
      .sort((a: { createdAt: Date }, b: { createdAt: Date }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    days: dayPlans.sort((a, b) => a.day - b.day).map((plan) => {
      const isPreview = !isCompleted && plan.day > currentDay;
      const td = this.days.find((d: ITraineeDay) => d.day === plan.day);
      const completedIds = (td?.completedTaskIds ?? []).map((id: Types.ObjectId) => id.toString());
      return {
        day: plan.day, isHoliday: plan.isHoliday, isPreview,
        tasks: plan.tasks.map((t) => ({
          id: t._id.toString(), title: t.title,
          description: t.description || '', type: t.type,
          completed: completedIds.includes(t._id.toString()),
        })),
        reflection: !isPreview && td?.reflection
          ? { q1: td.reflection.q1, q2: td.reflection.q2, q3: td.reflection.q3,
              q4: td.reflection.q4, q5: td.reflection.q5,
              comments: td.reflection.comments, submittedAt: td.reflection.submittedAt }
          : undefined,
      };
    }),
  };
};

export const Trainee = mongoose.model<ITrainee>('Trainee', traineeSchema);
```

- [ ] **Step 4: Перевірити компіляцію**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Очікується: без помилок.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/models/DayPlan.ts backend/src/models/Trainee.ts
git commit -m "feat: add adminOnly middleware, DayPlan and Trainee models"
```

---

## Task 2: dayplan routes

**Files:**
- Create: `backend/src/routes/dayplan.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `DayPlan` model, `authMiddleware`, `adminOnly`, `AuthRequest`
- Produces: REST endpoints `/api/dayplans`

- [ ] **Step 1: Створити `backend/src/routes/dayplan.ts`**

```typescript
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
```

- [ ] **Step 2: Зареєструвати роут у `backend/src/index.ts`**

Знайти блок `import ... from './routes/...'` і додати:
```typescript
import dayplanRoutes from './routes/dayplan';
```
Знайти блок `app.use('/api/...', ...)` і додати після наявних роутів:
```typescript
app.use('/api/dayplans', dayplanRoutes);
```

- [ ] **Step 3: Перевірити компіляцію та ручно протестувати**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Запустити бекенд і перевірити:
```bash
# Очікується 200 з { dayPlans: [] }
curl -H "Authorization: Bearer <admin_token>" http://localhost:3001/api/dayplans

# Очікується 201 — створено день 1
curl -X POST -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"day":1}' http://localhost:3001/api/dayplans
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/dayplan.ts backend/src/index.ts
git commit -m "feat: add dayplan CRUD routes"
```

---

## Task 3: trainee routes

**Files:**
- Create: `backend/src/routes/trainee.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `Trainee` model, `DayPlan` model, `User` model, `authMiddleware`, `adminOnly`
- Produces: REST endpoints `/api/trainees`

- [ ] **Step 1: Створити `backend/src/routes/trainee.ts`**

```typescript
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
```

- [ ] **Step 2: Зареєструвати у `backend/src/index.ts`**

```typescript
import traineeRoutes from './routes/trainee';
// ...
app.use('/api/trainees', traineeRoutes);
```

- [ ] **Step 3: Перевірити компіляцію**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/trainee.ts backend/src/index.ts
git commit -m "feat: add trainee routes (progress, reflections, admin CRUD)"
```

---

## Task 4: AI route

**Files:**
- Create: `backend/src/routes/onboardingAi.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `Trainee` model, `authMiddleware`, `adminOnly`, Anthropic SDK
- Produces: `POST /api/onboarding-ai/analyze`

- [ ] **Step 1: Створити `backend/src/routes/onboardingAi.ts`**

```typescript
import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Trainee } from '../models/Trainee';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/analyze', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const { days, traineeName, traineeId } = req.body;

  if (!days || !traineeName || !traineeId) {
    return res.status(400).json({ error: 'Відсутні дані для аналізу' });
  }

  const reflections = days.filter((d: any) => d.reflection);
  if (reflections.length === 0) {
    return res.status(400).json({ error: 'Немає рефлексій для аналізу' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY не налаштований' });

  const summary = reflections.map((d: any) => {
    const r = d.reflection;
    return `День ${d.day}: настрій=${r.q1}/5, зрозумілість=${r.q2}/5, комфорт=${r.q3}/5, лояльність=${r.q5}/5` +
      (r.q4 ? `, стресори: "${r.q4}"` : '') +
      (r.comments ? `, коментар: "${r.comments}"` : '');
  }).join('\n');

  const prompt = `Ти — HR-менеджер салону краси Камея. Проаналізуй рефлексії стажера "${traineeName}" і дай короткий структурований звіт (4-6 речень) про:
- загальний емоційний стан та настрій
- атмосферу та комфорт у салоні
- питання або труднощі, що виникали
- загальне враження та рекомендації

Дані рефлексій (шкала 1-5):
${summary}

Відповідай українською мовою. Звіт має бути теплим, підтримуючим і конкретним.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content.find((b) => b.type === 'text')
      ? (message.content.find((b) => b.type === 'text') as any).text
      : 'Не вдалося отримати відповідь.';

    await Trainee.findByIdAndUpdate(traineeId, {
      $push: { aiReports: { analysis: text, daysCount: reflections.length } },
    });

    res.json({ analysis: text });
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'Помилка AI сервісу' });
  }
});

export default router;
```

- [ ] **Step 2: Зареєструвати у `backend/src/index.ts`**

```typescript
import onboardingAiRoutes from './routes/onboardingAi';
// ...
app.use('/api/onboarding-ai', onboardingAiRoutes);
```

- [ ] **Step 3: Перевірити компіляцію та запустити бекенд**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/onboardingAi.ts backend/src/index.ts
git commit -m "feat: add AI reflection analysis route for onboarding"
```

---

## Task 5: Frontend types + onboardingService

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/services/onboardingService.ts`

**Interfaces:**
- Produces: типи `OnboardingTask`, `OnboardingDay`, `OnboardingReflection`, `OnboardingAiReport`, `OnboardingTrainee`, `AdminDayPlan`; сервісні функції для Tasks 6-9

- [ ] **Step 1: Додати типи до `frontend/src/types.ts`**

В кінець файлу (після останнього інтерфейсу) додати:

```typescript
// ── Onboarding 14 ───────────────────────────────────────────────────────────

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other';
  completed: boolean;
}

export interface OnboardingReflection {
  q1: number; q2: number; q3: number;
  q4: string; q5: number;
  comments: string;
  submittedAt: string;
}

export interface OnboardingDay {
  day: number;
  isHoliday: boolean;
  isPreview: boolean;
  tasks: OnboardingTask[];
  reflection?: OnboardingReflection;
}

export interface OnboardingAiReport {
  id: string;
  analysis: string;
  daysCount: number;
  createdAt: string;
}

export interface OnboardingTrainee {
  id: string;
  name: string;
  position: string;
  startDate: string;
  endDate?: string;
  currentDay: number | null;
  isCompleted: boolean;
  days: OnboardingDay[];
  aiReports: OnboardingAiReport[];
}

// Для адмін-управління планом (без прогресу стажера)
export interface AdminOnboardingTaskItem {
  _id: string;
  title: string;
  description: string;
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other';
}

export interface AdminDayPlan {
  _id: string;
  day: number;
  isHoliday: boolean;
  tasks: AdminOnboardingTaskItem[];
}
```

- [ ] **Step 2: Додати `ADMIN_ONBOARDING` до enum `Screen`**

Знайти в `types.ts` блок `// Admin` всередині enum `Screen` та додати:

```typescript
ADMIN_ONBOARDING = 'ADMIN_ONBOARDING',
```

- [ ] **Step 3: Створити `frontend/src/services/onboardingService.ts`**

```typescript
import { apiFetch } from './apiFetch';
import { OnboardingTrainee, AdminDayPlan } from '../types';

// ── Стажер ───────────────────────────────────────────────────────────────────

export const getMyTrainee = async (): Promise<OnboardingTrainee> => {
  const res = await apiFetch('/api/trainees/me');
  if (res.status === 404) throw Object.assign(new Error('no-profile'), { status: 404 });
  if (!res.ok) throw new Error('Помилка завантаження профілю стажера');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export const toggleTask = async (taskId: string): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/me/tasks/${taskId}`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка оновлення задачі');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export interface ReflectionPayload {
  q1: number; q2: number; q3: number;
  q4: string; q5: number; comments: string;
}

export const submitReflection = async (day: number, payload: ReflectionPayload): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/me/days/${day}/reflection`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Помилка збереження рефлексії');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

// ── Адмін — стажери ──────────────────────────────────────────────────────────

export const getAllTrainees = async (): Promise<OnboardingTrainee[]> => {
  const res = await apiFetch('/api/trainees');
  if (!res.ok) throw new Error('Помилка завантаження стажерів');
  const data = await res.json();
  return data.trainees as OnboardingTrainee[];
};

export const createTrainee = async (userId: string, startDate: string): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка створення стажера');
  }
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export const updateTraineeStartDate = async (id: string, startDate: string): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate }),
  });
  if (!res.ok) throw new Error('Помилка оновлення');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export const deleteTrainee = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/trainees/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення');
};

// ── Адмін — плани ────────────────────────────────────────────────────────────

export const getDayPlans = async (): Promise<AdminDayPlan[]> => {
  const res = await apiFetch('/api/dayplans');
  if (!res.ok) throw new Error('Помилка завантаження планів');
  const data = await res.json();
  return data.dayPlans as AdminDayPlan[];
};

export const createDay = async (day: number, isHoliday = false): Promise<AdminDayPlan> => {
  const res = await apiFetch('/api/dayplans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, isHoliday }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка створення дня');
  }
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const deleteDay = async (day: number): Promise<void> => {
  const res = await apiFetch(`/api/dayplans/${day}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення дня');
};

export const addTask = async (
  day: number,
  task: { title: string; description: string; type: string },
): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Помилка додавання задачі');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const updateTask = async (
  day: number,
  taskId: string,
  patch: { title?: string; description?: string; type?: string },
): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Помилка оновлення задачі');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const deleteTask = async (day: number, taskId: string): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення задачі');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const setDayHoliday = async (day: number, isHoliday: boolean): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/holiday`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isHoliday }),
  });
  if (!res.ok) throw new Error('Помилка оновлення');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

// ── AI ───────────────────────────────────────────────────────────────────────

export const analyzeTrainee = async (
  traineeId: string,
  traineeName: string,
  days: OnboardingTrainee['days'],
): Promise<string> => {
  const res = await apiFetch('/api/onboarding-ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ traineeId, traineeName, days }),
  });
  if (!res.ok) throw new Error('Помилка AI аналізу');
  const data = await res.json();
  return data.analysis as string;
};
```

- [ ] **Step 4: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/onboardingService.ts
git commit -m "feat: add onboarding types, Screen enum entry, and API service"
```

---

## Task 6: DayCard + TaskItem + ReflectionForm

**Files:**
- Create: `frontend/src/components/onboarding/DayCard.tsx`
- Create: `frontend/src/components/onboarding/TaskItem.tsx`
- Create: `frontend/src/components/onboarding/ReflectionForm.tsx`

**Interfaces:**
- Consumes: `OnboardingDay`, `OnboardingTask`, `ReflectionPayload` з types/service
- Produces: три компоненти для Task 7

- [ ] **Step 1: Створити `frontend/src/components/onboarding/DayCard.tsx`**

```tsx
import React from 'react';
import { OnboardingDay } from '../../types';

interface DayCardProps {
  dayPlan: OnboardingDay;
  isActive: boolean;
  isToday: boolean;
  onClick: () => void;
}

export const DayCard: React.FC<DayCardProps> = ({ dayPlan, isActive, isToday, onClick }) => {
  const { day, isHoliday, isPreview, tasks } = dayPlan;
  const allDone = tasks.length > 0 && tasks.every((t) => t.completed);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center min-w-[76px] h-[96px] rounded-xl border-2 transition-all duration-200 shrink-0
        ${isActive
          ? 'border-kameya-burgundy bg-kameya-burgundy text-white scale-105 shadow-lg'
          : isPreview
          ? 'border-slate-200 bg-slate-50 text-slate-300 opacity-60 cursor-default'
          : allDone
          ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
          : 'border-slate-200 bg-white text-slate-500 hover:border-kameya-burgundy/40'}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide mb-0.5">День</span>
      <span className="text-2xl font-bold leading-none">{day}</span>

      {isToday && !isActive && (
        <span className="absolute bottom-1.5 text-[8px] font-bold text-kameya-burgundy uppercase tracking-wide">
          Сьогодні
        </span>
      )}
      {isToday && isActive && (
        <span className="absolute bottom-1.5 text-[8px] font-bold text-white/80 uppercase tracking-wide">
          Сьогодні
        </span>
      )}
      {isHoliday && !isActive && (
        <span className="absolute bottom-1.5 text-[8px] text-slate-400 font-medium">Відпочинок</span>
      )}
      {!isPreview && allDone && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
          <i className="fas fa-check text-white text-[8px]" />
        </div>
      )}
    </button>
  );
};
```

- [ ] **Step 2: Створити `frontend/src/components/onboarding/TaskItem.tsx`**

```tsx
import React from 'react';
import { OnboardingTask } from '../../types';

const TYPE_LABELS: Record<OnboardingTask['type'], string> = {
  theory:      'Теорія',
  practice:    'Практика',
  meeting:     'Зустріч',
  observation: 'Спостереження',
  other:       'Інше',
};

const TYPE_COLORS: Record<OnboardingTask['type'], string> = {
  theory:      'bg-blue-100 text-blue-700',
  practice:    'bg-green-100 text-green-700',
  meeting:     'bg-purple-100 text-purple-700',
  observation: 'bg-amber-100 text-amber-700',
  other:       'bg-slate-100 text-slate-600',
};

interface TaskItemProps {
  task: OnboardingTask;
  disabled?: boolean;
  onToggle: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, disabled, onToggle }) => (
  <div
    className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-150
      ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
  >
    <button
      onClick={() => !disabled && onToggle(task.id)}
      disabled={disabled}
      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
        ${task.completed
          ? 'bg-green-500 border-green-500'
          : disabled
          ? 'border-slate-200 bg-slate-100 cursor-not-allowed'
          : 'border-slate-300 hover:border-kameya-burgundy'}`}
    >
      {task.completed && <i className="fas fa-check text-white text-[10px]" />}
    </button>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[task.type]}`}>
          {TYPE_LABELS[task.type]}
        </span>
        <span className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {task.title}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-slate-500 mt-1">{task.description}</p>
      )}
    </div>
  </div>
);
```

- [ ] **Step 3: Створити `frontend/src/components/onboarding/ReflectionForm.tsx`**

```tsx
import React, { useState } from 'react';
import { ReflectionPayload } from '../../services/onboardingService';
import { OnboardingReflection } from '../../types';

interface ReflectionFormProps {
  existing?: OnboardingReflection;
  onSubmit: (data: ReflectionPayload) => Promise<void>;
  onCancel: () => void;
}

const RATING_QUESTIONS: { key: keyof Pick<ReflectionPayload, 'q1'|'q2'|'q3'|'q5'>; label: string }[] = [
  { key: 'q1', label: 'Як твій настрій сьогодні?' },
  { key: 'q2', label: 'Наскільки зрозумілим був матеріал дня?' },
  { key: 'q3', label: 'Наскільки комфортно ти почувався в салоні?' },
  { key: 'q5', label: 'Твоя лояльність до Камеї' },
];

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all
              ${value === n
                ? 'bg-kameya-burgundy border-kameya-burgundy text-white'
                : 'border-slate-200 text-slate-500 hover:border-kameya-burgundy/50'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export const ReflectionForm: React.FC<ReflectionFormProps> = ({ existing, onSubmit, onCancel }) => {
  const [form, setForm] = useState<ReflectionPayload>({
    q1: existing?.q1 ?? 0,
    q2: existing?.q2 ?? 0,
    q3: existing?.q3 ?? 0,
    q4: existing?.q4 ?? '',
    q5: existing?.q5 ?? 0,
    comments: existing?.comments ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setRating = (key: 'q1'|'q2'|'q3'|'q5') => (v: number) => setForm((f) => ({ ...f, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.q1 || !form.q2 || !form.q3 || !form.q5) {
      setError('Будь ласка, оціни всі питання.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } catch {
      setError('Помилка збереження. Спробуй ще раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <h3 className="text-base font-bold text-slate-800">
        {existing ? 'Оновити рефлексію' : 'Рефлексія дня'}
      </h3>

      {RATING_QUESTIONS.map((q) => (
        <RatingRow
          key={q.key}
          label={q.label}
          value={form[q.key] as number}
          onChange={setRating(q.key)}
        />
      ))}

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">
          Що тебе стресувало або дивувало сьогодні?
        </label>
        <textarea
          value={form.q4}
          onChange={(e) => setForm((f) => ({ ...f, q4: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-kameya-burgundy resize-none"
          placeholder="Необов'язково..."
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">Коментар</label>
        <textarea
          value={form.comments}
          onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-kameya-burgundy resize-none"
          placeholder="Необов'язково..."
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-kameya-burgundy text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Збереження...' : existing ? 'Оновити' : 'Зберегти'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
};
```

- [ ] **Step 4: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/onboarding/DayCard.tsx \
        frontend/src/components/onboarding/TaskItem.tsx \
        frontend/src/components/onboarding/ReflectionForm.tsx
git commit -m "feat: add DayCard, TaskItem, ReflectionForm components"
```

---

## Task 7: OnboardingView (замінити заглушку)

**Files:**
- Modify: `frontend/src/components/onboarding/OnboardingView.tsx`

**Interfaces:**
- Consumes: `DayCard`, `TaskItem`, `ReflectionForm`, `getMyTrainee`, `toggleTask`, `submitReflection`
- Produces: повноцінний UI для стажера

- [ ] **Step 1: Переписати `OnboardingView.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { OnboardingTrainee } from '../../types';
import { getMyTrainee, toggleTask, submitReflection, ReflectionPayload } from '../../services/onboardingService';
import { DayCard } from './DayCard';
import { TaskItem } from './TaskItem';
import { ReflectionForm } from './ReflectionForm';

interface OnboardingViewProps {
  track: '14' | '30' | '60';
}

export const OnboardingView: React.FC<OnboardingViewProps> = () => {
  const [trainee, setTrainee] = useState<OnboardingTrainee | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    getMyTrainee()
      .then((data) => {
        setTrainee(data);
        setSelectedDay(data.currentDay ?? (data.days[0]?.day ?? null));
      })
      .catch((err: any) => {
        if (err.status === 404) setNoProfile(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy" />
      </div>
    );
  }

  if (noProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
          <i className="fas fa-user-clock text-2xl text-kameya-burgundy" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Онбординг — 14 днів</h2>
        <p className="text-slate-400 text-sm">Ваш профіль стажера ще не створено. Зверніться до адміністратора.</p>
      </div>
    );
  }

  if (!trainee) return null;

  const activeDayData = trainee.days.find((d) => d.day === selectedDay);

  const handleToggle = async (taskId: string) => {
    setToggling(taskId);
    try {
      const updated = await toggleTask(taskId);
      setTrainee(updated);
    } finally {
      setToggling(null);
    }
  };

  const handleReflection = async (data: ReflectionPayload) => {
    if (selectedDay === null) return;
    const updated = await submitReflection(selectedDay, data);
    setTrainee(updated);
    setShowReflection(false);
  };

  const completedDays = trainee.days.filter(
    (d) => d.tasks.length > 0 && d.tasks.every((t) => t.completed),
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Заголовок */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Онбординг 14 днів</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {trainee.isCompleted
                ? 'Стажування завершено'
                : `День ${trainee.currentDay ?? '—'} з ${trainee.days.length}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-kameya-burgundy">{completedDays}</p>
            <p className="text-xs text-slate-400">днів виконано</p>
          </div>
        </div>
        {/* Прогрес-бар */}
        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-kameya-burgundy rounded-full transition-all"
            style={{ width: `${Math.round((completedDays / trainee.days.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Стрічка днів */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {trainee.days.map((d) => (
          <DayCard
            key={d.day}
            dayPlan={d}
            isActive={selectedDay === d.day}
            isToday={d.day === trainee.currentDay}
            onClick={() => {
              if (!d.isPreview) {
                setSelectedDay(d.day);
                setShowReflection(false);
              }
            }}
          />
        ))}
      </div>

      {/* Деталі дня */}
      {activeDayData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">
              День {activeDayData.day}
              {activeDayData.isHoliday && (
                <span className="ml-2 text-xs font-normal text-slate-400">· Відпочинок</span>
              )}
            </h3>
          </div>

          {activeDayData.isPreview ? (
            <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-400">
              <i className="fas fa-lock mr-2" />
              Цей день ще не настав
            </div>
          ) : activeDayData.isHoliday ? (
            <div className="bg-kameya-burgundy/5 rounded-xl p-6 text-center">
              <i className="fas fa-sun text-2xl text-kameya-burgundy mb-2 block" />
              <p className="text-sm font-medium text-slate-600">День відпочинку — нікого завдань</p>
            </div>
          ) : (
            <>
              {/* Задачі */}
              <div className="space-y-2">
                {activeDayData.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    disabled={toggling === task.id}
                    onToggle={handleToggle}
                  />
                ))}
                {activeDayData.tasks.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Завдань для цього дня не додано</p>
                )}
              </div>

              {/* Рефлексія */}
              <div className="pt-2">
                {showReflection ? (
                  <ReflectionForm
                    existing={activeDayData.reflection}
                    onSubmit={handleReflection}
                    onCancel={() => setShowReflection(false)}
                  />
                ) : activeDayData.reflection ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-700">Рефлексія заповнена</span>
                      <button
                        onClick={() => setShowReflection(true)}
                        className="text-xs text-kameya-burgundy hover:underline"
                      >
                        Редагувати
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {(['q1','q2','q3','q5'] as const).map((key) => (
                        <div key={key} className="bg-white rounded-lg p-2 border border-slate-100">
                          <p className="text-xl font-bold text-kameya-burgundy">
                            {activeDayData.reflection![key]}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">з 5</p>
                        </div>
                      ))}
                    </div>
                    {activeDayData.reflection.comments && (
                      <p className="text-xs text-slate-500 mt-3 italic">
                        "{activeDayData.reflection.comments}"
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReflection(true)}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-kameya-burgundy/30 text-sm text-kameya-burgundy font-medium hover:bg-kameya-burgundy/5 transition-colors"
                  >
                    <i className="fas fa-pen-to-square mr-2" />
                    Заповнити рефлексію дня
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/onboarding/OnboardingView.tsx
git commit -m "feat: implement OnboardingView with day cards, tasks and reflection"
```

---

## Task 8: AdminOnboardingView

**Files:**
- Create: `frontend/src/components/admin/AdminOnboardingView.tsx`

**Interfaces:**
- Consumes: всі функції з `onboardingService`, `fetchUsers` з `usersService`, типи `OnboardingTrainee`, `AdminDayPlan`, `UserListItem`
- Produces: компонент для `Screen.ADMIN_ONBOARDING`

- [ ] **Step 1: Створити `frontend/src/components/admin/AdminOnboardingView.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { OnboardingTrainee, AdminDayPlan, UserListItem } from '../../types';
import {
  getAllTrainees, createTrainee, updateTraineeStartDate, deleteTrainee,
  getDayPlans, createDay, deleteDay, addTask, updateTask, deleteTask, setDayHoliday,
  analyzeTrainee,
} from '../../services/onboardingService';
import { fetchUsers } from '../../services/usersService';

type Tab = 'trainees' | 'dayplans';
type TaskType = 'theory' | 'practice' | 'meeting' | 'observation' | 'other';

const TYPE_LABELS: Record<TaskType, string> = {
  theory: 'Теорія', practice: 'Практика', meeting: 'Зустріч',
  observation: 'Спостереження', other: 'Інше',
};

export const AdminOnboardingView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('trainees');

  // ── Стажери ─────────────────────────────────────────────────────────────────
  const [trainees, setTrainees] = useState<OnboardingTrainee[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [traineesLoading, setTraineesLoading] = useState(true);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [showAddTrainee, setShowAddTrainee] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addStartDate, setAddStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [addLoading, setAddLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [expandedTraineeId, setExpandedTraineeId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState<{ id: string; value: string } | null>(null);

  // ── Плани ────────────────────────────────────────────────────────────────────
  const [dayPlans, setDayPlans] = useState<AdminDayPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanDay, setSelectedPlanDay] = useState<number | null>(null);
  const [newDayNum, setNewDayNum] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', type: 'other' as TaskType });
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskData, setEditTaskData] = useState({ title: '', description: '', type: 'other' as TaskType });
  const [planError, setPlanError] = useState('');

  // Load trainees + users
  useEffect(() => {
    Promise.all([getAllTrainees(), fetchUsers()])
      .then(([t, u]) => {
        setTrainees(t);
        setUsers(u);
        if (t.length > 0) setSelectedTraineeId(t[0].id);
      })
      .finally(() => setTraineesLoading(false));
  }, []);

  // Load day plans
  useEffect(() => {
    getDayPlans()
      .then((plans) => {
        setDayPlans(plans);
        if (plans.length > 0) setSelectedPlanDay(plans[0].day);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  const selectedTrainee = trainees.find((t) => t.id === selectedTraineeId) ?? null;
  const selectedPlan = dayPlans.find((p) => p.day === selectedPlanDay) ?? null;

  // Юзери без профілю стажера
  const traineeUserIds = new Set(
    trainees.map((t) => users.find((u) => u.name === t.name)?._id).filter(Boolean),
  );
  const availableUsers = users.filter((u) => !u.isAdmin && !traineeUserIds.has(u._id));

  const handleAddTrainee = async () => {
    if (!addUserId) return;
    setAddLoading(true);
    try {
      const created = await createTrainee(addUserId, addStartDate);
      setTrainees((prev) => [...prev, created]);
      setSelectedTraineeId(created.id);
      setShowAddTrainee(false);
      setAddUserId('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteTrainee = async (id: string) => {
    if (!confirm('Видалити профіль стажера? Прогрес буде втрачено.')) return;
    await deleteTrainee(id);
    setTrainees((prev) => prev.filter((t) => t.id !== id));
    setSelectedTraineeId(null);
  };

  const handleUpdateStartDate = async (id: string, date: string) => {
    const updated = await updateTraineeStartDate(id, date);
    setTrainees((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditStartDate(null);
  };

  const handleAnalyze = async (trainee: OnboardingTrainee) => {
    setAiLoading(true);
    try {
      const analysis = await analyzeTrainee(trainee.id, trainee.name, trainee.days);
      // Оновити стажера (AI звіт зберігається на бекенді, перезавантажити)
      const updated = await getAllTrainees();
      setTrainees(updated);
      const found = updated.find((t) => t.id === trainee.id);
      if (found && found.aiReports[0]) setOpenReportId(found.aiReports[0].id);
      void analysis; // вже збережено на бекенді
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Плани
  const handleAddDay = async () => {
    const n = Number(newDayNum);
    if (!n || n < 1 || n > 60) { setPlanError('Введіть число від 1 до 60'); return; }
    setPlanError('');
    try {
      const plan = await createDay(n);
      setDayPlans((prev) => [...prev, plan].sort((a, b) => a.day - b.day));
      setSelectedPlanDay(plan.day);
      setNewDayNum('');
    } catch (err: any) { setPlanError(err.message); }
  };

  const handleDeleteDay = async (day: number) => {
    if (!confirm(`Видалити день ${day} з усіма задачами?`)) return;
    await deleteDay(day);
    setDayPlans((prev) => prev.filter((p) => p.day !== day));
    setSelectedPlanDay(null);
  };

  const handleToggleHoliday = async (day: number, current: boolean) => {
    const updated = await setDayHoliday(day, !current);
    setDayPlans((prev) => prev.map((p) => (p.day === day ? updated : p)));
  };

  const handleAddTask = async () => {
    if (!selectedPlanDay || !newTask.title.trim()) return;
    const updated = await addTask(selectedPlanDay, newTask);
    setDayPlans((prev) => prev.map((p) => (p.day === selectedPlanDay ? updated : p)));
    setNewTask({ title: '', description: '', type: 'other' });
  };

  const handleSaveTask = async (taskId: string) => {
    if (!selectedPlanDay) return;
    const updated = await updateTask(selectedPlanDay, taskId, editTaskData);
    setDayPlans((prev) => prev.map((p) => (p.day === selectedPlanDay ? updated : p)));
    setEditTaskId(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedPlanDay) return;
    const updated = await deleteTask(selectedPlanDay, taskId);
    setDayPlans((prev) => prev.map((p) => (p.day === selectedPlanDay ? updated : p)));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Онбординг 14 днів</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {(['trainees', 'dayplans'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white shadow text-kameya-burgundy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'trainees' ? 'Стажери' : 'Управління планом'}
          </button>
        ))}
      </div>

      {/* ── Tab: Стажери ── */}
      {tab === 'trainees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Список */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-600">Список стажерів</span>
              <button
                onClick={() => setShowAddTrainee(true)}
                className="text-xs text-kameya-burgundy hover:underline font-medium"
              >
                + Додати
              </button>
            </div>

            {showAddTrainee && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                >
                  <option value="">Виберіть користувача</option>
                  {availableUsers.map((u) => (
                    <option key={u._id} value={u._id}>{u.name} ({u.position})</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={addStartDate}
                  onChange={(e) => setAddStartDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTrainee}
                    disabled={addLoading || !addUserId}
                    className="flex-1 bg-kameya-burgundy text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {addLoading ? 'Створення...' : 'Створити'}
                  </button>
                  <button
                    onClick={() => setShowAddTrainee(false)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500"
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            )}

            {traineesLoading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Завантаження...</div>
            ) : trainees.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">Стажерів ще немає</div>
            ) : (
              trainees.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTraineeId(t.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedTraineeId === t.id
                      ? 'border-kameya-burgundy bg-kameya-burgundy/5'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.position}</p>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full">
                    <div
                      className={`h-full rounded-full ${t.isCompleted ? 'bg-green-500' : 'bg-kameya-burgundy'}`}
                      style={{ width: `${Math.round(((t.currentDay ?? 0) / 14) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t.isCompleted ? 'Завершено' : `День ${t.currentDay ?? '—'} / 14`}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Деталі стажера */}
          <div className="lg:col-span-2">
            {!selectedTrainee ? (
              <div className="text-center py-16 text-slate-400 text-sm">Оберіть стажера зліва</div>
            ) : (
              <div className="space-y-4">
                {/* Заголовок */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{selectedTrainee.name}</h3>
                      <p className="text-sm text-slate-400">{selectedTrainee.position}</p>
                      {editStartDate?.id === selectedTrainee.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="date"
                            value={editStartDate.value}
                            onChange={(e) => setEditStartDate({ id: selectedTrainee.id, value: e.target.value })}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-kameya-burgundy"
                          />
                          <button
                            onClick={() => handleUpdateStartDate(selectedTrainee.id, editStartDate.value)}
                            className="text-xs text-kameya-burgundy font-semibold"
                          >Зберегти</button>
                          <button onClick={() => setEditStartDate(null)} className="text-xs text-slate-400">Скасувати</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditStartDate({ id: selectedTrainee.id, value: new Date(selectedTrainee.startDate).toISOString().slice(0, 10) })}
                          className="text-xs text-slate-400 mt-1 hover:text-kameya-burgundy"
                        >
                          Початок: {new Date(selectedTrainee.startDate).toLocaleDateString('uk-UA')}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnalyze(selectedTrainee)}
                        disabled={aiLoading || !selectedTrainee.days.some((d) => d.reflection)}
                        className="text-xs bg-kameya-burgundy text-white rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                      >
                        {aiLoading ? 'Аналіз...' : 'AI аналіз'}
                      </button>
                      <button
                        onClick={() => handleDeleteTrainee(selectedTrainee.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-2"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI звіти */}
                {selectedTrainee.aiReports.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Звіти</p>
                    {selectedTrainee.aiReports.map((r) => (
                      <div key={r.id} className="bg-white rounded-xl border border-slate-200">
                        <button
                          onClick={() => setOpenReportId(openReportId === r.id ? null : r.id)}
                          className="w-full flex items-center justify-between p-4 text-left"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            Аналіз ({r.daysCount} рефлексій) —{' '}
                            {new Date(r.createdAt).toLocaleDateString('uk-UA')}
                          </span>
                          <i className={`fas fa-chevron-${openReportId === r.id ? 'up' : 'down'} text-slate-400 text-xs`} />
                        </button>
                        {openReportId === r.id && (
                          <div className="px-4 pb-4 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {r.analysis}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Дні і рефлексії */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Прогрес по днях</p>
                  {selectedTrainee.days.map((d) => (
                    <div
                      key={d.day}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedTraineeId(expandedTraineeId === `${selectedTrainee.id}-${d.day}` ? null : `${selectedTrainee.id}-${d.day}`)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            d.tasks.every((t) => t.completed) && d.tasks.length > 0
                              ? 'bg-green-100 text-green-700'
                              : d.isPreview ? 'bg-slate-100 text-slate-400' : 'bg-kameya-burgundy/10 text-kameya-burgundy'
                          }`}>{d.day}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              День {d.day}{d.isHoliday ? ' · Відпочинок' : ''}
                            </p>
                            <p className="text-xs text-slate-400">
                              {d.tasks.filter((t) => t.completed).length}/{d.tasks.length} задач
                              {d.reflection ? ' · Рефлексія ✓' : ''}
                            </p>
                          </div>
                        </div>
                        <i className={`fas fa-chevron-${expandedTraineeId === `${selectedTrainee.id}-${d.day}` ? 'up' : 'down'} text-slate-400 text-xs`} />
                      </button>

                      {expandedTraineeId === `${selectedTrainee.id}-${d.day}` && d.reflection && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                          <p className="text-xs font-semibold text-slate-500">Рефлексія</p>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                              { label: 'Настрій', val: d.reflection.q1 },
                              { label: 'Матеріал', val: d.reflection.q2 },
                              { label: 'Комфорт', val: d.reflection.q3 },
                              { label: 'Лояльність', val: d.reflection.q5 },
                            ].map(({ label, val }) => (
                              <div key={label} className="bg-slate-50 rounded-lg p-2">
                                <p className="text-lg font-bold text-kameya-burgundy">{val}</p>
                                <p className="text-[10px] text-slate-400">{label}</p>
                              </div>
                            ))}
                          </div>
                          {d.reflection.q4 && (
                            <p className="text-xs text-slate-500 mt-2">
                              <span className="font-medium">Стресори:</span> {d.reflection.q4}
                            </p>
                          )}
                          {d.reflection.comments && (
                            <p className="text-xs text-slate-500 italic">"{d.reflection.comments}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Управління планом ── */}
      {tab === 'dayplans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Список днів */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-600 mb-1">Дні</p>
            {plansLoading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Завантаження...</div>
            ) : (
              <>
                {dayPlans.map((p) => (
                  <button
                    key={p.day}
                    onClick={() => setSelectedPlanDay(p.day)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      selectedPlanDay === p.day
                        ? 'border-kameya-burgundy bg-kameya-burgundy/5'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      День {p.day}
                      {p.isHoliday && <span className="ml-2 text-xs font-normal text-slate-400">· Відпочинок</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.tasks.length} задач</p>
                  </button>
                ))}

                {/* Додати день */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newDayNum}
                    onChange={(e) => setNewDayNum(e.target.value)}
                    placeholder="День №"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                  />
                  <button
                    onClick={handleAddDay}
                    disabled={!newDayNum}
                    className="px-3 py-2 bg-kameya-burgundy text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                {planError && <p className="text-xs text-red-500">{planError}</p>}
              </>
            )}
          </div>

          {/* Задачі дня */}
          <div className="lg:col-span-2">
            {!selectedPlan ? (
              <div className="text-center py-16 text-slate-400 text-sm">Оберіть день зліва</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800">День {selectedPlan.day}</h3>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPlan.isHoliday}
                          onChange={() => handleToggleHoliday(selectedPlan.day, selectedPlan.isHoliday)}
                          className="accent-kameya-burgundy"
                        />
                        Вихідний
                      </label>
                      <button
                        onClick={() => handleDeleteDay(selectedPlan.day)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        <i className="fas fa-trash" /> Видалити день
                      </button>
                    </div>
                  </div>

                  {/* Задачі */}
                  <div className="space-y-2 mb-4">
                    {selectedPlan.tasks.map((task) => (
                      <div key={task._id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        {editTaskId === task._id ? (
                          <div className="space-y-2">
                            <input
                              value={editTaskData.title}
                              onChange={(e) => setEditTaskData((d) => ({ ...d, title: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                              placeholder="Назва"
                            />
                            <input
                              value={editTaskData.description}
                              onChange={(e) => setEditTaskData((d) => ({ ...d, description: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                              placeholder="Опис"
                            />
                            <select
                              value={editTaskData.type}
                              onChange={(e) => setEditTaskData((d) => ({ ...d, type: e.target.value as TaskType }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                            >
                              {(Object.keys(TYPE_LABELS) as TaskType[]).map((k) => (
                                <option key={k} value={k}>{TYPE_LABELS[k]}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveTask(task._id)} className="flex-1 bg-kameya-burgundy text-white rounded-lg py-1.5 text-sm font-semibold">Зберегти</button>
                              <button onClick={() => setEditTaskId(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-500">Скасувати</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mr-2
                                ${task.type === 'theory' ? 'bg-blue-100 text-blue-700' :
                                  task.type === 'practice' ? 'bg-green-100 text-green-700' :
                                  task.type === 'meeting' ? 'bg-purple-100 text-purple-700' :
                                  task.type === 'observation' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-600'}`}>
                                {TYPE_LABELS[task.type]}
                              </span>
                              <span className="text-sm font-medium text-slate-800">{task.title}</span>
                              {task.description && (
                                <p className="text-xs text-slate-400 mt-1">{task.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => { setEditTaskId(task._id); setEditTaskData({ title: task.title, description: task.description, type: task.type }); }}
                                className="text-slate-400 hover:text-kameya-burgundy p-1"
                              >
                                <i className="fas fa-pen text-xs" />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task._id)}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                <i className="fas fa-trash text-xs" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedPlan.tasks.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-3">Задач ще немає</p>
                    )}
                  </div>

                  {/* Нова задача */}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Нова задача</p>
                    <input
                      value={newTask.title}
                      onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                      placeholder="Назва задачі"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                    />
                    <input
                      value={newTask.description}
                      onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                      placeholder="Опис (необов'язково)"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                    />
                    <select
                      value={newTask.type}
                      onChange={(e) => setNewTask((t) => ({ ...t, type: e.target.value as TaskType }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-kameya-burgundy"
                    >
                      {(Object.keys(TYPE_LABELS) as TaskType[]).map((k) => (
                        <option key={k} value={k}>{TYPE_LABELS[k]}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTask.title.trim()}
                      className="w-full bg-kameya-burgundy text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Додати задачу
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/AdminOnboardingView.tsx
git commit -m "feat: add AdminOnboardingView with trainees and day plan management"
```

---

## Task 9: App.tsx + Layout.tsx wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `AdminOnboardingView`, `Screen.ADMIN_ONBOARDING`
- Produces: повністю підключений онбординг в навігації та роутингу

- [ ] **Step 1: Додати import та case у `App.tsx`**

Знайти блок імпортів адмін-компонентів і додати:
```typescript
import { AdminOnboardingView } from './components/admin/AdminOnboardingView';
```

Знайти функцію `renderAdminScreen()` і додати перед `default`:
```typescript
case Screen.ADMIN_ONBOARDING:
  return <AdminOnboardingView />;
```

- [ ] **Step 2: Додати пункт у `Layout.tsx`**

Знайти масив `ADMIN_NAV` і додати новий пункт після `ADMIN_NOTIFICATIONS`:
```typescript
{ id: Screen.ADMIN_ONBOARDING, label: 'Онбординг', icon: 'fa-user-clock' },
```

- [ ] **Step 3: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Ручне тестування**

Запустити фронт і бекенд:
```bash
# Термінал 1
cd /Users/Apple/IT/mysteryshopperKameya/backend && npm run dev

# Термінал 2
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npm run dev
```

Перевірити:
1. Адмін бачить вкладку "Онбординг" в бічній навігації
2. Вкладка "Управління планом" — можна додати день і задачі до нього
3. Вкладка "Стажери" — кнопка "Додати" відкриває форму з вибором юзера
4. Після додавання стажера він з'являється в списку
5. Стажер (не-адмін) бачить вкладку "Онбординг 14 днів"
6. Якщо профіль не створено — показується повідомлення "Зверніться до адміністратора"
7. Після того як адмін створив профіль — стажер бачить стрічку днів
8. Стажер може відмічати задачі чекбоксами
9. Кнопка "Заповнити рефлексію дня" відкриває форму
10. Після збереження рефлексії — адмін бачить її у деталях стажера
11. AI кнопка (якщо є рефлексії) — генерує звіт і він з'являється в accordion

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: wire AdminOnboardingView into admin nav and routing"
```
