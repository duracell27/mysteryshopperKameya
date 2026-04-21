# Q-Label, Dashboard Chart & Reflection System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Q-period badge to employee report detail, a score chart on the dashboard, and a full reflection system (employee submits, admin sees status + responses).

**Architecture:** Three independent sub-features sharing the same backend report model. Reflection extends the Report document with an embedded `reflection` subdocument; the chart reads from existing `getMyReports()` data. MyReportsView is refactored to a single full detail view (no more two-step).

**Tech Stack:** Express + Mongoose (backend), React + TypeScript + Tailwind + Recharts (frontend). No test framework — manual verification + tsc after each task.

**Spec:** `docs/superpowers/specs/2026-04-21-reports-reflection-chart-design.md`

---

## File Map

**Backend — modified:**
- `backend/src/models/Report.ts` — add `IReflection` interface + `reflection` optional field
- `backend/src/routes/reports.ts` — add `POST /:id/reflection` endpoint

**Frontend — created:**
- `frontend/src/components/employee/ScoreChart.tsx` — recharts AreaChart component

**Frontend — modified:**
- `frontend/package.json` — add `recharts` dependency
- `frontend/src/types.ts` — add `Reflection` interface, add `reflection?` to `AuditResult`
- `frontend/src/services/reportsService.ts` — add `submitReflection`
- `frontend/src/components/employee/MyReportsView.tsx` — Q badge, single full detail, reflection button/modal
- `frontend/src/components/Dashboard.tsx` — add ScoreChart card below grid
- `frontend/src/components/admin/AdminReportsListView.tsx` — reflection status panel in detail view

---

## Task 1: Q-Period Badge in MyReportsView Detail View

**Files:**
- Modify: `frontend/src/components/employee/MyReportsView.tsx`

- [ ] **Step 1: Add Q badge above the score card in the short detail view**

In `MyReportsView.tsx`, the short detail view starts at `// Коротка версія з кнопкою "Детальний звіт"`. Inside its `return`, after the back-button header div and before the score card div (`<div className={...scoreBgBorderClass...}`), insert:

```tsx
{selected.quarter && selected.year && (
  <div className="flex">
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-kameya-burgundy/10 text-kameya-burgundy rounded-full text-sm font-semibold">
      <i className="fas fa-calendar-check text-xs"></i>
      {selected.quarter} {selected.year}
    </div>
  </div>
)}
```

Also add the same badge in the `showDetailedView` branch — after the header div, before `<div className="grid grid-cols-1 gap-4">`:

```tsx
{selected.quarter && selected.year && (
  <div className="flex">
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-kameya-burgundy/10 text-kameya-burgundy rounded-full text-sm font-semibold">
      <i className="fas fa-calendar-check text-xs"></i>
      {selected.quarter} {selected.year}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add frontend/src/components/employee/MyReportsView.tsx
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: add Q-period badge to employee report detail view"
```

---

## Task 2: Install Recharts + Create ScoreChart Component

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/employee/ScoreChart.tsx`

- [ ] **Step 1: Install recharts**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npm install recharts
```

Expected: recharts added to package.json dependencies.

- [ ] **Step 2: Create ScoreChart component**

Create `/Users/Apple/IT/mysteryshopperKameya/frontend/src/components/employee/ScoreChart.tsx`:

