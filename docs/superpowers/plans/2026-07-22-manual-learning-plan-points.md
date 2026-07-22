# Manual Learning Plan Points Award — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin manually award 5 or 10 points to an employee for completing the training plan offline, with the ability to overwrite or delete the award.

**Architecture:** Store the awarded amount on the Report document (`learningPlanManualPoints`) so the admin panel always knows the current state without extra queries. A single endpoint handles award, overwrite, and deletion. The frontend adds an inline picker to the existing learning plan panel in `AdminReportsListView`.

**Tech Stack:** Node.js + Express + Mongoose (backend), React + TypeScript + Tailwind CSS (frontend)

## Global Constraints

- Ukrainian UI text only — never English labels visible to users
- `kameya-burgundy` (`#7B1C3A`) for primary accent color
- No new npm packages
- Quarter values: `'Q1' | 'Q2' | 'Q3' | 'Q4'`; year is a number
- Points values allowed: `5` or `10` only (or `null` to delete)
- Transaction note format: `"За проходження плану навчання Q2 2025"` (quarter + space + year)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/models/PointsTransaction.ts` | Add `'learning_plan_manual'` to `TransactionReason` |
| `backend/src/models/Report.ts` | Add `learningPlanManualPoints?: 5 \| 10` to `IReport` and schema |
| `backend/src/routes/reports.ts` | Add `POST /:id/award-learning-plan-points` endpoint |
| `frontend/src/types.ts` | Add `learningPlanManualPoints?: 5 \| 10` to `AuditResult` |
| `frontend/src/services/reportsService.ts` | Add `awardLearningPlanPoints` function |
| `frontend/src/components/admin/AdminReportsListView.tsx` | Add 3 state vars + `handleAwardManualPoints` + UI block in plan panel |

---

## Task 1: Backend model changes

**Files:**
- Modify: `backend/src/models/PointsTransaction.ts`
- Modify: `backend/src/models/Report.ts:66-85` (IReport interface) and `backend/src/models/Report.ts:159-177` (ReportSchema)

**Interfaces:**
- Produces: `TransactionReason` now includes `'learning_plan_manual'`; `IReport.learningPlanManualPoints?: 5 | 10`

- [ ] **Step 1: Add `learning_plan_manual` to `PointsTransaction.ts`**

Open `backend/src/models/PointsTransaction.ts`. Change line 3 and line 27:

```ts
// line 3 — type
export type TransactionReason = 'score' | 'reflection' | 'streak' | 'reflection_penalty' | 'learning_plan_manual';

// line 27 — schema enum
reason: { type: String, enum: ['score', 'reflection', 'streak', 'reflection_penalty', 'learning_plan_manual'], default: 'score' },
```

- [ ] **Step 2: Add `learningPlanManualPoints` to `Report.ts` interface**

In `backend/src/models/Report.ts`, add to the `IReport` interface (after `audioRecordings` line 83):

```ts
learningPlanManualPoints?: 5 | 10;
```

- [ ] **Step 3: Add `learningPlanManualPoints` to ReportSchema**

In `backend/src/models/Report.ts`, add to `ReportSchema` (after `audioRecordings` line 176):

```ts
learningPlanManualPoints: { type: Number, enum: [5, 10] },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/PointsTransaction.ts backend/src/models/Report.ts
git commit -m "feat: add learning_plan_manual transaction reason and learningPlanManualPoints field"
```

---

## Task 2: Backend endpoint

**Files:**
- Modify: `backend/src/routes/reports.ts`

**Interfaces:**
- Consumes: `TransactionReason` (`'learning_plan_manual'`), `IReport.learningPlanManualPoints`, `PointsTransaction`, `User`
- Produces: `POST /api/reports/:id/award-learning-plan-points` returns updated report JSON

- [ ] **Step 1: Add the endpoint to `reports.ts`**

Find the end of the `toggle-learning-task` handler (around line 999, just before `// POST /api/reports/:id/reflection`). Insert after it:

