# Manual Learning Plan Points Award

**Date:** 2026-07-22  
**Status:** Approved

## Problem

The learning plan section in admin reports view has no way to manually award points. When an employee completes the learning plan offline with the admin, there is no mechanism to credit their balance. The auto-completion flow only triggers when all tasks are toggled done online.

## Solution

Add a "Нарахувати бали вручну" button inside the learning plan panel in `AdminReportsListView`. The admin chooses 5 or 10 points; the backend records a points transaction and updates the user balance. The awarded amount is stored on the report so the admin can see the current state, overwrite it, or delete it.

---

## Backend

### 1. `PointsTransaction` model — `backend/src/models/PointsTransaction.ts`

Add `'learning_plan_manual'` to the `TransactionReason` union and the schema enum:

```ts
export type TransactionReason = 'score' | 'reflection' | 'streak' | 'reflection_penalty' | 'learning_plan_manual';
```

### 2. `Report` model — `backend/src/models/Report.ts`

Add optional field to the schema:

```ts
learningPlanManualPoints: { type: Number, enum: [5, 10] }
```

And to the TypeScript interface:

```ts
learningPlanManualPoints?: 5 | 10;
```

### 3. New endpoint

`POST /api/reports/:id/award-learning-plan-points`

- **Auth:** admin only (`req.user.role === 'ADMIN'`)
- **Body:** `{ points: 5 | 10 | null }`
- **Logic:**
  1. Load the report; 404 if not found
  2. If `report.learningPlanManualPoints` exists → find the existing `PointsTransaction` with `reason: 'learning_plan_manual'` and `reportId: report._id`, subtract those points from user balance (floor at 0), delete the transaction
  3. If `points` is 5 or 10 → create new `PointsTransaction` with:
     - `reason: 'learning_plan_manual'`
     - `note: "За проходження плану навчання ${report.quarter} ${report.year}"`
     - `pointsAwarded: points`
     - `quarter: report.quarter`, `year: report.year`, `scorePercent: 0`
     - Add `points` to user balance via `$inc`
     - Set `report.learningPlanManualPoints = points`
  4. If `points` is null → set `report.learningPlanManualPoints = undefined`
  5. Save report; return updated report object

### 4. Route registration

Register before `authMiddleware` restriction check in `backend/src/routes/reports.ts` (already admin-only via `req.user.role` check inside the handler).

---

## Frontend

### `frontend/src/services/reportsService.ts`

New function:

```ts
export async function awardLearningPlanPoints(
  reportId: string,
  points: 5 | 10 | null
): Promise<AuditResult>
```

Calls `POST /api/reports/:id/award-learning-plan-points` with `{ points }`.

### `frontend/src/components/admin/AdminReportsListView.tsx`

Inside the "План навчання" panel (around line 569), after the existing header and content:

**State to add:**
```ts
const [manualPointsLoading, setManualPointsLoading] = useState(false);
const [manualPointsError, setManualPointsError] = useState<string | null>(null);
const [showManualPointsPicker, setShowManualPointsPicker] = useState(false);
```

**UI logic:**

- If `selected.learningPlanManualPoints` is set:
  - Show green badge: `"Нараховано X балів"`
  - Edit icon → opens picker to change amount
  - Trash icon → calls endpoint with `null` to delete

- If not set:
  - Show button `"Нарахувати бали вручну"`
  - On click: `setShowManualPointsPicker(true)`

- Picker (inline, below the button):
  - Two buttons: `"5 балів"` and `"10 балів"` (burgundy/outline style)
  - Cancel link to close picker
  - On selection: call `awardLearningPlanPoints(id, points)`, update `selected` in state, close picker

- Error text below if `manualPointsError`

**Placement:** At the bottom of the plan panel content, below the task list / "план не згенеровано" state — always visible regardless of whether a plan exists, since the admin can award points for offline completion even without an online plan.

---

## Data flow

```
Admin clicks "5 балів"
  → POST /api/reports/:id/award-learning-plan-points { points: 5 }
  → Backend removes old transaction (if any), creates new, updates user.points
  → Returns updated report
  → Frontend updates selected report in state
  → Panel shows "Нараховано 5 балів" badge
```

---

## Edge cases

- **Re-award:** Previous transaction is deleted and balance adjusted before new one is created — net effect is correct.
- **Delete:** Balance is reduced by the previously awarded amount (floor 0), transaction deleted, `learningPlanManualPoints` cleared.
- **Concurrent clicks:** Button disabled (`manualPointsLoading`) while request is in flight.
- **Report with no user:** 404 gracefully returned; frontend shows error text.
