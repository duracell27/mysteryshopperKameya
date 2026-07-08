# Reflection / Learning Plan / Monthly Sort / Dashboard Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four independent improvements: hide reflection Q2 at 100%, add employee learning-plan generation in MyReportsView, add monthly grouping in admin reports list, and fix the monthly dashboard filter bug.

**Architecture:** All changes are isolated — two backend edits in `routes/reports.ts`, two frontend edits in `MyReportsView.tsx` + `LearningPlanSection.tsx`, one frontend edit in `AdminReportsListView.tsx`. No new files needed. No shared state between tasks.

**Tech Stack:** React 18 + TypeScript (Vite), Express + Mongoose (TypeScript), Tailwind CSS, FontAwesome icons.

## Global Constraints

- All UI copy is Ukrainian only
- Use existing Tailwind classes and `kameya-burgundy` colour token — never add raw hex colours
- Never install new packages
- Backend TypeScript must pass `npx tsc --noEmit` with zero errors after each task
- Frontend TypeScript must pass `npx tsc --noEmit` with zero errors after each task
- Do not change any existing API routes or response shapes beyond what is specified

---

## File Change Map

| File | Task(s) | What changes |
|---|---|---|
| `backend/src/routes/reports.ts` | 1, 2 | Reflection validation relaxed; dashboard month filter adds date fallback |
| `frontend/src/components/employee/LearningPlanSection.tsx` | 3 | Add `onGeneratePlan`, `isGenerating`, `planError` props; wire up button in empty state |
| `frontend/src/components/employee/MyReportsView.tsx` | 3, 4 | Hide Q2 at 100%; add plan generation handler; render `LearningPlanSection` after reflection |
| `frontend/src/components/admin/AdminReportsListView.tsx` | 5 | Add `groupMode` state + toggle UI + monthly grouping logic |

---

## Task 1: Backend — Relax reflection answer2 requirement at 100%

**Files:**
- Modify: `backend/src/routes/reports.ts` (POST `/:id/reflection` handler, ~lines 940–977)

**Interfaces:**
- Produces: reflection endpoint now accepts `{ answer1: string, answer2?: string }` when `totalScore >= 100`; stores `answer2: ''` in that case

---

- [ ] **Step 1: Locate the reflection handler**

  Open `backend/src/routes/reports.ts`. Find the block starting at:
  ```typescript
  router.post('/:id/reflection', async (req: AuthRequest, res: Response) => {
  ```

- [ ] **Step 2: Restructure the handler to validate answer2 after loading the report**

  Replace the entire handler body with:

  ```typescript
  router.post('/:id/reflection', async (req: AuthRequest, res: Response) => {
    try {
      const { answer1, answer2 } = req.body;

      if (!answer1?.trim()) {
        return res.status(400).json({ message: 'Відповідь на перше питання обов\'язкова' });
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

      if (report.totalScore < 100 && !answer2?.trim()) {
        return res.status(400).json({ message: 'Відповідь на друге питання обов\'язкова' });
      }

      const MS_72H = 72 * 60 * 60 * 1000;
      const isOnTime = Date.now() - report.createdAt.getTime() <= MS_72H;

      report.reflection = {
        answer1: answer1.trim(),
        answer2: report.totalScore >= 100 ? '' : answer2.trim(),
        submittedAt: new Date(),
        isOnTime,
        bonusPointsAwarded: false,
      };
      await report.save();

      return res.json(report);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Помилка сервера' });
    }
  });
  ```

- [ ] **Step 3: Typecheck backend**

  ```bash
  cd backend && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/routes/reports.ts
  git commit -m "fix: allow empty answer2 in reflection when totalScore is 100%"
  ```

---

## Task 2: Backend — Fix monthly dashboard filter (date fallback)

**Files:**
- Modify: `backend/src/routes/reports.ts` (GET `/stats/dashboard` handler, ~lines 425–435)

**Interfaces:**
- Produces: `/stats/dashboard?periodType=month&year=2025&month=7` now also returns reports where the `month` field is absent but `date` starts with `"2025-07"`

---

- [ ] **Step 1: Locate the dashboard filter block**

  In `backend/src/routes/reports.ts`, find the block inside the `/stats/dashboard` handler:
  ```typescript
  const filter: Record<string, unknown> = { year };
  if (periodType === 'quarter' && quarter) filter.quarter = quarter;
  if (periodType === 'month' && month) filter.month = month;
  ```

