# Badge System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 9-badge achievement system to the "Мій прогрес" page with automatic awarding based on report/learning-plan history, plus admin UI to view, assign, and delete badges per employee.

**Architecture:** Badges are stored as embedded `IBadgeAward[]` inside the User document (Option B); a new `badgeService.ts` evaluates conditions and pushes awards via `$push` with idempotency guards; it is hooked non-blocking into existing route handlers. The frontend renders badges in 5 category groups with hover/long-press tooltips; admin manages them via a modal in UsersView.

**Tech Stack:** TypeScript, Express, Mongoose (backend); React, Tailwind CSS, FontAwesome icons (frontend). No test framework — verification via curl + browser.

## Global Constraints

- Follow existing code patterns in `backend/src/` and `frontend/src/`
- Badges are **append-only** from the system side — never auto-removed; only admins can delete
- Series badges use `totalScore === 100` exactly (not >90% like the streak bonus)
- "Consecutive" for Серія = Q1→Q2→Q3→Q4 order within same year; a missing quarter or non-100% resets
- `clean_form` badge is defined (name, icon, condition text) but has **no auto-evaluation logic** (condition TBD)
- All UI strings in Ukrainian
- `BadgeId` is defined separately in backend and frontend — no shared package

## File Structure

**Backend:**
- `backend/src/models/User.ts` — MODIFY: add `IBadgeAward`, `BadgeAwardSchema`, `badges` field
- `backend/src/constants/badges.ts` — CREATE: `BadgeId` type, `YEARLY_BADGE_IDS` set
- `backend/src/services/badgeService.ts` — CREATE: all evaluation logic
- `backend/src/routes/reports.ts` — MODIFY: hook badge eval into confirm + task toggle; add `GET /my/badges`
- `backend/src/routes/users.ts` — MODIFY: add `GET/POST/DELETE /api/users/:id/badges` + student-of-year trigger

**Frontend:**
- `frontend/src/types.ts` — MODIFY: add `BadgeId`, `BadgeAward` types
- `frontend/src/constants/badges.ts` — CREATE: `BADGE_CATALOGUE` with 9 badge definitions
- `frontend/src/services/reportsService.ts` — MODIFY: add `getMyBadges()`
- `frontend/src/services/usersService.ts` — MODIFY: add `getUserBadges()`, `assignBadge()`, `deleteBadge()`
- `frontend/src/components/BadgeTile.tsx` — CREATE: reusable tile with tooltip + long-press
- `frontend/src/components/ProgressView.tsx` — MODIFY: fetch and display badges in 5 groups
- `frontend/src/components/admin/BadgesModal.tsx` — CREATE: admin badge management modal
- `frontend/src/components/admin/UsersView.tsx` — MODIFY: add "Нагороди" button per row

---

### Task 1: Backend — User model with badges array

**Files:**
- Modify: `backend/src/models/User.ts`

**Interfaces:**
- Produces: `IBadgeAward` interface and `badges` field consumed by Tasks 2, 3

- [ ] **Step 1: Add IBadgeAward interface and BadgeAwardSchema to User.ts**

Replace the top of `backend/src/models/User.ts` with:

```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBadgeAward {
  _id: Types.ObjectId;
  badgeId: string;
  earnedAt: Date;
  year?: number;
  manual?: boolean;
}

export interface IUser extends Document {
  phone: string;
  password: string;
  name: string;
  position?: string;
  store?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  points: number;
  birthday?: Date;
  badges: IBadgeAward[];
  createdAt: Date;
  updatedAt: Date;
}

const BadgeAwardSchema = new Schema<IBadgeAward>({
  badgeId:  { type: String, required: true },
  earnedAt: { type: Date, required: true, default: Date.now },
  year:     { type: Number },
  manual:   { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    phone:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name:     { type: String, default: '' },
    position: { type: String },
    store:    { type: String },
    role:     { type: String, enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' },
    points:   { type: Number, default: 0 },
    birthday: { type: Date },
    badges:   { type: [BadgeAwardSchema], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npx tsc --noEmit
```

Expected: no errors related to User.ts

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/User.ts
git commit -m "feat: add badges array to User model"
```

---

### Task 2: Backend — badgeService.ts

**Files:**
- Create: `backend/src/constants/badges.ts`
- Create: `backend/src/services/badgeService.ts`

**Interfaces:**
- Consumes: `IBadgeAward`, `IUser` from `../models/User`; `IReport` from `../models/Report`
- Produces:
  - `evaluateOnReportConfirm(userId: string, reportId: string): Promise<void>`
  - `evaluateOnLearningPlanComplete(userId: string, reportId: string): Promise<void>`
  - `evaluateStudentOfYear(userId: string, year: number): Promise<void>`

- [ ] **Step 1: Create backend/src/constants/badges.ts**

```typescript
export type BadgeId =
  | 'first_report'
  | 'first_perfect'
  | 'honor_student'
  | 'student_of_year'
  | 'clean_form'
  | 'silver_guide'
  | 'gold_series'
  | 'platinum_standard'
  | 'comeback';