```tsx
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot,
} from 'recharts';
import { AuditResult } from '../../types';
import { formatDate } from '../../utils/dateFormatter';

interface ScoreChartProps {
  reports: AuditResult[];
}

interface ChartPoint {
  quarter: string;
  score: number;
  date: string;
  points: number;
}

function buildChartData(reports: AuditResult[]): ChartPoint[] {
  const currentYear = new Date().getFullYear();
  const byQuarter: Record<string, AuditResult> = {};

  for (const r of reports) {
    if (!r.quarter || r.year !== currentYear) continue;
    if (!byQuarter[r.quarter] || new Date(r.createdAt ?? 0) > new Date(byQuarter[r.quarter].createdAt ?? 0)) {
      byQuarter[r.quarter] = r;
    }
  }

  const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
  return quarterOrder
    .filter((q) => byQuarter[q])
    .map((q) => {
      const r = byQuarter[q];
      const score = Math.floor(r.totalScore);
      const pts = score === 100 ? 200 : score >= 95 ? 150 : score >= 90 ? 100 : score >= 80 ? 50 : 0;
      return {
        quarter: q,
        score,
        date: formatDate(r.date),
        points: pts,
      };
    });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: ChartPoint }[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-kameya-burgundy mb-1">{d.quarter} {new Date().getFullYear()}</p>
      <p className="text-slate-500">{d.date}</p>
      <p className="text-slate-700 font-semibold">Результат: {d.score}%</p>
      <p className="text-slate-700">Нараховано: <span className="font-semibold text-kameya-burgundy">+{d.points} балів</span></p>
    </div>
  );
};

export const ScoreChart: React.FC<ScoreChartProps> = ({ reports }) => {
  const data = buildChartData(reports);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7B1C3A" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#7B1C3A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="quarter"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#7B1C3A"
          strokeWidth={2.5}
          fill="url(#scoreGradient)"
          dot={<Dot r={5} fill="#7B1C3A" stroke="#fff" strokeWidth={2} />}
          activeDot={{ r: 7, fill: '#7B1C3A', stroke: '#fff', strokeWidth: 2 }}
          label={{ position: 'top', fontSize: 11, fill: '#7B1C3A', fontWeight: 600, formatter: (v: number) => `${v}%` }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add frontend/package.json frontend/package-lock.json frontend/src/components/employee/ScoreChart.tsx
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: install recharts, create ScoreChart component"
```

---

## Task 3: Add ScoreChart to Dashboard

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Add `allReports` state and pass to ScoreChart**

In `Dashboard.tsx`:

1. Add import at top:
```tsx
import { ScoreChart } from './employee/ScoreChart';
```

2. Add `allReports` state alongside `lastAudit`:
```tsx
const [allReports, setAllReports] = useState<AuditResult[]>([]);
```

3. In the `useEffect`, update the reports handler to also save all reports:
```tsx
.then(([reports, tipData]) => {
  if (reports.length > 0) {
    setLastAudit(reports[0]);
  }
  setAllReports(reports);
  setTip(tipData);
})
```

- [ ] **Step 2: Add chart card between Training Progress and Daily Tip**

After the closing `</div>` of the Training Progress card and before the Daily Tip div, add:

```tsx
{/* Score Chart */}
{allReports.length > 0 && (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
    <h3 className="font-bold text-slate-800 mb-1">Динаміка оцінок {new Date().getFullYear()}</h3>
    <p className="text-xs text-slate-400 mb-4">Результати таємного покупця по кварталах</p>
    <ScoreChart reports={allReports} />
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add frontend/src/components/Dashboard.tsx
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: add score dynamics chart to employee dashboard"
```

---

## Task 4: Backend — Reflection Data Model

**Files:**
- Modify: `backend/src/models/Report.ts`

- [ ] **Step 1: Add IReflection interface and reflection field to Report**

In `/Users/Apple/IT/mysteryshopperKameya/backend/src/models/Report.ts`, add after the `ISection` interface (before `IReport`):

```typescript
interface IReflection {
  answer1: string;
  answer2: string;
  submittedAt: Date;
  isOnTime: boolean;
  bonusPointsAwarded: boolean;
}
```