- [ ] **Step 2: Replace the month filter line with an $or fallback**

  Replace only the third line (`if (periodType === 'month'...`):

  ```typescript
  const filter: Record<string, unknown> = { year };
  if (periodType === 'quarter' && quarter) filter.quarter = quarter;
  if (periodType === 'month' && month) {
    const monthStr = String(month).padStart(2, '0');
    const datePrefix = `${year}-${monthStr}`;
    filter.$or = [
      { month },
      { month: { $exists: false }, date: { $regex: `^${datePrefix}` } },
      { month: null, date: { $regex: `^${datePrefix}` } },
    ];
  }
  ```

- [ ] **Step 3: Typecheck backend**

  ```bash
  cd backend && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/routes/reports.ts
  git commit -m "fix: dashboard monthly filter falls back to date field when month is absent"
  ```

---

## Task 3: Frontend — Extend LearningPlanSection with generate callback

**Files:**
- Modify: `frontend/src/components/employee/LearningPlanSection.tsx`

**Interfaces:**
- Produces: three new optional props on `LearningPlanSection`:
  - `onGeneratePlan?: () => Promise<void>` — called on button click
  - `isGenerating?: boolean` — shows spinner on button
  - `planError?: string | null` — error message shown below button

---

- [ ] **Step 1: Add the three new props to the Props interface**

  Open `frontend/src/components/employee/LearningPlanSection.tsx`.

  Find:
  ```typescript
  interface Props {
    lastAudit: AuditResult | undefined;
    loading: boolean;
    onPlanUpdated: (updated: AuditResult) => void;
    onNavigateToTraining: () => void;
  }
  ```

  Replace with:
  ```typescript
  interface Props {
    lastAudit: AuditResult | undefined;
    loading: boolean;
    onPlanUpdated: (updated: AuditResult) => void;
    onNavigateToTraining: () => void;
    onGeneratePlan?: () => Promise<void>;
    isGenerating?: boolean;
    planError?: string | null;
  }
  ```

- [ ] **Step 2: Destructure the new props in the component function**

  Find:
  ```typescript
  export const LearningPlanSection: React.FC<Props> = ({
    lastAudit,
    loading,
    onPlanUpdated,
    onNavigateToTraining,
  }) => {
  ```

  Replace with:
  ```typescript
  export const LearningPlanSection: React.FC<Props> = ({
    lastAudit,
    loading,
    onPlanUpdated,
    onNavigateToTraining,
    onGeneratePlan,
    isGenerating = false,
    planError = null,
  }) => {
  ```

- [ ] **Step 3: Replace the disabled placeholder button in the non-perfect empty state**

  Find the entire non-perfect branch in the empty state return (the `else` block):
  ```tsx
  <>
    <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
    <p className="text-slate-500 font-medium">План навчання не обрано</p>
    <p className="text-xs text-slate-400 mt-2 text-center">Обберіть план навчання, щоб почати</p>
    <button
      disabled
      title="План навчання ще в розробці"
      className="mt-6 px-6 py-3 bg-slate-300 text-slate-500 rounded-xl font-bold cursor-not-allowed shadow-sm"
    >
      Генерувати план навчання
    </button>
    <p className="text-xs text-slate-400 mt-2 text-center">Функціонал ще в розробці</p>
  </>
  ```

  Replace with:
  ```tsx
  <>
    <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
    <p className="text-slate-500 font-medium">План навчання не згенеровано</p>
    <p className="text-xs text-slate-400 mt-2 text-center">Натисніть кнопку, щоб створити план</p>
    <button
      onClick={onGeneratePlan}
      disabled={isGenerating || !onGeneratePlan}
      className="mt-6 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
    >
      {isGenerating ? (
        <><i className="fas fa-spinner fa-spin"></i> Генерація...</>
      ) : (
        <><i className="fas fa-wand-magic-sparkles"></i> Згенерувати план навчання</>
      )}
    </button>
    {planError && (
      <p className="text-xs text-red-500 mt-3 text-center">{planError}</p>
    )}
  </>
  ```

