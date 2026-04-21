# Points System & Q-Period Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cumulative points system for employees based on mystery shopper scores, tag reports with quarter/year periods, and show points/period labels everywhere in the UI.

**Architecture:** Hybrid approach — `User.points` for fast balance reads, `PointsTransaction` model for full audit history. Points are calculated and awarded atomically when admin confirms a report. A shared `scoreColor` utility replaces duplicated local functions across components.

**Tech Stack:** Express + Mongoose (backend), React + TypeScript + Tailwind CSS (frontend). No test framework is configured in this project — each task ends with a manual verification step and a git commit.

**Spec:** `docs/superpowers/specs/2026-04-21-points-system-design.md`

---

## File Map

**Backend — modified:**
- `backend/src/models/User.ts` — add `points` field
- `backend/src/models/Report.ts` — add `quarter`, `year` fields
- `backend/src/routes/reports.ts` — update `confirm` to award points; update `GET /` to include quarter/year
- `backend/src/routes/users.ts` — add `GET /api/users/:id/points`
- `backend/src/routes/auth.ts` — include `store` and `points` in login response

**Backend — created:**
- `backend/src/models/PointsTransaction.ts` — new model
- `backend/src/services/pointsService.ts` — calculation + award logic

**Frontend — modified:**
- `frontend/src/types.ts` — add `quarter`, `year` to `AuditResult`; add `points` to `AuthUser` and `UserListItem`; add `PointsTransaction` type
- `frontend/src/services/reportsService.ts` — add `quarter`/`year` to `ConfirmReportPayload`
- `frontend/src/services/usersService.ts` — add `getUserPointsHistory`
- `frontend/src/components/admin/ReportsUploadView.tsx` — year/quarter selects; show awarded points on done screen
- `frontend/src/components/admin/AdminReportsListView.tsx` — accordion grouped by Q period; use `scoreColor` utility
- `frontend/src/components/admin/UsersView.tsx` — show points balance; add points history modal
- `frontend/src/components/employee/MyReportsView.tsx` — Q period label; use `scoreColor` utility
- `frontend/src/components/Dashboard.tsx` — points balance card

**Frontend — created:**
- `frontend/src/utils/scoreColor.ts` — unified score color/icon utility

---

## Task 1: Backend Models

**Files:**
- Modify: `backend/src/models/User.ts`
- Modify: `backend/src/models/Report.ts`
- Create: `backend/src/models/PointsTransaction.ts`

- [ ] **Step 1: Add `points` field to User model**

In `backend/src/models/User.ts`, update `IUser` interface and `UserSchema`:

```typescript
export interface IUser extends Document {
  phone: string;
  password: string;
  name: string;
  position?: string;
  store?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  points: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name:     { type: String, default: '' },
    position: { type: String },
    store:    { type: String },
    role:     { type: String, enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' },
    points:   { type: Number, default: 0 },
  },
  { timestamps: true }
);
```

- [ ] **Step 2: Add `quarter` and `year` fields to Report model**

In `backend/src/models/Report.ts`, update `IReport` interface and `ReportSchema`:

```typescript
export interface IReport extends Document {
  userId: Types.ObjectId;
  auditId: string;
  location: string;
  store: string;
  date: string;
  quarter: string;
  year: number;
  totalScore: number;
  sections: ISection[];
  fileName: string;
  createdAt: Date;
}

// In ReportSchema, add after fileName:
quarter:    { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], default: 'Q1' },
year:       { type: Number, default: new Date().getFullYear() },
```

- [ ] **Step 3: Create PointsTransaction model**

Create `backend/src/models/PointsTransaction.ts`:

```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPointsTransaction extends Document {
  userId: Types.ObjectId;
  reportId: Types.ObjectId;
  quarter: string;
  year: number;
  scorePercent: number;
  pointsAwarded: number;
  createdAt: Date;
}

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportId:      { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    quarter:       { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], required: true },
    year:          { type: Number, required: true },
    scorePercent:  { type: Number, required: true },
    pointsAwarded: { type: Number, required: true },
  },
  { timestamps: true }
);

export const PointsTransaction = mongoose.model<IPointsTransaction>('PointsTransaction', PointsTransactionSchema);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/User.ts backend/src/models/Report.ts backend/src/models/PointsTransaction.ts
git commit -m "feat: add points field to User, quarter/year to Report, create PointsTransaction model"
```