```ts
// POST /api/reports/:id/award-learning-plan-points — admin manual points for learning plan
router.post('/:id/award-learning-plan-points', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Тільки для адміністраторів' });
    }

    const { points } = req.body as { points: 5 | 10 | null };

    if (points !== null && points !== 5 && points !== 10) {
      return res.status(400).json({ message: 'Допустимі значення балів: 5, 10 або null' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    // Remove previous manual award if exists
    if (report.learningPlanManualPoints) {
      const prev = await PointsTransaction.findOneAndDelete({
        reportId: report._id,
        reason: 'learning_plan_manual',
      });
      if (prev) {
        await User.findByIdAndUpdate(report.userId, [
          { $set: { points: { $max: [{ $subtract: ['$points', prev.pointsAwarded] }, 0] } } },
        ]);
      }
      report.learningPlanManualPoints = undefined;
    }

    if (points) {
      await PointsTransaction.create({
        userId: report.userId,
        reportId: report._id,
        quarter: report.quarter,
        year: report.year,
        scorePercent: 0,
        pointsAwarded: points,
        reason: 'learning_plan_manual',
        note: `За проходження плану навчання ${report.quarter} ${report.year}`,
      });

      await User.findByIdAndUpdate(report.userId, { $inc: { points } });
      report.learningPlanManualPoints = points;
    }

    await report.save();
    return res.json(report);
  } catch (error) {
    console.error('award-learning-plan-points error:', error);
    return res.status(500).json({ message: 'Помилка нарахування балів' });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test — award 5 points**

Start the backend if not running (`npm run dev` in `/backend`), then:

```bash
# Replace TOKEN and IDs with real values from the running app
curl -s -X POST http://localhost:3001/api/reports/<REPORT_ID>/award-learning-plan-points \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"points": 5}' | jq '.learningPlanManualPoints'
```

Expected output: `5`

- [ ] **Step 4: Smoke test — overwrite with 10 points**

```bash
curl -s -X POST http://localhost:3001/api/reports/<REPORT_ID>/award-learning-plan-points \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"points": 10}' | jq '.learningPlanManualPoints'
```

Expected output: `10`

- [ ] **Step 5: Smoke test — delete award**

```bash
curl -s -X POST http://localhost:3001/api/reports/<REPORT_ID>/award-learning-plan-points \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"points": null}' | jq '.learningPlanManualPoints'
```

Expected output: `null`

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add POST award-learning-plan-points endpoint"
```

---