- [ ] **Step 4: Typecheck frontend**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/employee/LearningPlanSection.tsx
  git commit -m "feat: add onGeneratePlan prop to LearningPlanSection"
  ```

---

## Task 4: Frontend — Add reflection Q2 hide + learning plan section in MyReportsView

**Files:**
- Modify: `frontend/src/components/employee/MyReportsView.tsx`

**Interfaces:**
- Consumes from Task 3: `LearningPlanSection` with `onGeneratePlan`, `isGenerating`, `planError` props
- Consumes from services: `generateAiRecommendations`, `generateLearningPlan` (already exported from `reportsService.ts`)

---

- [ ] **Step 1: Add new imports**

  Open `frontend/src/components/employee/MyReportsView.tsx`.

  Find:
  ```typescript
  import { getMyReports, submitReflection } from '../../services/reportsService';
  ```

  Replace with:
  ```typescript
  import { getMyReports, submitReflection, generateAiRecommendations, generateLearningPlan } from '../../services/reportsService';
  import { LearningPlanSection } from './LearningPlanSection';
  ```

- [ ] **Step 2: Add planLoading and planError state**

  Find the block of useState declarations near the top of `MyReportsView` (after `const [reflections, ...]`):
  ```typescript
  const [reflections, setReflections] = useState<Record<string, Reflection>>({});
  ```

  Add after it:
  ```typescript
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  ```

- [ ] **Step 3: Add handleGeneratePlan function**

  After the `handleSubmitReflection` function, add:

  ```typescript
  const handleGeneratePlan = async () => {
    if (!selected) return;
    const id = selected._id ?? selected.id ?? '';
    setPlanLoading(true);
    setPlanError(null);
    try {
      let current = selected;
      if (!current.aiRecommendations) {
        current = await generateAiRecommendations(id);
        setSelected(current);
      }
      const withPlan = await generateLearningPlan(id);
      setSelected(withPlan);
      setReports(prev => prev.map(r => (r._id ?? r.id) === id ? withPlan : r));
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Помилка генерації плану');
    } finally {
      setPlanLoading(false);
    }
  };
  ```

- [ ] **Step 4: Fix reflection validation to skip Q2 at 100%**

  Find `handleSubmitReflection`, specifically:
  ```typescript
  if (reflAnswer1.trim().length < 10 || reflAnswer2.trim().length < 10) {
    setReflError('Будь ласка, дайте розгорнуту відповідь (мін. 10 символів)');
    return;
  }
  ```

  Replace with:
  ```typescript
  if (reflAnswer1.trim().length < 10) {
    setReflError('Будь ласка, дайте розгорнуту відповідь (мін. 10 символів)');
    return;
  }
  if (selected.totalScore < 100 && reflAnswer2.trim().length < 10) {
    setReflError('Будь ласка, дайте розгорнуту відповідь (мін. 10 символів)');
    return;
  }
  ```

- [ ] **Step 5: Hide Q2 textarea in reflection modal when score is 100%**

  In the reflection modal JSX, find the second `<div>` block (the one with "Що я зроблю інакше наступного разу?"):
  ```tsx
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-2">
      Що я зроблю інакше наступного разу?
    </label>
    <textarea
      value={reflAnswer2}
      onChange={(e) => setReflAnswer2(e.target.value)}
      rows={3}
      placeholder="Ваша відповідь..."
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
    />
  </div>
  ```

  Wrap it in a conditional:
  ```tsx
  {selected.totalScore < 100 && (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Що я зроблю інакше наступного разу?
      </label>
      <textarea
        value={reflAnswer2}
        onChange={(e) => setReflAnswer2(e.target.value)}
        rows={3}
        placeholder="Ваша відповідь..."
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
      />
    </div>
  )}
  ```

- [ ] **Step 6: Add LearningPlanSection after the reflection block in the detail view**

  In the detail view return, find the reflection section end — the closing `</div>` after the entire reflection block (the one that contains either the "Рефлексію подано" green box OR the "Ознайомився" button). It looks like:

  ```tsx
        )}

        {/* Reflection modal */}
        {showReflection && ReactDOM.createPortal(
  ```

  Between the closing `)}` of the reflection section and the `{/* Reflection modal */}` comment, insert:

  ```tsx
        {reflection && (
          <LearningPlanSection
            lastAudit={selected}
            loading={false}
            onPlanUpdated={(updated) => {
              setSelected(updated);
              setReports(prev => prev.map(r =>
                (r._id ?? r.id) === (updated._id ?? updated.id) ? updated : r
              ));
            }}
            onNavigateToTraining={() => {}}
            onGeneratePlan={selected.totalScore < 100 ? handleGeneratePlan : undefined}
            isGenerating={planLoading}
            planError={planError}
          />
        )}

  ```

- [ ] **Step 7: Typecheck frontend**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/components/employee/MyReportsView.tsx
  git commit -m "feat: hide reflection Q2 at 100% and add learning plan section in MyReportsView"
  ```

---

## Task 5: Frontend — Monthly grouping toggle in AdminReportsListView

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

**Interfaces:**
- Produces: `groupMode` state toggles between `'quarter'` and `'month'`; monthly groups use `MONTHS_UK[report.month - 1] + ' ' + year`; reports without `month` go into a `'Без місяця'` group

---

- [ ] **Step 1: Add groupMode state**

  Open `frontend/src/components/admin/AdminReportsListView.tsx`.

  Find the block of `useState` declarations (the last one is around `editingPlan`). Add after `const [planError, ...]`:
  ```typescript
  const [groupMode, setGroupMode] = useState<'quarter' | 'month'>('quarter');
  ```