---

## Task 2: Backend Points Service

**Files:**
- Create: `backend/src/services/pointsService.ts`

- [ ] **Step 1: Create the points calculation and award service**

Create `backend/src/services/pointsService.ts`:

```typescript
import { Types } from 'mongoose';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

export function calculatePoints(totalScore: number): number {
  const floored = Math.floor(totalScore);
  if (floored === 100) return 200;
  if (floored >= 95)   return 150;
  if (floored >= 90)   return 100;
  if (floored >= 80)   return 50;
  return 0;
}

export async function awardPoints(params: {
  userId: Types.ObjectId | string;
  reportId: Types.ObjectId | string;
  quarter: string;
  year: number;
  totalScore: number;
}): Promise<{ pointsAwarded: number; totalPoints: number }> {
  const { userId, reportId, quarter, year, totalScore } = params;
  const pointsAwarded = calculatePoints(totalScore);

  await PointsTransaction.create({
    userId,
    reportId,
    quarter,
    year,
    scorePercent: totalScore,
    pointsAwarded,
  });

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { points: pointsAwarded } },
    { new: true }
  );

  return {
    pointsAwarded,
    totalPoints: updated?.points ?? 0,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/pointsService.ts
git commit -m "feat: add points calculation and award service"
```

---

## Task 3: Backend Routes

**Files:**
- Modify: `backend/src/routes/reports.ts`
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Update `POST /api/reports/confirm` to accept quarter/year and award points**

In `backend/src/routes/reports.ts`, add the import at the top:

```typescript
import { awardPoints } from '../services/pointsService';
```

Replace the `router.post('/confirm', ...)` handler body with:

```typescript
router.post('/confirm', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const { userId, auditId, location, date, totalScore, sections, fileName, quarter, year } = req.body;

    if (!userId || !date || totalScore === undefined || !quarter || !year) {
      return res.status(400).json({ message: 'Не вистачає обов\'язкових полів' });
    }

    const user = await User.findById(userId);
    const store = user?.store || '';

    const report = await Report.create({
      userId, auditId, location, store, date,
      quarter, year: Number(year),
      totalScore, sections, fileName,
    });

    const { pointsAwarded, totalPoints } = await awardPoints({
      userId,
      reportId: report._id as import('mongoose').Types.ObjectId,
      quarter,
      year: Number(year),
      totalScore,
    });

    return res.status(201).json({ ...report.toObject(), pointsAwarded, totalPoints });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка збереження' });
  }
});
```

- [ ] **Step 2: Add `GET /api/users/:id/points` to users routes**

In `backend/src/routes/users.ts`, add this import at the top:

```typescript
import { PointsTransaction } from '../models/PointsTransaction';
```

Add this route before `export default router`:

```typescript
// GET /api/users/:id/points — history of points transactions for a user (admin only)
router.get('/:id/points', async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await PointsTransaction.find({ userId: req.params.id })
      .populate('reportId', 'fileName date')
      .sort({ createdAt: -1 });
    return res.json(transactions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});
```

- [ ] **Step 3: Update auth login response to include `store` and `points`**

In `backend/src/routes/auth.ts`, update the response inside `router.post('/login', ...)`:

```typescript
return res.json({
  token,
  user: {
    id: user._id,
    phone: user.phone,
    name: user.name,
    position: user.position ?? null,
    store: user.store ?? null,
    role: user.role,
    points: user.points ?? 0,
  },
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test — start backend and test confirm endpoint**

```bash
cd backend && npm run dev
```

In another terminal (replace TOKEN and IDs with real values from your DB):
```bash
curl -X POST http://localhost:3001/api/reports/confirm \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","auditId":"test","location":"test","date":"2026-04-21","totalScore":92,"sections":[],"fileName":"test.pdf","quarter":"Q1","year":2026}'
```

Expected: JSON response with `pointsAwarded: 100` and `totalPoints: 100`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/reports.ts backend/src/routes/users.ts backend/src/routes/auth.ts
git commit -m "feat: update confirm endpoint to award points, add points history route, include store/points in auth response"
```

---