export const YEARLY_BADGE_IDS = new Set<BadgeId>([
  'silver_guide',
  'gold_series',
  'platinum_standard',
  'student_of_year',
]);
```

- [ ] **Step 2: Create backend/src/services/badgeService.ts**

```typescript
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Report } from '../models/Report';
import { BadgeId } from '../constants/badges';

const QUARTER_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

function calcSeriesMilestones(reports: { quarter: string; totalScore: number }[]): number[] {
  const byQuarter: Record<number, number> = {};
  for (const r of reports) {
    const q = QUARTER_ORDER[r.quarter];
    if (q === undefined) continue;
    if (byQuarter[q] === undefined || r.totalScore > byQuarter[q]) {
      byQuarter[q] = r.totalScore;
    }
  }

  const milestones: number[] = [];
  let streak = 0;
  let prevQ = 0;

  for (const q of [1, 2, 3, 4]) {
    if (byQuarter[q] === undefined) { streak = 0; prevQ = 0; continue; }
    if (prevQ > 0 && q !== prevQ + 1) streak = 0;
    if (byQuarter[q] === 100) {
      streak++;
      if (streak >= 2 && streak <= 4) milestones.push(streak);
    } else {
      streak = 0;
    }
    prevQ = q;
  }

  return milestones;
}

export async function evaluateOnReportConfirm(
  userId: string | Types.ObjectId,
  reportId: string | Types.ObjectId,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const allReports = await Report.find({ userId })
    .sort({ createdAt: 1 })
    .lean();

  const newBadges: { badgeId: BadgeId; earnedAt: Date; year?: number }[] = [];
  const has = (id: BadgeId) => user.badges.some(b => b.badgeId === id);
  const hasForYear = (id: BadgeId, year: number) =>
    user.badges.some(b => b.badgeId === id && b.year === year);

  // ── Старт ──────────────────────────────────────────────────────────────────
  if (!has('first_report')) {
    newBadges.push({ badgeId: 'first_report', earnedAt: new Date() });
  }

  if (!has('first_perfect') && allReports.length === 1 && allReports[0].totalScore === 100) {
    newBadges.push({ badgeId: 'first_perfect', earnedAt: new Date() });
  }

  // ── Серія ──────────────────────────────────────────────────────────────────
  const currentReport = allReports.find(r => r._id.toString() === reportId.toString());
  const year = currentReport?.year ?? new Date().getFullYear();
  const yearReports = allReports.filter(r => r.year === year);
  const milestones = calcSeriesMilestones(yearReports);

  for (const m of milestones) {
    const badgeId: BadgeId = m === 2 ? 'silver_guide' : m === 3 ? 'gold_series' : 'platinum_standard';
    if (!hasForYear(badgeId, year)) {
      newBadges.push({ badgeId, earnedAt: new Date(), year });
    }
  }

  // ── Камбек ─────────────────────────────────────────────────────────────────
  if (allReports.length >= 2) {
    let historicalComebacks = 0;
    for (let i = 1; i < allReports.length; i++) {
      const prev = allReports[i - 1];
      const curr = allReports[i];
      const prevHasCompletedPlan =
        !!prev.learningPlan?.tasks?.length &&
        prev.learningPlan.tasks.every((t: { isCompleted: boolean }) => t.isCompleted);
      if (prev.totalScore < 85 && prevHasCompletedPlan && curr.totalScore === 100) {
        historicalComebacks++;
      }
    }
    const existingComebacks = user.badges.filter(b => b.badgeId === 'comeback').length;
    if (existingComebacks < historicalComebacks) {
      newBadges.push({ badgeId: 'comeback', earnedAt: new Date() });
    }
  }

  if (newBadges.length > 0) {
    await User.findByIdAndUpdate(userId, { $push: { badges: { $each: newBadges } } });
  }
}

export async function evaluateOnLearningPlanComplete(
  userId: string | Types.ObjectId,
  reportId: string | Types.ObjectId,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  if (user.badges.some(b => b.badgeId === 'honor_student')) return;

  const report = await Report.findById(reportId).lean();
  if (!report?.learningPlan) return;

  const plan = report.learningPlan;
  const allOnTime = plan.tasks.every(
    (t: { isCompleted: boolean; completedAt?: Date }) =>
      t.isCompleted && t.completedAt && new Date(t.completedAt) <= new Date(plan.deadline),
  );

  if (allOnTime) {
    await User.findByIdAndUpdate(userId, {
      $push: { badges: { badgeId: 'honor_student', earnedAt: new Date() } },
    });
  }
}