Add `reflection?: IReflection` to `IReport` interface:
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
  reflection?: IReflection;
  createdAt: Date;
}
```

Add `ReflectionSchema` and add it to `ReportSchema`. After the `SectionSchema` definition, add:

```typescript
const ReflectionSchema = new Schema<IReflection>(
  {
    answer1:             { type: String, required: true },
    answer2:             { type: String, required: true },
    submittedAt:         { type: Date, required: true },
    isOnTime:            { type: Boolean, required: true },
    bonusPointsAwarded:  { type: Boolean, required: true },
  },
  { _id: false }
);
```

Add to `ReportSchema` (after `year` field):
```typescript
reflection: { type: ReflectionSchema, default: undefined },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add backend/src/models/Report.ts
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: add reflection subdocument to Report model"
```

---

## Task 5: Backend — Reflection Endpoint

**Files:**
- Modify: `backend/src/routes/reports.ts`

- [ ] **Step 1: Add POST /:id/reflection route**

In `/Users/Apple/IT/mysteryshopperKameya/backend/src/routes/reports.ts`, add this route before the `DELETE /:id` route (so it doesn't conflict with the delete route's `:id` param):

```typescript
// POST /api/reports/:id/reflection — employee submits reflection
router.post('/:id/reflection', async (req: AuthRequest, res: Response) => {
  try {
    const { answer1, answer2 } = req.body;

    if (!answer1?.trim() || !answer2?.trim()) {
      return res.status(400).json({ message: 'Обидві відповіді обов\'язкові' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Звіт не знайдено' });
    }

    if (report.userId.toString() !== req.user?.userId?.toString()) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    if (report.reflection) {
      return res.status(409).json({ message: 'Рефлексію вже подано' });
    }

    const MS_72H = 72 * 60 * 60 * 1000;
    const isOnTime = Date.now() - report.createdAt.getTime() <= MS_72H;

    report.reflection = {
      answer1: answer1.trim(),
      answer2: answer2.trim(),
      submittedAt: new Date(),
      isOnTime,
      bonusPointsAwarded: isOnTime,
    };
    await report.save();

    if (isOnTime) {
      await User.findByIdAndUpdate(report.userId, { $inc: { points: 20 } });
      await PointsTransaction.create({
        userId: report.userId,
        reportId: report._id,
        quarter: report.quarter,
        year: report.year,
        scorePercent: 0,
        pointsAwarded: 20,
      });
    }

    return res.json(report);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});
```

Note: `User` and `PointsTransaction` are already imported in reports.ts. Verify imports at top of file — `PointsTransaction` was imported in Task 3 of the previous plan. If not present, add:
```typescript
import { PointsTransaction } from '../models/PointsTransaction';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add backend/src/routes/reports.ts
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: add POST /reports/:id/reflection endpoint"
```

---

## Task 6: Frontend Types + submitReflection Service

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/reportsService.ts`

- [ ] **Step 1: Add Reflection interface and update AuditResult in types.ts**

In `/Users/Apple/IT/mysteryshopperKameya/frontend/src/types.ts`, add after the `PointsTransaction` interface:

```typescript
export interface Reflection {
  answer1: string;
  answer2: string;
  submittedAt: string;
  isOnTime: boolean;
  bonusPointsAwarded: boolean;
}
```

Add `reflection?: Reflection` to `AuditResult`:
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
  reflection?: Reflection;
}
```

- [ ] **Step 2: Add submitReflection to reportsService.ts**

In `/Users/Apple/IT/mysteryshopperKameya/frontend/src/services/reportsService.ts`, add after `deleteReport`:

```typescript
export const submitReflection = async (
  reportId: string,
  answer1: string,
  answer2: string,
): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/reflection`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer1, answer2 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка збереження рефлексії');
  }
  return res.json();
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add frontend/src/types.ts frontend/src/services/reportsService.ts
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: add Reflection type and submitReflection service"
```

---

## Task 7: Employee MyReportsView — Full Redesign with Reflection

**Files:**
- Modify: `frontend/src/components/employee/MyReportsView.tsx`

This is the largest task. Read the current file before editing.

- [ ] **Step 1: Add submitReflection import and new state**

Add to imports:
```tsx
import { getMyReports, submitReflection } from '../../services/reportsService';
import { Reflection } from '../../types';
```

Remove `showDetailedView` state (no longer needed). Add new state for reflection modal:
```tsx
const [showReflection, setShowReflection] = useState(false);
const [reflAnswer1, setReflAnswer1] = useState('');
const [reflAnswer2, setReflAnswer2] = useState('');
const [reflSubmitting, setReflSubmitting] = useState(false);
const [reflError, setReflError] = useState('');
```

Also update `setSelected` calls to reset reflection state: whenever `setSelected` is called with `null`, also call `setShowReflection(false)`.

- [ ] **Step 2: Add reflection submit handler**

```tsx
const handleSubmitReflection = async () => {
  if (!selected) return;
  if (reflAnswer1.trim().length < 10 || reflAnswer2.trim().length < 10) {
    setReflError('Будь ласка, дайте розгорнуту відповідь (мін. 10 символів)');
    return;
  }
  setReflSubmitting(true);
  setReflError('');
  try {
    const updated = await submitReflection(selected._id ?? selected.id ?? '', reflAnswer1, reflAnswer2);
    setSelected(updated);
    setReflections((prev) => ({ ...prev, [updated._id ?? updated.id ?? '']: updated.reflection! }));
    setShowReflection(false);
    setReflAnswer1('');
    setReflAnswer2('');
  } catch (err) {
    setReflError(err instanceof Error ? err.message : 'Помилка');
  } finally {
    setReflSubmitting(false);
  }
};
```

Also add a local state map to track updated reflections (so after submission the UI updates without refetch):
```tsx
const [reflections, setReflections] = useState<Record<string, Reflection>>({});
```

And a helper to get the current reflection for a report:
```tsx
const getReflection = (report: AuditResult): Reflection | undefined =>
  reflections[report._id ?? report.id ?? ''] ?? report.reflection;
```

- [ ] **Step 3: Add hoursElapsed helper and reflection status helpers**

```tsx
const hoursElapsed = (report: AuditResult): number => {
  if (!report.createdAt) return 999;
  return (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 3600);
};
```

- [ ] **Step 4: Replace the entire `if (selected)` block**

Remove both the `showDetailedView` branch and the "short version" branch. Replace the entire `if (selected) { ... }` block (everything from `if (selected) {` up to and including its closing `}`) with this single unified detail view:

```tsx
if (selected) {
  const reflection = getReflection(selected);
  const elapsed = hoursElapsed(selected);
  const deadlinePassed = elapsed > 72;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setSelected(null); setExpandedSection(null); setShowReflection(false); }}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <i className="fas fa-arrow-left text-slate-500 text-sm"></i>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Звіт перевірки</h1>
          <p className="text-xs text-slate-400">
            {periodLabel(selected)}
            {selected.store && ` · ${selected.store}`}
          </p>
        </div>
      </div>

      {/* Q-period badge */}
      {selected.quarter && selected.year && (
        <div className="flex">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-kameya-burgundy/10 text-kameya-burgundy rounded-full text-sm font-semibold">
            <i className="fas fa-calendar-check text-xs"></i>
            {selected.quarter} {selected.year}
          </div>
        </div>
      )}

      {/* Score card */}
      <div className={`rounded-2xl border p-6 flex flex-col items-center ${scoreBgBorderClass(selected.totalScore)}`}>
        <p className="text-sm text-slate-500 mb-1">Загальний результат</p>
        <p className={`text-5xl font-bold ${scoreTextClass(selected.totalScore)}`}>{formatScore(selected.totalScore)}</p>
        <div className="w-full mt-4 bg-slate-200 rounded-full h-2">
          {(() => {
            const barColor = Math.floor(selected.totalScore) >= 95
              ? 'bg-green-500'
              : Math.floor(selected.totalScore) >= 80
              ? 'bg-yellow-500'
              : 'bg-red-500';
            return <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${selected.totalScore}%` }} />;
          })()}
        </div>
      </div>

      {/* Sections — full detail, failed sections highlighted */}
      <div className="grid grid-cols-1 gap-4">
        {selected.sections.map((section, idx) => {
          const failed = section.score < section.maxScore;
          return (
            <div
              key={idx}
              className={`rounded-xl overflow-hidden shadow-sm border ${failed ? 'border-red-300 bg-red-50' : 'bg-white border-slate-100'}`}
            >
              <div className={`p-4 border-b flex justify-between items-center ${failed ? 'bg-red-100 border-red-300' : 'bg-slate-50 border-slate-100'}`}>
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  {failed && <i className="fas fa-circle-exclamation text-red-500 text-sm"></i>}
                  {section.title}
                </h3>
                <span className={`text-sm font-semibold ${failed ? 'text-red-600' : 'text-green-600'}`}>
                  {section.score} / {section.maxScore}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {section.feedback && <p className="text-sm italic text-slate-600">"{section.feedback}"</p>}
                <div className="divide-y divide-slate-100">
                  {section.questions.map((q, qIdx) => (
                    <div key={qIdx} className="py-3 flex items-start space-x-3">
                      <i className={`fas ${q.isCorrect ? 'fa-check text-green-500' : 'fa-xmark text-red-500'} mt-0.5 flex-shrink-0`}></i>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{q.question}</p>
                        <p className="text-xs text-slate-500">Відповідь: {q.answer}</p>
                        {q.comment && (
                          <p className="text-xs text-kameya-burgundy mt-1 font-medium italic">— {q.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reflection section */}
      {reflection ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <i className="fas fa-circle-check text-green-500"></i>
          <div>
            <p className="text-sm font-semibold text-green-700">Рефлексію подано</p>
            <p className="text-xs text-green-600">
              {new Date(reflection.submittedAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {reflection.bonusPointsAwarded && ' · +20 балів нараховано'}
            </p>
          </div>
        </div>
      ) : deadlinePassed ? (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <i className="fas fa-clock text-slate-400"></i>
          <p className="text-sm text-slate-500">Термін рефлексії минув</p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => setShowReflection(true)}
            className="w-full py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-pen-to-square"></i>
            Ознайомився
          </button>
          <p className="text-center text-xs text-slate-400">
            Залишилось {Math.max(0, Math.floor(72 - elapsed))} год для подання рефлексії
          </p>
        </div>
      )}

      {/* Reflection modal */}
      {showReflection && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Рефлексія</h3>
              <button onClick={() => { setShowReflection(false); setReflError(''); }} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Що я зроблю інакше наступного разу?
                </label>
                <textarea
                  value={reflAnswer1}
                  onChange={(e) => setReflAnswer1(e.target.value)}
                  rows={3}
                  placeholder="Ваша відповідь..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Який пункт був для мене несподіванкою?
                </label>
                <textarea
                  value={reflAnswer2}
                  onChange={(e) => setReflAnswer2(e.target.value)}
                  rows={3}
                  placeholder="Ваша відповідь..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                />
              </div>
              {reflError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                  <i className="fas fa-triangle-exclamation"></i>
                  <span>{reflError}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowReflection(false); setReflError(''); }}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSubmitReflection}
                  disabled={reflSubmitting}
                  className="flex-1 py-3 rounded-xl bg-kameya-burgundy text-white font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {reflSubmitting ? (
                    <><i className="fas fa-spinner fa-spin"></i> Надсилання...</>
                  ) : (
                    <><i className="fas fa-paper-plane"></i> Надіслати</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add frontend/src/components/employee/MyReportsView.tsx
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: redesign employee report detail with reflection button and modal"
```

---

## Task 8: Admin AdminReportsListView — Reflection Status Panel

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

- [ ] **Step 1: Add reflection modal state**

Add state after the existing state declarations:
```typescript
const [reflectionReport, setReflectionReport] = useState<ReportWithUser | null>(null);
```

Also add `reflection?` to `ReportWithUser` interface:
```typescript
interface ReportWithUser extends Omit<AuditResult, 'userId'> {
  userId: { _id: string; name: string; phone: string; store?: string } | string;
  quarter?: string;
  year?: number;
}
```
(AuditResult now has `reflection?` from Task 6, so this inherits it automatically via `Omit<AuditResult, 'userId'>`.)

- [ ] **Step 2: Add reflection status helper**

Add before the return statement:
```typescript
const getReflectionStatus = (report: ReportWithUser) => {
  if (!report.createdAt) return 'unknown';
  const hoursElapsed = (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 3600);
  if (report.reflection) {
    return report.reflection.isOnTime ? 'on-time' : 'late';
  }
  return hoursElapsed >= 72 ? 'missed' : 'pending';
};
```

- [ ] **Step 3: Add reflection section to detail view**

In the detail view (`// ── Detail view ──`), after the sections accordion (`</div>` that closes the `<div className="space-y-2">` sections block), add:

```tsx
{/* Reflection panel */}
<div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
  <p className="text-sm font-semibold text-slate-700 mb-3">Рефлексія</p>
  {(() => {
    const status = getReflectionStatus(selected);
    const hoursElapsed = selected.createdAt
      ? (Date.now() - new Date(selected.createdAt).getTime()) / (1000 * 3600)
      : 999;
    const hoursLeft = Math.max(0, Math.floor(72 - hoursElapsed));

    if (status === 'on-time') return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fas fa-circle-check text-green-500"></i>
          <span className="text-sm text-green-700 font-semibold">Отримана вчасно</span>
          <span className="text-xs text-slate-400">· +20 балів</span>
        </div>
        <button
          onClick={() => setReflectionReport(selected)}
          className="text-xs text-kameya-burgundy font-semibold hover:opacity-75"
        >
          Переглянути відповіді
        </button>
      </div>
    );

    if (status === 'late') return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fas fa-circle-xmark text-orange-500"></i>
          <span className="text-sm text-orange-700 font-semibold">Отримана не вчасно</span>
          <span className="text-xs text-slate-400">· 0 балів</span>
        </div>
        <button
          onClick={() => setReflectionReport(selected)}
          className="text-xs text-kameya-burgundy font-semibold hover:opacity-75"
        >
          Переглянути відповіді
        </button>
      </div>
    );

    if (status === 'missed') return (
      <div className="flex items-center gap-2">
        <i className="fas fa-circle-xmark text-red-500"></i>
        <span className="text-sm text-red-600 font-semibold">Не подана</span>
        <span className="text-xs text-slate-400">· Термін минув</span>
      </div>
    );

    return (
      <div className="flex items-center gap-2">
        <i className="fas fa-clock text-slate-400"></i>
        <span className="text-sm text-slate-600">Очікується</span>
        <span className="text-xs text-slate-400">· залишилось {hoursLeft} год</span>
      </div>
    );
  })()}
</div>
```

- [ ] **Step 4: Add reflection answers modal**

After the detail view closing tag and before the list view, add the modal:

```tsx
{/* Reflection answers modal */}
{reflectionReport?.reflection && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Відповіді рефлексії</h3>
          <p className="text-sm text-slate-500">
            {getUserName(reflectionReport)} · {reflectionReport.quarter} {reflectionReport.year}
          </p>
        </div>
        <button onClick={() => setReflectionReport(null)} className="text-slate-400 hover:text-slate-600">
          <i className="fas fa-xmark text-xl"></i>
        </button>
      </div>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            reflectionReport.reflection.isOnTime
              ? 'bg-green-100 text-green-700'
              : 'bg-orange-100 text-orange-700'
          }`}>
            {reflectionReport.reflection.isOnTime ? '✅ Вчасно' : '⚠️ Не вчасно'}
          </span>
          <span className="text-sm text-slate-500">
            {new Date(reflectionReport.reflection.submittedAt).toLocaleDateString('uk-UA', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          <span className={`text-sm font-semibold ${reflectionReport.reflection.bonusPointsAwarded ? 'text-green-600' : 'text-slate-400'}`}>
            {reflectionReport.reflection.bonusPointsAwarded ? '+20 балів' : '0 балів'}
          </span>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Що я зроблю інакше наступного разу?
          </p>
          <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-4 leading-relaxed">
            {reflectionReport.reflection.answer1}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Який пункт був для мене несподіванкою?
          </p>
          <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-4 leading-relaxed">
            {reflectionReport.reflection.answer2}
          </p>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit && echo "OK"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git -C /Users/Apple/IT/mysteryshopperKameya add frontend/src/components/admin/AdminReportsListView.tsx
git -C /Users/Apple/IT/mysteryshopperKameya commit -m "feat: add reflection status panel and answers modal to admin report detail"
```

---

## Self-Review

**Spec coverage:**
- ✅ Q-period badge in employee detail view (Task 1)
- ✅ Recharts installed, ScoreChart with area chart, tooltip showing date + points (Task 2)
- ✅ Chart card on Dashboard below grid (Task 3)
- ✅ IReflection + reflection field on Report model (Task 4)
- ✅ POST /:id/reflection — auth check, 409 on duplicate, isOnTime, +20 points if on time (Task 5)
- ✅ Reflection type + submitReflection service (Task 6)
- ✅ Single full detail view, failed sections highlighted red, "Ознайомився" button, timing countdown, reflection modal with 2 required fields (Task 7)
- ✅ Admin: 4 reflection states (pending/on-time/late/missed), "Переглянути відповіді" modal (Task 8)

**Type consistency:**
- `Reflection` interface defined in Task 6 types.ts, used in Task 7 (MyReportsView) and Task 8 (AdminReportsListView) ✅
- `submitReflection` defined in Task 6 reportsService.ts, imported in Task 7 ✅
- `reflections` local state + `getReflection` helper in Task 7 consistent with `Reflection` type ✅
- `getReflectionStatus` in Task 8 checks `report.reflection.isOnTime` — matches IReflection field ✅
- `ScoreChart` props `reports: AuditResult[]` — consistent with Dashboard state type ✅
- `buildChartData` uses `r.year`, `r.quarter`, `r.createdAt` — all optional fields present in AuditResult ✅