## Task 4: Frontend Types and Services

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/reportsService.ts`
- Modify: `frontend/src/services/usersService.ts`

- [ ] **Step 1: Update `types.ts`**

In `frontend/src/types.ts`:

1. Add `quarter` and `year` to `AuditResult`:
```typescript
export interface AuditResult {
  _id?: string;
  id?: string;
  auditId?: string;
  location?: string;
  store?: string;
  date: string;
  quarter?: string;
  year?: number;
  totalScore: number;
  sections: AuditSection[];
  fileName?: string;
  userId?: string;
  createdAt?: string;
}
```

2. Add `points` to `AuthUser`:
```typescript
export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  position: string | null;
  store: string | null;
  role: string;
  points: number;
}
```

3. Add `points` to `UserListItem`:
```typescript
export interface UserListItem {
  _id: string;
  phone: string;
  name: string;
  position?: string;
  store?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  points?: number;
  createdAt: string;
}
```

4. Add `PointsTransaction` interface (add after `UserListItem`):
```typescript
export interface PointsTransaction {
  _id: string;
  userId: string;
  reportId: { _id: string; fileName: string; date: string } | string;
  quarter: string;
  year: number;
  scorePercent: number;
  pointsAwarded: number;
  createdAt: string;
}
```

- [ ] **Step 2: Update `ConfirmReportPayload` in reportsService**

In `frontend/src/services/reportsService.ts`, update:

```typescript
export interface ConfirmReportPayload {
  userId: string;
  auditId: string;
  location: string;
  date: string;
  totalScore: number;
  sections: AuditResult['sections'];
  fileName: string;
  quarter: string;
  year: number;
}

export interface ConfirmReportResponse extends AuditResult {
  pointsAwarded: number;
  totalPoints: number;
}

export const confirmReport = async (data: ConfirmReportPayload): Promise<ConfirmReportResponse> => {
  const res = await fetch('/api/reports/confirm', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка збереження звіту');
  }
  return res.json();
};
```

- [ ] **Step 3: Add `getUserPointsHistory` to usersService**

In `frontend/src/services/usersService.ts`, add at the end of the file:

```typescript
import { PointsTransaction } from '../types';