## Task 3: Frontend types and service

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/reportsService.ts`

**Interfaces:**
- Produces: `AuditResult.learningPlanManualPoints?: 5 | 10`; `awardLearningPlanPoints(reportId, points): Promise<AuditResult>`

- [ ] **Step 1: Add field to `AuditResult` in `frontend/src/types.ts`**

In the `AuditResult` interface (around line 52, after `audioRecordings`), add:

```ts
learningPlanManualPoints?: 5 | 10;
```

- [ ] **Step 2: Add service function to `reportsService.ts`**

At the bottom of `frontend/src/services/reportsService.ts` (before the last `export type { AudioRecording }` line), add:

```ts
export const awardLearningPlanPoints = async (
  reportId: string,
  points: 5 | 10 | null,
): Promise<AuditResult> => {
  const res = await apiFetch(`/api/reports/${reportId}/award-learning-plan-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка нарахування балів');
  }
  return res.json();
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/reportsService.ts
git commit -m "feat: add awardLearningPlanPoints service and AuditResult field"
```

---

## Task 4: Admin UI — manual points picker in learning plan panel

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

**Interfaces:**
- Consumes: `awardLearningPlanPoints` from `reportsService`, `selected.learningPlanManualPoints`

- [ ] **Step 1: Add import for `awardLearningPlanPoints`**

In `AdminReportsListView.tsx` line 4, extend the existing import from `reportsService`:

```ts
import { getAllReports, deleteReport, generateAiRecommendations, updateReportPeriod, deleteLearningPlan, updateLearningPlanTasks, generateLearningPlan, awardLearningPlanPoints } from '../../services/reportsService';
```

- [ ] **Step 2: Add 3 state variables**

After the existing state declarations (around line 51, after `planError`), add:

```ts
const [manualPointsLoading, setManualPointsLoading] = useState(false);
const [manualPointsError, setManualPointsError] = useState<string | null>(null);
const [showManualPointsPicker, setShowManualPointsPicker] = useState(false);
```

- [ ] **Step 3: Add handler function**

After `applyPlanUpdate` (around line 204), add:

```ts
const handleAwardManualPoints = async (points: 5 | 10 | null) => {
  if (!selected) return;
  setManualPointsError(null);
  setManualPointsLoading(true);
  try {
    const updated = await awardLearningPlanPoints(selected._id ?? selected.id ?? '', points);
    applyPlanUpdate(updated);
    setShowManualPointsPicker(false);
  } catch (err) {
    setManualPointsError(err instanceof Error ? err.message : 'Помилка нарахування балів');
  } finally {
    setManualPointsLoading(false);
  }
};
```

- [ ] **Step 4: Add UI block inside the learning plan panel**

In `AdminReportsListView.tsx`, find the end of the Learning Plan panel — the line that reads `{planError && <p ...>}` (around line 672). Insert the new UI block **after** that line and **before** the closing `</div>` of the panel:

```tsx
{/* Manual points award */}
<div className="mt-3 pt-3 border-t border-slate-100">
  {selected?.learningPlanManualPoints ? (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-green-600 flex items-center gap-1.5">
        <i className="fas fa-circle-check"></i>
        Нараховано {selected.learningPlanManualPoints} балів вручну
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setManualPointsError(null); setShowManualPointsPicker(true); }}
          disabled={manualPointsLoading}
          className="text-slate-400 hover:text-kameya-burgundy transition-colors disabled:opacity-40"
          title="Змінити нарахування"
        >
          <i className="fas fa-pen text-xs"></i>
        </button>
        <button
          onClick={() => handleAwardManualPoints(null)}
          disabled={manualPointsLoading}
          className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
          title="Видалити нарахування"
        >
          {manualPointsLoading ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-trash-can text-xs"></i>}
        </button>
      </div>
    </div>
  ) : !showManualPointsPicker ? (
    <button
      onClick={() => { setManualPointsError(null); setShowManualPointsPicker(true); }}
      disabled={manualPointsLoading}
      className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 flex items-center gap-1 disabled:opacity-40"
    >
      <i className="fas fa-plus-circle"></i>
      Нарахувати бали вручну
    </button>
  ) : null}

  {showManualPointsPicker && (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500">Оберіть кількість балів:</span>
      <button
        onClick={() => handleAwardManualPoints(5)}
        disabled={manualPointsLoading}
        className="px-3 py-1 text-xs font-bold rounded-lg border-2 border-kameya-burgundy text-kameya-burgundy hover:bg-kameya-burgundy hover:text-white transition-colors disabled:opacity-40"
      >
        {manualPointsLoading ? <i className="fas fa-spinner fa-spin"></i> : '5 балів'}
      </button>
      <button
        onClick={() => handleAwardManualPoints(10)}
        disabled={manualPointsLoading}
        className="px-3 py-1 text-xs font-bold rounded-lg border-2 border-kameya-burgundy text-kameya-burgundy hover:bg-kameya-burgundy hover:text-white transition-colors disabled:opacity-40"
      >
        {manualPointsLoading ? <i className="fas fa-spinner fa-spin"></i> : '10 балів'}
      </button>
      <button
        onClick={() => { setShowManualPointsPicker(false); setManualPointsError(null); }}
        disabled={manualPointsLoading}
        className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40"
      >
        Скасувати
      </button>
    </div>
  )}

  {manualPointsError && <p className="text-xs text-red-500 mt-1">{manualPointsError}</p>}
</div>
```

- [ ] **Step 5: Reset picker when selected report changes**

Find the `useEffect` that handles `initialReportId` (around line 53). Add a separate `useEffect` after the existing ones (before the `filtered` variable definition) to reset picker state on report change:

```ts
useEffect(() => {
  setShowManualPointsPicker(false);
  setManualPointsError(null);
}, [selected?._id ?? selected?.id]);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual UI test**

1. Start backend (`npm run dev` in `/backend`) and frontend (`npm run dev` in `/frontend`)
2. Log in as admin
3. Open any report in the reports list
4. Scroll to the "План навчання" panel
5. Verify "Нарахувати бали вручну" button is visible
6. Click it — verify two option buttons appear: "5 балів" and "10 балів" and "Скасувати"
7. Click "5 балів" — verify panel shows "Нараховано 5 балів вручну" with pencil + trash icons
8. Click pencil icon — verify picker re-appears
9. Click "10 балів" — verify badge updates to "Нараховано 10 балів вручну"
10. Click trash icon — verify badge disappears and "Нарахувати бали вручну" button returns
11. Close panel and reopen same report — verify persisted state is correct

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: add manual learning plan points UI in admin report panel"
```