export async function evaluateStudentOfYear(
  userId: string | Types.ObjectId,
  year: number,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  if (user.badges.some(b => b.badgeId === 'student_of_year' && b.year === year)) return;

  const reports = await Report.find({ userId, year }).lean();
  const reportsWithPlan = reports.filter(r => r.learningPlan);
  if (reportsWithPlan.length === 0) return;

  const allOnTime = reportsWithPlan.every(r => {
    const plan = r.learningPlan!;
    if (!plan.tasks.length) return false;
    return plan.tasks.every(
      (t: { isCompleted: boolean; completedAt?: Date }) =>
        t.isCompleted && t.completedAt && new Date(t.completedAt) <= new Date(plan.deadline),
    );
  });

  if (allOnTime) {
    await User.findByIdAndUpdate(userId, {
      $push: { badges: { badgeId: 'student_of_year', earnedAt: new Date(), year } },
    });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/constants/badges.ts backend/src/services/badgeService.ts
git commit -m "feat: add badgeService with evaluation logic for all badge types"
```

---

### Task 3: Backend — API endpoints and route hooks

**Files:**
- Modify: `backend/src/routes/reports.ts`
- Modify: `backend/src/routes/users.ts`

**Interfaces:**
- Consumes: `evaluateOnReportConfirm`, `evaluateOnLearningPlanComplete`, `evaluateStudentOfYear` from Task 2
- Produces:
  - `GET /api/reports/my/badges` → `BadgeAward[]`
  - `GET /api/users/:id/badges` → `BadgeAward[]`
  - `POST /api/users/:id/badges` body `{ badgeId, earnedAt?, year?, manual? }` → updated `BadgeAward[]`
  - `DELETE /api/users/:id/badges/:awardId` → `{ message: string }`
  - `POST /api/users/evaluate-student-of-year` body `{ year }` → `{ evaluated: number }`

- [ ] **Step 1: Add import and GET /my/badges to reports.ts**

At the top of `backend/src/routes/reports.ts`, add to the existing imports:

```typescript
import { evaluateOnReportConfirm, evaluateOnLearningPlanComplete } from '../services/badgeService';
```

Add this route after the existing `GET /my/transactions` route (around line 363):

```typescript
// GET /api/reports/my/badges — badges for current employee
router.get('/my/badges', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизовано' });
    const user = await User.findById(userId, 'badges').lean();
    return res.json(user?.badges ?? []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});
```

- [ ] **Step 2: Hook evaluateOnReportConfirm into POST /confirm**

In the `POST /api/reports/confirm` handler, after the line `await syncStreakBonuses(userId, Number(year));`, add:

```typescript
evaluateOnReportConfirm(userId, report._id as import('mongoose').Types.ObjectId)
  .catch(err => console.error('[badge] report eval failed:', err));
```

- [ ] **Step 3: Hook evaluateOnLearningPlanComplete into PATCH /learning-plan/:taskIndex**

In `PATCH /api/reports/:id/learning-plan/:taskIndex`, after `await report.save();` and before `return res.json(report);`, add:

```typescript
if (report.learningPlan?.tasks.every(t => t.isCompleted)) {
  evaluateOnLearningPlanComplete(report.userId.toString(), report._id.toString())
    .catch(err => console.error('[badge] learning plan eval failed:', err));
}
```

- [ ] **Step 4: Add badge management routes to users.ts**

Add import at top of `backend/src/routes/users.ts`:

```typescript
import { Types } from 'mongoose';
import { evaluateStudentOfYear } from '../services/badgeService';
```

Add these routes before `export default router;`:

```typescript
// GET /api/users/:id/badges — list badge awards for a user (admin)
router.get('/:id/badges', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id, 'badges').lean();
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.json(user.badges ?? []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/users/:id/badges — manually assign a badge (admin)
router.post('/:id/badges', async (req: AuthRequest, res: Response) => {
  try {
    const { badgeId, earnedAt, year, manual } = req.body as {
      badgeId: string;
      earnedAt?: string;
      year?: number;
      manual?: boolean;
    };
    if (!badgeId) return res.status(400).json({ message: 'badgeId обовʼязковий' });

    const award = {
      badgeId,
      earnedAt: earnedAt ? new Date(earnedAt) : new Date(),
      ...(year !== undefined && { year: Number(year) }),
      manual: manual !== false,
    };

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $push: { badges: award } },
      { new: true, select: 'badges' },
    );
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.status(201).json(user.badges);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// DELETE /api/users/:id/badges/:awardId — remove a specific badge award (admin)
router.delete('/:id/badges/:awardId', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { badges: { _id: new Types.ObjectId(req.params.awardId) } } },
      { new: true, select: 'badges' },
    );
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.json({ message: 'Нагороду видалено' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/users/evaluate-student-of-year — trigger Студент року evaluation for all employees (admin)
router.post('/evaluate-student-of-year', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.body as { year?: number };
    const evalYear = year ?? new Date().getFullYear();
    const employees = await User.find({ role: 'EMPLOYEE' }, '_id').lean();
    await Promise.all(employees.map(u => evaluateStudentOfYear(u._id.toString(), evalYear)));
    return res.json({ message: `Оцінено ${employees.length} працівників`, evaluated: employees.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});
```

**Important:** the `POST /evaluate-student-of-year` route must be registered **before** `POST /:id` routes to avoid param capture. Move it above the `router.post('/:id', ...)` handler, or place it before the parametric routes section.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Build and start the backend, verify endpoints with curl**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npm run build && npm start &
sleep 3

# Get a token (replace phone/password with real credentials)
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"<admin_phone>","password":"<admin_pass>"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Check GET /my/badges (employee token needed — use employee credentials)
curl -s http://localhost:5000/api/reports/my/badges \
  -H "Authorization: Bearer $TOKEN"
# Expected: [] or array of badge awards

# Manually assign a badge to first employee
USER_ID=$(curl -s http://localhost:5000/api/users \
  -H "Authorization: Bearer $TOKEN" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -s -X POST http://localhost:5000/api/users/$USER_ID/badges \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"badgeId":"first_report","manual":true}'
# Expected: array with the new badge award including _id

AWARD_ID=$(curl -s http://localhost:5000/api/users/$USER_ID/badges \
  -H "Authorization: Bearer $TOKEN" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -s -X DELETE http://localhost:5000/api/users/$USER_ID/badges/$AWARD_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"message":"Нагороду видалено"}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/reports.ts backend/src/routes/users.ts
git commit -m "feat: add badge API endpoints and hook evaluation into report/learning-plan routes"
```

---

### Task 4: Frontend — Types, badge catalogue, service functions

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/constants/badges.ts`
- Modify: `frontend/src/services/reportsService.ts`
- Modify: `frontend/src/services/usersService.ts`

**Interfaces:**
- Produces:
  - `BadgeId` type, `BadgeAward` interface (consumed by Tasks 5, 6, 7)
  - `BadgeDef` interface, `BADGE_CATALOGUE: BadgeDef[]` (consumed by Tasks 5, 6, 7)
  - `getMyBadges(): Promise<BadgeAward[]>` (consumed by Task 6)
  - `getUserBadges(userId): Promise<BadgeAward[]>` (consumed by Task 7)
  - `assignBadge(userId, payload): Promise<BadgeAward[]>` (consumed by Task 7)
  - `deleteBadge(userId, awardId): Promise<void>` (consumed by Task 7)

- [ ] **Step 1: Add types to frontend/src/types.ts**

Append to the end of `frontend/src/types.ts`:

```typescript
export type BadgeId =
  | 'first_report'
  | 'first_perfect'
  | 'honor_student'
  | 'student_of_year'
  | 'clean_form'
  | 'silver_guide'
  | 'gold_series'
  | 'platinum_standard'
  | 'comeback';

export interface BadgeAward {
  _id: string;
  badgeId: BadgeId;
  earnedAt: string;
  year?: number;
  manual?: boolean;
}
```

- [ ] **Step 2: Create frontend/src/constants/badges.ts**

```typescript
import { BadgeId } from '../types';

export interface BadgeDef {
  badgeId: BadgeId;
  category: 'Старт' | 'Навчання' | 'Якість' | 'Серія' | 'Камбек';
  name: string;
  icon: string;
  color: string;
  condition: string;
}

export const BADGE_CATALOGUE: BadgeDef[] = [
  {
    badgeId: 'first_report',
    category: 'Старт',
    name: 'Перша перевірка',
    icon: 'fas fa-clipboard-check',
    color: 'text-blue-500',
    condition: 'Отримай перший звіт від таємного покупця',
  },
  {
    badgeId: 'first_perfect',
    category: 'Старт',
    name: 'Без розгону',
    icon: 'fas fa-rocket',
    color: 'text-orange-500',
    condition: 'Перший звіт у системі повинен бути на 100%',
  },
  {
    badgeId: 'honor_student',
    category: 'Навчання',
    name: 'Відмінник',
    icon: 'fas fa-graduation-cap',
    color: 'text-indigo-500',
    condition: 'Виконай план навчання вчасно після отримання анкети',
  },
  {
    badgeId: 'student_of_year',
    category: 'Навчання',
    name: 'Студент року',
    icon: 'fas fa-award',
    color: 'text-purple-500',
    condition: 'Усі плани навчання виконані вчасно за календарний рік',
  },
  {
    badgeId: 'clean_form',
    category: 'Якість',
    name: 'Чиста анкета',
    icon: 'fas fa-shield-halved',
    color: 'text-green-500',
    condition: 'Умова буде оголошена пізніше',
  },
  {
    badgeId: 'silver_guide',
    category: 'Серія',
    name: 'Срібний гід',
    icon: 'fas fa-medal',
    color: 'text-slate-400',
    condition: '2 квартали поспіль на 100% в одному році',
  },
  {
    badgeId: 'gold_series',
    category: 'Серія',
    name: 'Золота серія',
    icon: 'fas fa-medal',
    color: 'text-amber-400',
    condition: '3 квартали поспіль на 100% в одному році',
  },
  {
    badgeId: 'platinum_standard',
    category: 'Серія',
    name: 'Платиновий стандарт',
    icon: 'fas fa-crown',
    color: 'text-sky-400',
    condition: '4 квартали поспіль на 100% в одному році',
  },
  {
    badgeId: 'comeback',
    category: 'Камбек',
    name: 'Зробила висновки',
    icon: 'fas fa-arrow-trend-up',
    color: 'text-emerald-500',
    condition: 'Попередня анкета <85% з виконаним планом навчання → наступна 100%',
  },
];

export const BADGE_CATEGORIES = ['Старт', 'Навчання', 'Якість', 'Серія', 'Камбек'] as const;
export type BadgeCategory = typeof BADGE_CATEGORIES[number];

export const YEARLY_BADGE_IDS = new Set<BadgeId>([
  'silver_guide',
  'gold_series',
  'platinum_standard',
  'student_of_year',
]);
```

- [ ] **Step 3: Add getMyBadges to frontend/src/services/reportsService.ts**

Append to the end of `frontend/src/services/reportsService.ts`:

```typescript
export const getMyBadges = async (): Promise<import('../types').BadgeAward[]> => {
  const res = await fetch('/api/reports/my/badges', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження бейджів');
  return res.json();
};
```

- [ ] **Step 4: Add badge admin functions to frontend/src/services/usersService.ts**

Append to the end of `frontend/src/services/usersService.ts`:

```typescript
import type { BadgeAward } from '../types';

export const getUserBadges = async (userId: string): Promise<BadgeAward[]> => {
  const res = await fetch(`/api/users/${userId}/badges`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}` },
  });
  if (!res.ok) throw new Error('Помилка завантаження нагород');
  return res.json();
};

export interface AssignBadgePayload {
  badgeId: string;
  earnedAt?: string;
  year?: number;
}

export const assignBadge = async (userId: string, payload: AssignBadgePayload): Promise<BadgeAward[]> => {
  const res = await fetch(`/api/users/${userId}/badges`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, manual: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Помилка призначення нагороди');
  }
  return res.json();
};

export const deleteBadge = async (userId: string, awardId: string): Promise<void> => {
  const res = await fetch(`/api/users/${userId}/badges/${awardId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}` },
  });
  if (!res.ok) throw new Error('Помилка видалення нагороди');
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/constants/badges.ts \
        frontend/src/services/reportsService.ts frontend/src/services/usersService.ts
git commit -m "feat: add badge types, catalogue, and service functions"
```

---

### Task 5: Frontend — BadgeTile component

**Files:**
- Create: `frontend/src/components/BadgeTile.tsx`

**Interfaces:**
- Consumes: `BadgeAward` from `../types`; `BadgeDef` from `../constants/badges`
- Produces: `<BadgeTile def={BadgeDef} awards={BadgeAward[]} />` (consumed by Tasks 6 and 7)

- [ ] **Step 1: Create frontend/src/components/BadgeTile.tsx**

```tsx
import React, { useState, useRef } from 'react';
import { BadgeAward } from '../types';
import { BadgeDef } from '../constants/badges';

interface BadgeTileProps {
  def: BadgeDef;
  awards: BadgeAward[];
}

export const BadgeTile: React.FC<BadgeTileProps> = ({ def, awards }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earned = awards.length > 0;

  const tooltipText = earned
    ? awards
        .map(a => {
          const date = new Date(a.earnedAt).toLocaleDateString('uk-UA', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          });
          return a.year ? `${date} (${a.year})` : date;
        })
        .join('\n')
    : def.condition;

  const show = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowTooltip(true); };
  const hide = () => setShowTooltip(false);

  const handleTouchStart = () => {
    touchTimer.current = setTimeout(show, 500);
  };
  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    hideTimer.current = setTimeout(hide, 2000);
  };
  const handleTouchMove = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  return (
    <div
      className="relative p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center hover:bg-white transition-all cursor-default select-none"
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {awards.length > 1 && (
        <span className="absolute top-2 right-2 bg-kameya-burgundy text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {awards.length}
        </span>
      )}

      <i className={`${def.icon} text-3xl mb-2 ${earned ? def.color : 'text-slate-300'}`} />

      <p className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${earned ? 'text-slate-800' : 'text-slate-400'}`}>
        {def.name}
      </p>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-52 bg-slate-800 text-white text-xs rounded-xl px-3 py-2 text-center shadow-xl pointer-events-none whitespace-pre-line">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BadgeTile.tsx
git commit -m "feat: add BadgeTile component with hover and long-press tooltip"
```

---

### Task 6: Frontend — ProgressView badge section

**Files:**
- Modify: `frontend/src/components/ProgressView.tsx`

**Interfaces:**
- Consumes: `getMyBadges` from services; `BadgeTile` from Task 5; `BADGE_CATALOGUE`, `BADGE_CATEGORIES` from constants

- [ ] **Step 1: Update ProgressView.tsx**

Replace the full contents of `frontend/src/components/ProgressView.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { PointsTransaction, BadgeAward } from '../types';
import { getMyRank, UserRank, getMyPointsHistory, getMyBadges } from '../services/reportsService';
import { useAuth } from '../context/AuthContext';
import { BADGE_CATALOGUE, BADGE_CATEGORIES } from '../constants/badges';
import { BadgeTile } from './BadgeTile';

export const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const [rank, setRank] = useState<UserRank | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([getMyRank(), getMyPointsHistory(), getMyBadges()])
      .then(([rankData, txData, badgeData]) => {
        setRank(rankData);
        setTransactions(txData);
        setBadges(badgeData);
      })
      .catch(() => console.error('Помилка завантаження даних'))
      .finally(() => setLoading(false));
  }, []);

  const totalPoints = loading ? 0 : transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
  const lastThree = transactions.slice(0, 3);

  const txLabel = (tx: PointsTransaction) => {
    if (tx.reason === 'birthday') return `🎂 День народження ${tx.birthdayYear ?? tx.year}`;
    if (tx.reason === 'streak')   return `🔥 Стрік ${tx.streakQuarters} кварт. ${tx.streakYear ?? tx.year}`;
    if (tx.reason === 'reflection' || (tx.reason == null && tx.scorePercent === 0))
      return `Рефлексія ${tx.quarter ?? ''} ${tx.year}`;
    return `${tx.quarter ?? ''} ${tx.year} — ${Math.floor(tx.scorePercent)}%`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Досягнення та Бали</h2>
        <p className="text-slate-500">Ваш шлях професійного зростання в Kameya Academy.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Points card */}
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 flex flex-col relative overflow-hidden group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-kameya-burgundy/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
              <i className="fas fa-gem text-kameya-burgundy text-2xl" />
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Накопичено балів</p>
              <h3 className="text-5xl font-bold text-kameya-burgundy tracking-tighter">
                {loading ? '...' : totalPoints}
              </h3>
            </div>
          </div>

          {lastThree.length > 0 && (
            <div className="space-y-2 mt-2">
              {lastThree.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 truncate">{txLabel(tx)}</span>
                  <span className={`font-semibold flex-shrink-0 ml-2 ${tx.pointsAwarded > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {tx.pointsAwarded > 0 ? `+${tx.pointsAwarded}` : '0'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {transactions.length > 0 && (
            <button
              onClick={() => setShowHistory(true)}
              className="mt-4 text-xs text-kameya-burgundy font-semibold hover:opacity-75 self-start"
            >
              Детальніше →
            </button>
          )}

          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl" />
        </div>

        {/* Network rank card */}
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 flex flex-col justify-center relative overflow-hidden">
          {rank ? (
            <>
              <div className="absolute top-5 right-5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                <i className="fas fa-layer-group text-amber-500 text-xs" />
                <span className="text-amber-700 font-bold text-xs uppercase tracking-wide">{rank.tier}</span>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <i className="fas fa-trophy text-amber-400 text-3xl mb-1" />
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-0.5">Місце в мережі</p>
                  <p className="text-5xl font-bold text-slate-800 tracking-tighter leading-none">#{rank.rank}</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-3">
                з <span className="font-semibold text-slate-600">{rank.totalUsers}</span> учасників · Продовжуйте зростати!
              </p>
            </>
          ) : (
            <p className="text-slate-400 text-sm">{loading ? 'Завантаження...' : 'Дані рейтингу відсутні'}</p>
          )}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-50 rounded-full blur-2xl" />
        </div>
      </div>

      {/* Badges section */}
      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <i className="fas fa-medal text-amber-500" />
          Ваші значки
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300" />
          </div>
        ) : (
          <div className="space-y-6">
            {BADGE_CATEGORIES.map(category => {
              const defs = BADGE_CATALOGUE.filter(b => b.category === category);
              return (
                <div key={category}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{category}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {defs.map(def => (
                      <BadgeTile
                        key={def.badgeId}
                        def={def}
                        awards={badges.filter(a => a.badgeId === def.badgeId)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Points history modal */}
      {showHistory && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Історія балів</h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {transactions.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Транзакцій ще немає</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx._id} className="flex items-center justify-between py-3 px-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{txLabel(tx)}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      tx.pointsAwarded > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {tx.pointsAwarded > 0 ? `+${tx.pointsAwarded}` : '0'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Start frontend dev server and check visually**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npm run dev
```

Open browser → login as employee → navigate to "Мій прогрес". Expected:
- 5 category sections (Старт, Навчання, Якість, Серія, Камбек) visible
- All badges greyed out (no awards yet)
- Hovering a badge shows condition text in tooltip

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProgressView.tsx
git commit -m "feat: update ProgressView to display badges in 5 category groups with tooltips"
```

---

### Task 7: Frontend — Admin UsersView badge modal

**Files:**
- Create: `frontend/src/components/admin/BadgesModal.tsx`
- Modify: `frontend/src/components/admin/UsersView.tsx`

**Interfaces:**
- Consumes: `getUserBadges`, `assignBadge`, `deleteBadge` from Task 4; `BadgeTile` from Task 5; `BADGE_CATALOGUE`, `BADGE_CATEGORIES`, `YEARLY_BADGE_IDS` from constants; `UserListItem`, `BadgeAward` types

- [ ] **Step 1: Create frontend/src/components/admin/BadgesModal.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { UserListItem, BadgeAward, BadgeId } from '../../types';
import { getUserBadges, assignBadge, deleteBadge } from '../../services/usersService';
import { BADGE_CATALOGUE, BADGE_CATEGORIES, YEARLY_BADGE_IDS } from '../../constants/badges';
import { BadgeTile } from '../BadgeTile';

interface BadgesModalProps {
  user: UserListItem;
  onClose: () => void;
}

export const BadgesModal: React.FC<BadgesModalProps> = ({ user, onClose }) => {
  const [awards, setAwards] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<BadgeId | null>(null);
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignYear, setAssignYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState('');

  useEffect(() => {
    getUserBadges(user._id)
      .then(setAwards)
      .catch(() => setAwards([]))
      .finally(() => setLoading(false));
  }, [user._id]);

  const handleAssign = async (badgeId: BadgeId) => {
    setError('');
    try {
      const payload: { badgeId: string; earnedAt: string; year?: number } = {
        badgeId,
        earnedAt: new Date(assignDate).toISOString(),
      };
      if (YEARLY_BADGE_IDS.has(badgeId) && assignYear) {
        payload.year = Number(assignYear);
      }
      const updated = await assignBadge(user._id, payload);
      setAwards(updated);
      setAssigning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    }
  };

  const handleDelete = async (awardId: string) => {
    setError('');
    try {
      await deleteBadge(user._id, awardId);
      setAwards(prev => prev.filter(a => a._id !== awardId));
    } catch {
      setError('Помилка видалення');
    }
  };

  const toDisplay = (phone: string) => {
    const p = phone.slice(2);
    return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)}`;
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Нагороди</h3>
            <p className="text-sm text-slate-500">{user.name || toDisplay(user.phone)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-xmark text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-slate-300" />
            </div>
          ) : (
            BADGE_CATEGORIES.map(category => {
              const defs = BADGE_CATALOGUE.filter(b => b.category === category);
              return (
                <div key={category}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{category}</p>
                  <div className="space-y-3">
                    {defs.map(def => {
                      const defAwards = awards.filter(a => a.badgeId === def.badgeId);
                      const isAssigning = assigning === def.badgeId;
                      return (
                        <div key={def.badgeId} className="bg-slate-50 rounded-2xl p-4">
                          <div className="flex items-center gap-3">
                            {/* Badge preview */}
                            <div className="w-24 flex-shrink-0">
                              <BadgeTile def={def} awards={defAwards} />
                            </div>

                            {/* Awards list + controls */}
                            <div className="flex-1 min-w-0">
                              {defAwards.length === 0 ? (
                                <p className="text-xs text-slate-400 mb-2">Не отримано</p>
                              ) : (
                                <div className="space-y-1 mb-2">
                                  {defAwards.map(award => (
                                    <div key={award._id} className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-slate-600">
                                        {new Date(award.earnedAt).toLocaleDateString('uk-UA')}
                                        {award.year && ` (${award.year})`}
                                        {award.manual && <span className="ml-1 text-slate-400">[вручну]</span>}
                                      </span>
                                      <button
                                        onClick={() => handleDelete(award._id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                        title="Видалити нагороду"
                                      >
                                        <i className="fas fa-xmark text-xs" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isAssigning ? (
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <input
                                    type="date"
                                    value={assignDate}
                                    onChange={e => setAssignDate(e.target.value)}
                                    className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-kameya-burgundy/30"
                                  />
                                  {YEARLY_BADGE_IDS.has(def.badgeId) && (
                                    <input
                                      type="number"
                                      value={assignYear}
                                      onChange={e => setAssignYear(e.target.value)}
                                      placeholder="Рік"
                                      className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white w-20 focus:outline-none focus:ring-1 focus:ring-kameya-burgundy/30"
                                    />
                                  )}
                                  <button
                                    onClick={() => handleAssign(def.badgeId)}
                                    className="text-xs px-3 py-1 bg-kameya-burgundy text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                                  >
                                    Підтвердити
                                  </button>
                                  <button
                                    onClick={() => setAssigning(null)}
                                    className="text-xs px-3 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                  >
                                    Скасувати
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAssigning(def.badgeId);
                                    setAssignDate(new Date().toISOString().slice(0, 10));
                                    setAssignYear(String(new Date().getFullYear()));
                                    setError('');
                                  }}
                                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 transition-opacity"
                                >
                                  + Призначити
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: Add "Нагороди" button and modal state to UsersView.tsx**

In `frontend/src/components/admin/UsersView.tsx`:

Add import at the top:
```tsx
import { BadgesModal } from './BadgesModal';
```

Add state variables after the existing state declarations (around line 50):
```tsx
const [badgesUser, setBadgesUser] = useState<UserListItem | null>(null);
```

In the table row actions cell (inside `sortedUsers.map`), add a button before the existing edit button — only for EMPLOYEE users:
```tsx
{u.role === 'EMPLOYEE' && (
  <button
    onClick={() => setBadgesUser(u)}
    className="text-slate-400 hover:text-amber-500 transition-colors"
    title="Нагороди"
  >
    <i className="fas fa-medal" />
  </button>
)}
```

Add the modal at the end of the component return, before the closing `</div>`:
```tsx
{badgesUser && (
  <BadgesModal
    user={badgesUser}
    onClose={() => setBadgesUser(null)}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Verify in browser**

Start dev server (`npm run dev`), login as admin → "Користувачі".

Expected:
- Each employee row has a medal icon button
- Clicking it opens the modal with all 9 badges grouped by category
- "+ Призначити" opens inline form with date picker
- For Серія/Студент року badges, year field appears
- "Підтвердити" assigns the badge; it appears with date and `×` button
- Clicking `×` removes the specific award
- Badge tile in the modal reflects earned state in real time

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/BadgesModal.tsx \
        frontend/src/components/admin/UsersView.tsx
git commit -m "feat: add admin badge management modal to UsersView"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| `badges: IBadgeAward[]` in User | Task 1 |
| 9 badge definitions with badgeId | Task 2 (backend constants), Task 4 (frontend catalogue) |
| `first_report` condition | Task 2 `evaluateOnReportConfirm` |
| `first_perfect` condition | Task 2 `evaluateOnReportConfirm` |
| `honor_student` condition (on time) | Task 2 `evaluateOnLearningPlanComplete` |
| `student_of_year` condition | Task 2 `evaluateStudentOfYear` |
| `clean_form` defined but no eval | Task 4 (catalogue only, no eval logic) |
| Series badges (Q1→Q4, 100%, yearly) | Task 2 `calcSeriesMilestones` |
| `comeback` condition | Task 2 `evaluateOnReportConfirm` |
| Badge hooks in report confirm | Task 3 reports.ts |
| Badge hook in learning plan task toggle | Task 3 reports.ts |
| `GET /api/reports/my/badges` | Task 3 reports.ts |
| `GET/POST/DELETE /api/users/:id/badges` | Task 3 users.ts |
| Admin manual student-of-year trigger | Task 3 `POST /users/evaluate-student-of-year` |
| Idempotency for one-time badges | Task 2 `has()` guard |
| Idempotency for yearly badges | Task 2 `hasForYear()` guard |
| Idempotency for comeback | Task 2 historical count vs existing count |
| Frontend: 5 category groups | Task 6 ProgressView |
| Frontend: earned/unearned tile states | Task 5 BadgeTile |
| Frontend: count chip for repeatable | Task 5 BadgeTile `awards.length > 1` |
| Hover tooltip earned → dates | Task 5 BadgeTile |
| Hover tooltip unearned → condition | Task 5 BadgeTile |
| Long-press (500ms) on mobile | Task 5 BadgeTile `handleTouchStart` |
| Admin "Нагороди" button in table | Task 7 UsersView |
| Admin modal: view/assign/delete | Task 7 BadgesModal |
| Year field for yearly badges in modal | Task 7 `YEARLY_BADGE_IDS.has(def.badgeId)` |