export const getUserPointsHistory = async (userId: string): Promise<PointsTransaction[]> => {
  const res = await fetch(`/api/users/${userId}/points`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}` },
  });
  if (!res.ok) throw new Error('Помилка завантаження історії балів');
  return res.json();
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors (there will be errors in components due to missing quarter/year props — fix those in subsequent tasks).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/reportsService.ts frontend/src/services/usersService.ts
git commit -m "feat: add quarter/year/points to frontend types, update report service payload"
```

---

## Task 5: Shared scoreColor Utility

**Files:**
- Create: `frontend/src/utils/scoreColor.ts`
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx` (remove local scoreColor/scoreBg)
- Modify: `frontend/src/components/admin/ReportsUploadView.tsx` (remove local scoreColor)
- Modify: `frontend/src/components/employee/MyReportsView.tsx` (remove local scoreColor/scoreBg)

- [ ] **Step 1: Create the shared utility**

Create `frontend/src/utils/scoreColor.ts`:

```typescript
export interface ScoreStyle {
  textClass: string;
  bgClass: string;
  borderClass: string;
  icon?: string;
}

export function getScoreStyle(totalScore: number): ScoreStyle {
  const s = Math.floor(totalScore);
  if (s === 100) return {
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-200',
    icon: '🏆',
  };
  if (s >= 95) return {
    textClass: 'text-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
  };
  if (s >= 80) return {
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-200',
  };
  return {
    textClass: 'text-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
  };
}

export function scoreTextClass(totalScore: number): string {
  return getScoreStyle(totalScore).textClass;
}

export function scoreBgBorderClass(totalScore: number): string {
  const s = getScoreStyle(totalScore);
  return `${s.bgClass} ${s.borderClass}`;
}

export function formatScore(totalScore: number): string {
  const s = getScoreStyle(totalScore);
  const pct = `${Math.floor(totalScore)}%`;
  return s.icon ? `${s.icon} ${pct}` : pct;
}
```

- [ ] **Step 2: Replace local `scoreColor` / `scoreBg` in `AdminReportsListView.tsx`**

At the top of `frontend/src/components/admin/AdminReportsListView.tsx`:

1. Add import:
```typescript
import { scoreTextClass, scoreBgBorderClass, formatScore } from '../../utils/scoreColor';
```

2. Delete the local `scoreColor` and `scoreBg` functions (lines 15–25).

3. Replace every call to `scoreColor(...)` with `scoreTextClass(...)` and every call to `scoreBg(...)` with `scoreBgBorderClass(...)` throughout the file.

4. Where the score percentage text is displayed as `{Math.round(selected.totalScore)}%`, change to `{formatScore(selected.totalScore)}`.

- [ ] **Step 3: Replace local `scoreColor` in `ReportsUploadView.tsx`**

1. Add import:
```typescript
import { scoreTextClass } from '../../utils/scoreColor';
```

2. Delete the local `scoreColor` function (lines 115–119).

3. Replace every `scoreColor(...)` call with `scoreTextClass(...)`.

- [ ] **Step 4: Replace local `scoreColor` / `scoreBg` in `MyReportsView.tsx`**

1. Add import:
```typescript
import { scoreTextClass, scoreBgBorderClass, formatScore } from '../../utils/scoreColor';
```

2. Delete local `scoreColor` and `scoreBg` functions (lines 7–17).

3. Replace every `scoreColor(...)` with `scoreTextClass(...)` and `scoreBg(...)` with `scoreBgBorderClass(...)`.

4. Where score percentage is shown as `{Math.round(report.totalScore)}%`, change to `{formatScore(report.totalScore)}`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/scoreColor.ts frontend/src/components/admin/AdminReportsListView.tsx frontend/src/components/admin/ReportsUploadView.tsx frontend/src/components/employee/MyReportsView.tsx
git commit -m "feat: add shared scoreColor utility, replace duplicated local functions"
```

---

## Task 6: Admin — ReportsUploadView with Quarter/Year

**Files:**
- Modify: `frontend/src/components/admin/ReportsUploadView.tsx`

- [ ] **Step 1: Add state for quarter and year**

In `ReportsUploadView`, add after `const [showDetailedPreview, setShowDetailedPreview] = useState(false);`:

```typescript
const currentYear = new Date().getFullYear();
const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
const [selectedYear, setSelectedYear] = useState<number>(currentYear);
const [awardedPoints, setAwardedPoints] = useState<number | null>(null);
```

- [ ] **Step 2: Update `handleConfirm` to pass quarter/year and capture pointsAwarded**

Replace the `handleConfirm` function:

```typescript
const handleConfirm = async () => {
  if (!parsed) return;
  setError(null);
  setStep('saving');
  try {
    const result = await confirmReport({
      userId: selectedUserId,
      auditId: parsed.auditId ?? '',
      location: parsed.location ?? '',
      date: parsed.date,
      totalScore: parsed.totalScore,
      sections: parsed.sections,
      fileName: parsed.fileName,
      quarter: selectedQuarter,
      year: selectedYear,
    });
    setAwardedPoints(result.pointsAwarded);
    setStep('done');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Помилка збереження');
    setStep('preview');
  }
};
```

- [ ] **Step 3: Add year/quarter selects to the form**

In the `select` step form, after the employee dropdown and before the PDF upload area, add:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Рік</label>
    <select
      value={selectedYear}
      onChange={(e) => setSelectedYear(Number(e.target.value))}
      disabled={step === 'parsing'}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy disabled:opacity-50"
    >
      <option value={2025}>2025</option>
      <option value={2026}>2026</option>
    </select>
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Квартал</label>
    <select
      value={selectedQuarter}
      onChange={(e) => setSelectedQuarter(e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
      disabled={step === 'parsing'}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy disabled:opacity-50"
    >
      <option value="Q1">Q1</option>
      <option value="Q2">Q2</option>
      <option value="Q3">Q3</option>
      <option value="Q4">Q4</option>
    </select>
  </div>
</div>
```

- [ ] **Step 4: Update `handleReset` to clear quarter/year state**

In `handleReset`, add:
```typescript
setSelectedQuarter('Q1');
setSelectedYear(currentYear);
setAwardedPoints(null);
```

- [ ] **Step 5: Update done screen to show awarded points**

Replace the done screen JSX:

```tsx
if (step === 'done') {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <i className="fas fa-circle-check text-4xl text-green-500"></i>
      </div>
      <h2 className="text-2xl font-bold text-slate-800">Звіт збережено!</h2>
      <p className="text-slate-500">
        Звіт <span className="font-semibold text-slate-700">{selectedQuarter} {selectedYear}</span> прив'язано до{' '}
        <span className="font-semibold text-slate-700">{selectedEmployee?.name}</span>
      </p>
      {awardedPoints !== null && (
        <div className={`px-6 py-3 rounded-xl text-sm font-semibold ${
          awardedPoints > 0
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-slate-50 text-slate-600 border border-slate-200'
        }`}>
          {awardedPoints > 0
            ? `+${awardedPoints} балів нараховано`
            : 'Бали не нараховано (результат < 80%)'}
        </div>
      )}
      <button
        onClick={handleReset}
        className="mt-4 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors"
      >
        Завантажити ще один звіт
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/ReportsUploadView.tsx
git commit -m "feat: add quarter/year selects to upload form, show awarded points on success"
```

---

## Task 7: Admin — AdminReportsListView with Q Period Accordion

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

- [ ] **Step 1: Add accordion open state and grouping logic**

After existing state declarations, add:

```typescript
const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

const toggleGroup = (key: string) => {
  setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
};

const quarterOrder = { Q4: 0, Q3: 1, Q2: 2, Q1: 3 };

const groupedReports = filtered.reduce<Record<string, ReportWithUser[]>>((acc, report) => {
  const quarter = report.quarter ?? 'Q1';
  const year = report.year ?? new Date().getFullYear();
  const key = `${quarter} ${year}`;
  if (!acc[key]) acc[key] = [];
  acc[key].push(report);
  return acc;
}, {});

const sortedGroupKeys = Object.keys(groupedReports).sort((a, b) => {
  const [qa, ya] = a.split(' ');
  const [qb, yb] = b.split(' ');
  if (Number(yb) !== Number(ya)) return Number(yb) - Number(ya);
  return (quarterOrder[qa as keyof typeof quarterOrder] ?? 99) - (quarterOrder[qb as keyof typeof quarterOrder] ?? 99);
});
```

Also add `quarter` and `year` to the `ReportWithUser` interface:
```typescript
interface ReportWithUser extends Omit<AuditResult, 'userId'> {
  userId: { _id: string; name: string; phone: string; store?: string } | string;
  quarter?: string;
  year?: number;
}
```

- [ ] **Step 2: Replace the list view with accordion UI**

In the list view section (the `// ── List view ──` block), replace the `filtered.map(...)` section with the accordion:

```tsx
{sortedGroupKeys.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <i className="fas fa-folder-open text-2xl text-slate-300"></i>
    </div>
    <p className="text-slate-500 font-medium">{reports.length === 0 ? 'Звітів ще немає' : 'Нічого не знайдено'}</p>
  </div>
) : (
  <div className="space-y-3">
    {sortedGroupKeys.map((groupKey) => {
      const groupReports = groupedReports[groupKey];
      const isOpen = openGroups.has(groupKey);
      return (
        <div key={groupKey} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => toggleGroup(groupKey)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-800 text-lg">{groupKey}</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {groupReports.length} {groupReports.length === 1 ? 'звіт' : 'звітів'}
              </span>
            </div>
            <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-slate-400 text-sm`}></i>
          </button>

          {isOpen && (
            <div className="border-t border-slate-100 divide-y divide-slate-50">
              {groupReports.map((report) => {
                const id = report._id ?? report.id ?? '';
                const style = getScoreStyle(report.totalScore);
                return (
                  <button
                    key={id}
                    onClick={() => { setSelected(report); setExpandedSection(null); }}
                    className="w-full px-5 py-3 hover:bg-slate-50 transition-colors text-left flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${style.bgClass} ${style.borderClass}`}>
                        <span className={`text-sm font-bold ${style.textClass}`}>
                          {style.icon ?? `${Math.floor(report.totalScore)}%`}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{getUserName(report)}</p>
                        <p className="text-xs text-slate-500">{getUserPhone(report)}</p>
                        <p className="text-xs text-slate-400">{formatDate(report.date)}{getStoreFromReport(report) ? ` · ${getStoreFromReport(report)}` : ''}</p>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right text-slate-300 text-sm"></i>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
```

Add `getScoreStyle` to the import from scoreColor utility:
```typescript
import { scoreTextClass, scoreBgBorderClass, formatScore, getScoreStyle } from '../../utils/scoreColor';
```

- [ ] **Step 3: Also update the detail view percentage display**

In the detail view, replace `{Math.round(selected.totalScore)}%` with `{formatScore(selected.totalScore)}` and update color classes to use `scoreTextClass(selected.totalScore)` and `scoreBgBorderClass(selected.totalScore)`.

- [ ] **Step 4: Show Q period label in detail view header**

In the detail view header, update the subtitle:
```tsx
<p className="text-xs text-slate-400">
  {selected.quarter && selected.year ? `${selected.quarter} ${selected.year} · ` : ''}
  {phone} · {formatDate(selected.date)}{getStoreFromReport(selected) ? ` · ${getStoreFromReport(selected)}` : ''}
</p>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: group admin reports list by Q period in accordion, add period label to detail view"
```

---

## Task 8: Admin — UsersView with Points and History Modal

**Files:**
- Modify: `frontend/src/components/admin/UsersView.tsx`

- [ ] **Step 1: Add points history state and fetch function**

In `UsersView`, add imports:
```typescript
import { getUserPointsHistory } from '../../services/usersService';
import { PointsTransaction } from '../../types';
```

Add state:
```typescript
const [pointsUser, setPointsUser] = useState<UserListItem | null>(null);
const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([]);
const [pointsLoading, setPointsLoading] = useState(false);
```

Add handler:
```typescript
const openPointsHistory = async (u: UserListItem) => {
  setPointsUser(u);
  setPointsLoading(true);
  try {
    const history = await getUserPointsHistory(u._id);
    setPointsHistory(history);
  } catch {
    setPointsHistory([]);
  } finally {
    setPointsLoading(false);
  }
};
```

- [ ] **Step 2: Add points column to the users table**

In the `<thead>`, add a new `<th>` after the Магазин column:
```tsx
<th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Бали</th>
```

In each `<tr>` in `<tbody>`, add a new `<td>` after the store cell:
```tsx
<td className="px-6 py-4">
  {u.role === 'EMPLOYEE' ? (
    <button
      onClick={() => openPointsHistory(u)}
      className="flex items-center gap-1 text-sm font-semibold text-kameya-burgundy hover:opacity-75 transition-opacity"
      title="Переглянути історію балів"
    >
      <i className="fas fa-star text-xs"></i>
      {u.points ?? 0}
    </button>
  ) : (
    <span className="text-slate-400">—</span>
  )}
</td>
```

- [ ] **Step 3: Add points history modal**

Before the closing `</div>` of the component, add:

```tsx
{/* ── Модалка HISTORY БАЛІВ ── */}
{pointsUser && (
  <Modal>
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Історія балів</h3>
          <p className="text-sm text-slate-500">{pointsUser.name || toDisplay(pointsUser.phone)}</p>
        </div>
        <button onClick={() => setPointsUser(null)} className="text-slate-400 hover:text-slate-600">
          <i className="fas fa-xmark text-xl"></i>
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1">
        {pointsLoading ? (
          <div className="flex justify-center py-8">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
          </div>
        ) : pointsHistory.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Транзакцій ще немає</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-sm text-slate-500">Загальний баланс:</span>
              <span className="font-bold text-kameya-burgundy text-lg">
                <i className="fas fa-star text-xs mr-1"></i>
                {pointsUser.points ?? 0} балів
              </span>
            </div>
            {pointsHistory.map((tx) => {
              const reportId = typeof tx.reportId === 'object' ? tx.reportId : null;
              return (
                <div key={tx._id} className="flex items-center justify-between py-3 px-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {tx.quarter} {tx.year}
                    </p>
                    <p className="text-xs text-slate-500">
                      Результат: {Math.floor(tx.scorePercent)}%
                      {reportId?.fileName ? ` · ${reportId.fileName}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString('uk-UA')}
                    </p>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                    tx.pointsAwarded > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {tx.pointsAwarded > 0 ? `+${tx.pointsAwarded}` : '0'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </Modal>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/UsersView.tsx
git commit -m "feat: show points balance in users table, add points history modal"
```

---

## Task 9: Employee — MyReportsView with Q Label

**Files:**
- Modify: `frontend/src/components/employee/MyReportsView.tsx`

- [ ] **Step 1: Add Q period label helper**

In `MyReportsView`, add a helper function at the top of the component body:

```typescript
const periodLabel = (report: AuditResult) =>
  report.quarter && report.year ? `${report.quarter} ${report.year}` : formatDate(report.date);
```

- [ ] **Step 2: Update list card to show period label**

In the list view report card, replace:
```tsx
<p className="text-xs text-slate-400">{formatDate(report.date)}</p>
```
With:
```tsx
<p className="font-semibold text-slate-700 text-sm">{periodLabel(report)}</p>
<p className="text-xs text-slate-400">{formatDate(report.date)}</p>
```

- [ ] **Step 3: Update detail view header to show period label**

In the detail view header (the short version with back button), update the subtitle:
```tsx
<p className="text-xs text-slate-400">
  {periodLabel(selected)}
  {selected.store && ` · ${selected.store}`}
</p>
```

- [ ] **Step 4: Update score display to use `formatScore`**

In the score circle (`text-5xl font-bold`), replace `{Math.round(selected.totalScore)}%` with:
```tsx
{formatScore(selected.totalScore)}
```

Also update the progress bar color:
```tsx
className={`h-2 rounded-full transition-all ${scoreTextClass(selected.totalScore).replace('text-', 'bg-')}`}
```

Actually, use explicit mapping to avoid fragile class manipulation:
```tsx
const barColor = Math.floor(selected.totalScore) >= 95
  ? 'bg-green-500'
  : Math.floor(selected.totalScore) >= 80
  ? 'bg-yellow-500'
  : 'bg-red-500';
// then: className={`h-2 rounded-full transition-all ${barColor}`}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/employee/MyReportsView.tsx
git commit -m "feat: show Q period label in employee report cards and detail view"
```

---

## Task 10: Employee Dashboard — Points Balance Card

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Add points card to the dashboard grid**

In `Dashboard.tsx`, read `user.points` from auth context. The user object now has a `points` field from Task 4.

In the dashboard grid (`grid grid-cols-1 md:grid-cols-3 gap-6`), add a third column card after the score card:

```tsx
{/* Points Balance Card */}
<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Мої бали</p>
  <div className="flex items-center justify-center gap-2">
    <i className="fas fa-star text-yellow-400 text-3xl"></i>
    <span className="text-5xl font-bold text-slate-800">{user?.points ?? 0}</span>
  </div>
  <p className="mt-4 text-xs text-slate-400">Накопичені бали за перевірки</p>
</div>
```

Also update the grid to `md:grid-cols-3` if not already (it is), and shift `Training Progress` from `col-span-1 md:col-span-2` down to just `col-span-1 md:col-span-2` (keep as is, the three columns will auto-arrange).

Actually since we're adding a third top-level card, the layout becomes 3 cards across: Score | Points | Training. But Training is `col-span-2`. To keep a clean layout, put Score + Points in a nested grid and Training separately, OR make Score + Points on one row and Training on second row.

Simplest approach — keep the existing 3-col grid and make Training span full width on a new row:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Score Card */}
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
    {/* ... existing score card content ... */}
  </div>

  {/* Points Balance Card */}
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Мої бали</p>
    <div className="flex items-center justify-center gap-2">
      <i className="fas fa-star text-yellow-400 text-3xl"></i>
      <span className="text-5xl font-bold text-slate-800">{user?.points ?? 0}</span>
    </div>
    <p className="mt-4 text-xs text-slate-400">Накопичені бали за перевірки</p>
  </div>
</div>

{/* Training Progress — full width below */}
<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
  {/* ... existing training plan content ... */}
</div>
```

The full replacement for the grid in Dashboard:

```tsx
<div className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Score Card */}
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Остання оцінка</p>
      {lastAudit ? (
        <>
          <div className="relative inline-flex items-center justify-center">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
              <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} className="text-slate-100" r={normalizedRadius} cx={radius} cy={radius} />
              <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset }} strokeLinecap="round" className="text-kameya-burgundy transition-all duration-1000 ease-out" r={normalizedRadius} cx={radius} cy={radius} />
            </svg>
            <span className="absolute text-3xl font-bold text-slate-800 tracking-tight">{Math.round(lastAudit.totalScore)}%</span>
          </div>
          <p className="mt-6 text-sm text-slate-500 font-medium">Дата перевірки: {formatDate(lastAudit.date)}</p>
          {lastAudit.store && <p className="text-sm text-slate-500 font-medium">Магазин: {lastAudit.store}</p>}
          {lastAudit.quarter && lastAudit.year && (
            <p className="text-sm text-slate-500 font-medium">{lastAudit.quarter} {lastAudit.year}</p>
          )}
          <button
            onClick={() => lastAudit && onNavigateToAuditDetails?.(lastAudit)}
            className="mt-4 text-kameya-burgundy font-bold text-sm hover:text-red-900 transition-colors flex items-center space-x-1"
          >
            <span>Детальний звіт</span>
            <i className="fas fa-arrow-right text-xs"></i>
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <i className="fas fa-clipboard text-5xl text-slate-200 mb-4"></i>
          <p className="text-slate-500 font-medium">Перевірок ще немає</p>
          <p className="text-xs text-slate-400 mt-2">Ваша перша перевірка з'явиться тут</p>
        </div>
      )}
    </div>

    {/* Points Balance Card */}
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Мої бали</p>
      <div className="flex items-center justify-center gap-3">
        <i className="fas fa-star text-yellow-400 text-3xl"></i>
        <span className="text-5xl font-bold text-slate-800">{user?.points ?? 0}</span>
      </div>
      <p className="mt-6 text-xs text-slate-400">Накопичені бали за перевірки таємного покупця</p>
    </div>
  </div>

  {/* Training Progress */}
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
    <h3 className="font-bold text-lg text-slate-800 mb-6">Ваш план навчання</h3>
    <div className="flex flex-col items-center justify-center py-12 flex-1">
      <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
      <p className="text-slate-500 font-medium">План навчання не обрано</p>
      <p className="text-xs text-slate-400 mt-2 text-center">Обберіть план навчання, щоб почати</p>
      <button
        onClick={() => onNavigate(Screen.TRAINING_PLAN)}
        className="mt-6 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-bold hover:bg-red-900 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
      >
        Обрати план навчання
      </button>
    </div>
  </div>
</div>
```

Replace the existing `<div className="grid grid-cols-1 md:grid-cols-3 gap-6">` block with this new structure. The outer `<div className="space-y-6">` wrapper is the existing one in the return — nest the new grid inside it appropriately so it replaces only the old grid block.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "feat: add points balance card to employee dashboard"
```

---

## Self-Review

**Spec coverage check:**
- ✅ User.points field (Task 1)
- ✅ Report.quarter + year fields (Task 1)
- ✅ PointsTransaction model (Task 1)
- ✅ Points calculation formula with Math.floor (Task 2)
- ✅ Points awarded automatically on confirm (Task 3)
- ✅ GET /users/:id/points endpoint (Task 3)
- ✅ Admin upload form: year + quarter selects (Task 6)
- ✅ Show awarded points on success screen (Task 6)
- ✅ Admin reports list: accordion by Q period (Task 7)
- ✅ Q label in report detail (Task 7)
- ✅ Users table: points balance + history modal (Task 8)
- ✅ Employee report card: Q period label (Task 9)
- ✅ Employee dashboard: points balance card (Task 10)
- ✅ Color scheme everywhere via shared utility (Task 5)
- ✅ Auth response includes store + points (Task 3)

**Type consistency check:**
- `getScoreStyle` defined in Task 5, used in Task 7 ✅
- `scoreTextClass`, `scoreBgBorderClass`, `formatScore` defined in Task 5, used in Tasks 6/7/9 ✅
- `ConfirmReportPayload.quarter/year` defined in Task 4, passed in Task 6 ✅
- `ConfirmReportResponse.pointsAwarded` defined in Task 4, used in Task 6 ✅
- `PointsTransaction` type defined in Task 4, used in Task 8 ✅
- `getUserPointsHistory` defined in Task 4, called in Task 8 ✅
- `AuditResult.quarter/year` defined in Task 4, used in Tasks 7/9/10 ✅
- `AuthUser.points` defined in Task 4, used in Task 10 ✅