- [ ] **Step 2: Replace groupedReports and sortedGroupKeys with mode-aware versions**

  Find the current `groupedReports` const:
  ```typescript
  const groupedReports = filtered.reduce<Record<string, ReportWithUser[]>>((acc, report) => {
    const quarter = report.quarter ?? 'Q1';
    const year = report.year ?? new Date().getFullYear();
    const key = `${quarter} ${year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(report);
    return acc;
  }, {});
  ```

  Replace it (and the `sortedGroupKeys` const below it) with:

  ```typescript
  const groupedReports = groupMode === 'month'
    ? filtered.reduce<Record<string, ReportWithUser[]>>((acc, report) => {
        const m = report.month;
        const year = report.year ?? new Date().getFullYear();
        const key = m ? `${MONTHS_UK[m - 1]} ${year}` : 'Без місяця';
        if (!acc[key]) acc[key] = [];
        acc[key].push(report);
        return acc;
      }, {})
    : filtered.reduce<Record<string, ReportWithUser[]>>((acc, report) => {
        const quarter = report.quarter ?? 'Q1';
        const year = report.year ?? new Date().getFullYear();
        const key = `${quarter} ${year}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(report);
        return acc;
      }, {});

  const sortedGroupKeys = groupMode === 'month'
    ? Object.keys(groupedReports).sort((a, b) => {
        if (a === 'Без місяця') return 1;
        if (b === 'Без місяця') return -1;
        const parseMonthKey = (k: string) => {
          const parts = k.split(' ');
          const year = Number(parts[parts.length - 1]);
          const monthName = parts.slice(0, -1).join(' ');
          const month = MONTHS_UK.indexOf(monthName);
          return { year, month };
        };
        const pa = parseMonthKey(a);
        const pb = parseMonthKey(b);
        if (pb.year !== pa.year) return pb.year - pa.year;
        return pb.month - pa.month;
      })
    : Object.keys(groupedReports).sort((a, b) => {
        const [qa, ya] = a.split(' ');
        const [qb, yb] = b.split(' ');
        if (Number(yb) !== Number(ya)) return Number(yb) - Number(ya);
        return (quarterOrder[qa] ?? 99) - (quarterOrder[qb] ?? 99);
      });
  ```

- [ ] **Step 3: Add the toggle UI in the list view**

  In the list view return (after `<div className="space-y-6">`), find the header block:
  ```tsx
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Всі звіти</h1>
    <p className="text-sm text-slate-500 mt-1">Збережено звітів: {reports.length}</p>
  </div>
  ```

  Add the toggle immediately after it (before the store/search filter `<div className="flex flex-col sm:flex-row gap-4">`):

  ```tsx
  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 self-start">
    {(['quarter', 'month'] as const).map((mode) => (
      <button
        key={mode}
        onClick={() => setGroupMode(mode)}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
          groupMode === mode
            ? 'bg-white text-kameya-burgundy shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {mode === 'quarter' ? 'По кварталах' : 'По місяцях'}
      </button>
    ))}
  </div>
  ```

- [ ] **Step 4: Typecheck frontend**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/admin/AdminReportsListView.tsx
  git commit -m "feat: add monthly grouping toggle in admin reports list"
  ```

---

## Manual Verification Checklist

After all tasks are committed, start the dev servers and verify each flow:

**Task 1 + 4 — Reflection at 100%:**
- [ ] Open a report with `totalScore === 100`, click "Ознайомився" → modal shows only Q1 ("Що допомогло отримати такий результат?"), no Q2
- [ ] Submit with a short answer (< 10 chars) → error message appears
- [ ] Submit with a valid answer → reflection submits successfully, green "Рефлексію подано" badge appears

**Task 4 — Learning plan in MyReportsView:**
- [ ] Open a report with `totalScore === 100` after reflection is submitted → "При ідеальній перевірці план навчання не потрібен" message with disabled button appears
- [ ] Open a report with `totalScore < 100` before reflection → no LearningPlanSection visible
- [ ] Open a report with `totalScore < 100` after reflection → "Згенерувати план навчання" button visible and enabled
- [ ] Click "Згенерувати план навчання" → spinner, then plan appears with task groups and checkboxes
- [ ] In Admin reports list, open the same report → learning plan section shows the generated plan

**Task 5 — Monthly grouping:**
- [ ] Go to Admin → All Reports → click "По місяцях" → groups switch to month names (e.g. "Липень 2025")
- [ ] Reports without `month` field appear under "Без місяця"
- [ ] Click "По кварталах" → reverts to Q1/Q2/Q3/Q4 grouping

**Task 2 — Dashboard fix:**
- [ ] On production (or with a seeded report missing `month` field): go to Admin Dashboard → switch to "Місяць" → navigate to the relevant month → verify the previously missing reports now appear
