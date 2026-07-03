# Badge Preview on Report Confirm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the admin a badge preview (name, icon, condition) in step 2 of the report upload flow, and allow them to cancel or replace the auto-awarded badge before confirming.

**Architecture:** Extract a pure `computePendingBadges` function from `evaluateOnReportConfirm` (with an optional `excludeReportId` param to avoid double-counting after save). A new `GET /api/reports/preview-badges` endpoint exposes it. `POST /confirm` gains an optional `badgeOverride` body field. The frontend fetches the preview after parsing, shows a radio-group override UI block in step 2, and forwards the override choice to confirm.

**Tech Stack:** Node.js/Express/TypeScript (backend), React/TypeScript/Tailwind (frontend), MongoDB/Mongoose

## Global Constraints

- All UI text in Ukrainian
- Admin-only backend endpoints: guard with `req.user?.role !== 'ADMIN'` → 403
- `BadgeId` type lives in `backend/src/constants/badges.ts` (backend) and `frontend/src/types.ts` (frontend)
- `BADGE_CATALOGUE` with display metadata lives in `frontend/src/constants/badges.ts`
- Tailwind CSS only; primary color class: `kameya-burgundy`
- No new npm packages

---

## File Map

| File | Change |
|------|--------|
| `backend/src/services/badgeService.ts` | Add `computePendingBadges`; refactor `evaluateOnReportConfirm` to use it |
| `backend/src/routes/reports.ts` | Add `GET /preview-badges`; update `POST /confirm` for `badgeOverride` |
| `frontend/src/services/reportsService.ts` | Add `BadgePreview` type, `previewBadges` function; update `ConfirmReportPayload` |
| `frontend/src/components/admin/ReportsUploadView.tsx` | New state, post-parse fetch, badge preview UI block, override forwarded to confirm, reset |

`GET /api/users/:id/badges` and `getUserBadges()` already exist — no changes needed.

---

### Task 1: Extract `computePendingBadges` and refactor `evaluateOnReportConfirm`

**Files:**
- Modify: `backend/src/services/badgeService.ts`

**Interfaces:**
- Produces: `export async function computePendingBadges(userId: string | Types.ObjectId, totalScore: number, quarter: string, year: number, excludeReportId?: string | Types.ObjectId): Promise<{ badgeId: BadgeId; year?: number }[]>`

- [ ] **Step 1: Replace the file content**

Open `backend/src/services/badgeService.ts` and replace the entire file with:

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

/**
 * Pure read-only simulation: computes which badges would be earned if a report
 * with the given params were confirmed. Does not write to DB.
 *
 * excludeReportId: when called after a report is already saved (i.e. from
 * evaluateOnReportConfirm), pass the new report's _id so it is excluded from
 * the DB query and instead treated as the synthetic "incoming" report.
 * Without this param (preview mode), the report does not yet exist in DB.
 */
export async function computePendingBadges(
  userId: string | Types.ObjectId,
  totalScore: number,
  quarter: string,
  year: number,
  excludeReportId?: string | Types.ObjectId,
): Promise<{ badgeId: BadgeId; year?: number }[]> {
  const user = await User.findById(userId);
  if (!user) return [];

  const dbQuery: Record<string, unknown> = { userId };
  if (excludeReportId) dbQuery['_id'] = { $ne: excludeReportId };

  const existingReports = await Report.find(dbQuery).sort({ createdAt: 1 }).lean();
  const allReports = [...existingReports, { quarter, totalScore, year }];

  const pending: { badgeId: BadgeId; year?: number }[] = [];
  const has = (id: BadgeId) => user.badges.some(b => b.badgeId === id);
  const hasForYear = (id: BadgeId, y: number) =>
    user.badges.some(b => b.badgeId === id && b.year === y);

  // ── Старт ──────────────────────────────────────────────────────────────────
  if (!has('first_report')) {
    pending.push({ badgeId: 'first_report' });
  }

  if (!has('first_perfect') && allReports.length === 1 && allReports[0].totalScore === 100) {
    pending.push({ badgeId: 'first_perfect' });
  }

  // ── Серія ──────────────────────────────────────────────────────────────────
  const yearReports = allReports.filter(r => r.year === year);
  const milestones = calcSeriesMilestones(yearReports);

  for (const m of milestones) {
    const badgeId: BadgeId = m === 2 ? 'silver_guide' : m === 3 ? 'gold_series' : 'platinum_standard';
    if (!hasForYear(badgeId, year)) {
      pending.push({ badgeId, year });
    }
  }

  // ── Камбек ─────────────────────────────────────────────────────────────────
  if (allReports.length >= 2) {
    let historicalComebacks = 0;
    for (let i = 1; i < allReports.length; i++) {
      const prev = allReports[i - 1] as typeof existingReports[0];
      const curr = allReports[i];
      const prevHasCompletedPlan =
        'learningPlan' in prev &&
        !!prev.learningPlan?.tasks?.length &&
        prev.learningPlan.tasks.every((t: { isCompleted: boolean }) => t.isCompleted);
      if (prev.totalScore < 85 && prevHasCompletedPlan && curr.totalScore === 100) {
        historicalComebacks++;
      }
    }
    const existingComebacks = user.badges.filter(b => b.badgeId === 'comeback').length;
    if (existingComebacks < historicalComebacks) {
      pending.push({ badgeId: 'comeback' });
    }
  }

  return pending;
}

export async function evaluateOnReportConfirm(
  userId: string | Types.ObjectId,
  reportId: string | Types.ObjectId,
): Promise<void> {
  const report = await Report.findById(reportId).lean();
  if (!report) return;

  const pending = await computePendingBadges(
    userId,
    report.totalScore,
    report.quarter,
    report.year ?? new Date().getFullYear(),
    reportId,
  );

  if (pending.length > 0) {
    const newBadges = pending.map(b => ({ ...b, earnedAt: new Date() }));
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/badgeService.ts
git commit -m "refactor: extract computePendingBadges from evaluateOnReportConfirm"
```

---

### Task 2: Add `GET /preview-badges` and update `POST /confirm` in `reports.ts`

**Files:**
- Modify: `backend/src/routes/reports.ts`

**Interfaces:**
- Consumes: `computePendingBadges` from Task 1
- Produces:
  - `GET /api/reports/preview-badges?userId&totalScore&quarter&year` → `{ badgeId: BadgeId; year?: number }[]`
  - `POST /api/reports/confirm` body: existing fields + optional `badgeOverride: { action: 'cancel' | 'replace'; replaceBadgeId?: string }`

- [ ] **Step 1: Update the badge service import**

In `backend/src/routes/reports.ts`, find the existing badge service import line:

```typescript
import { evaluateOnReportConfirm, evaluateOnLearningPlanComplete } from '../services/badgeService';
```

Replace it with:

```typescript
import { evaluateOnReportConfirm, evaluateOnLearningPlanComplete, computePendingBadges } from '../services/badgeService';
import { YEARLY_BADGE_IDS } from '../constants/badges';
```

- [ ] **Step 2: Add `GET /preview-badges` endpoint**

Find the comment `// GET /api/reports — всі звіти (адмін)` (around line 474) and insert the following route **before** it:

```typescript
// GET /api/reports/preview-badges?userId=X&totalScore=Y&quarter=Q&year=Y
router.get('/preview-badges', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  const { userId, totalScore, quarter, year } = req.query;
  if (!userId || totalScore === undefined || !quarter || !year) {
    return res.status(400).json({ message: 'userId, totalScore, quarter, year обов\'язкові' });
  }
  try {
    const pending = await computePendingBadges(
      userId as string,
      Number(totalScore),
      quarter as string,
      Number(year),
    );
    return res.json(pending);
  } catch (error) {
    console.error('[preview-badges] error:', error);
    return res.status(500).json({ message: 'Помилка обчислення нагород' });
  }
});
```

- [ ] **Step 3: Update `POST /confirm` to handle `badgeOverride`**

In the `POST /confirm` handler, find this block (around line 279–281):

```typescript
    evaluateOnReportConfirm(userId, report._id as import('mongoose').Types.ObjectId)
      .catch(err => console.error('[badge] report eval failed:', err));
```

Replace it with:

```typescript
    const badgeOverride = req.body.badgeOverride as
      | { action: 'cancel' | 'replace'; replaceBadgeId?: string }
      | undefined;

    if (!badgeOverride) {
      evaluateOnReportConfirm(userId, report._id as import('mongoose').Types.ObjectId)
        .catch(err => console.error('[badge] report eval failed:', err));
    } else if (badgeOverride.action === 'replace') {
      const { replaceBadgeId } = badgeOverride;
      if (!replaceBadgeId) {
        return res.status(400).json({ message: 'replaceBadgeId обов\'язковий для дії replace' });
      }
      const isYearly = (YEARLY_BADGE_IDS as Set<string>).has(replaceBadgeId);
      User.findByIdAndUpdate(userId, {
        $push: {
          badges: {
            badgeId: replaceBadgeId,
            earnedAt: new Date(),
            ...(isYearly ? { year: Number(year) } : {}),
          },
        },
      }).catch(err => console.error('[badge] replace override failed:', err));
    }
    // action === 'cancel': skip badge evaluation entirely — nothing to do
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Manual test — preview-badges endpoint**

Start the backend. With a valid admin JWT token:

```bash
# Employee with no existing reports — expects first_report (and first_perfect if score=100)
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "http://localhost:3001/api/reports/preview-badges?userId=<EMPLOYEE_ID>&totalScore=100&quarter=Q1&year=2026"
# Expected: [{"badgeId":"first_report"},{"badgeId":"first_perfect"}]

# Employee who already has first_report — expects only first_perfect (if score=100 and no prior reports... actually won't match)
# Try score=85 for an employee with 1 existing report
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "http://localhost:3001/api/reports/preview-badges?userId=<EMPLOYEE_ID>&totalScore=85&quarter=Q2&year=2026"
# Expected: [] (no badges for score 85, first_report already earned)
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add preview-badges endpoint and badgeOverride support in confirm"
```

---

### Task 3: Add `BadgePreview` type and `previewBadges` service function

**Files:**
- Modify: `frontend/src/services/reportsService.ts`

**Interfaces:**
- Produces:
  - `export interface BadgePreview { badgeId: BadgeId; name: string; icon: string; color: string; condition: string; year?: number; }`
  - `export const previewBadges: (userId: string, totalScore: number, quarter: string, year: number) => Promise<BadgePreview[]>`
  - Updated `ConfirmReportPayload` with `badgeOverride?: { action: 'cancel' | 'replace'; replaceBadgeId?: BadgeId }`

- [ ] **Step 1: Add `BadgeId` to existing types import**

In `frontend/src/services/reportsService.ts`, find the first import line:

```typescript
import { AuditResult, LearningTask, PointsTransaction, ScoreInsight } from '../types';
```

Replace with:

```typescript
import { AuditResult, LearningTask, PointsTransaction, ScoreInsight, BadgeId } from '../types';
import { BADGE_CATALOGUE } from '../constants/badges';
```

- [ ] **Step 2: Add `BadgePreview` interface**

After the import block, add:

```typescript
export interface BadgePreview {
  badgeId: BadgeId;
  name: string;
  icon: string;
  color: string;
  condition: string;
  year?: number;
}
```

- [ ] **Step 3: Update `ConfirmReportPayload`**

Find the existing `ConfirmReportPayload` interface and add the optional field:

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
  month?: number;
  affirmation?: string;
  badgeOverride?: { action: 'cancel' | 'replace'; replaceBadgeId?: BadgeId };
}
```

- [ ] **Step 4: Add `previewBadges` function**

At the end of `frontend/src/services/reportsService.ts`, add:

```typescript
export const previewBadges = async (
  userId: string,
  totalScore: number,
  quarter: string,
  year: number,
): Promise<BadgePreview[]> => {
  try {
    const params = new URLSearchParams({
      userId,
      totalScore: String(totalScore),
      quarter,
      year: String(year),
    });
    const res = await fetch(`/api/reports/preview-badges?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const raw: { badgeId: BadgeId; year?: number }[] = await res.json();
    return raw.flatMap(item => {
      const def = BADGE_CATALOGUE.find(b => b.badgeId === item.badgeId);
      if (!def) return [];
      return [{
        badgeId: def.badgeId,
        name: def.name,
        icon: def.icon,
        color: def.color,
        condition: def.condition,
        year: item.year,
      }];
    });
  } catch {
    return [];
  }
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/reportsService.ts
git commit -m "feat: add BadgePreview type and previewBadges service function"
```

---

### Task 4: Badge preview UI in `ReportsUploadView`

**Files:**
- Modify: `frontend/src/components/admin/ReportsUploadView.tsx`

**Interfaces:**
- Consumes: `previewBadges`, `BadgePreview` from Task 3 (`../../services/reportsService`)
- Consumes: `getUserBadges` from `../../services/usersService` (already exists)
- Consumes: `BADGE_CATALOGUE` from `../../constants/badges` (already exists)
- Consumes: `BadgeId` from `../../types` (already exists in project)

- [ ] **Step 1: Update imports**

At the top of `ReportsUploadView.tsx`, add to the existing reportsService import:

```typescript
import { parseReport, confirmReport, previewAffirmation, previewBadges, ParsedReport, BadgePreview } from '../../services/reportsService';
```

Add new imports for the badge catalogue and user badges service:

```typescript
import { getUserBadges } from '../../services/usersService';
import { BADGE_CATALOGUE } from '../../constants/badges';
import { BadgeId } from '../../types';
```

- [ ] **Step 2: Add new state variables**

Inside `ReportsUploadView`, after the existing state declarations (after `const dropdownRef = ...`), add:

```typescript
const [badgePreview, setBadgePreview] = useState<BadgePreview[]>([]);
const [badgeOverrideMode, setBadgeOverrideMode] = useState<'award' | 'cancel' | 'replace'>('award');
const [replaceBadgeId, setReplaceBadgeId] = useState<BadgeId | ''>('');
const [userBadgeIds, setUserBadgeIds] = useState<BadgeId[]>([]);
```

- [ ] **Step 3: Fetch user badge IDs on employee select**

Find `handleSelectEmployee` and update it to also fetch the employee's current badges:

```typescript
  const handleSelectEmployee = (employee: UserListItem) => {
    setSelectedUserId(employee._id);
    setSelectedEmployee(employee);
    setShowDropdown(false);
    setSearchQuery('');
    getUserBadges(employee._id)
      .then(awards => setUserBadgeIds(awards.map(a => a.badgeId)))
      .catch(() => setUserBadgeIds([]));
  };
```

- [ ] **Step 4: Fetch badge preview after parse**

Find `handleParse`. After `setParsed(result)` and `setStep('preview')`, add the preview fetch call. Replace this block:

```typescript
      setParsed(result);
      setStep('preview');
      if (result.totalScore >= 100) fetchAffirmationPreview(selectedUserId);
```

With:

```typescript
      setParsed(result);
      setStep('preview');
      if (result.totalScore >= 100) fetchAffirmationPreview(selectedUserId);
      previewBadges(selectedUserId, result.totalScore, selectedQuarter, selectedYear)
        .then(badges => setBadgePreview(badges))
        .catch(() => setBadgePreview([]));
```

- [ ] **Step 5: Build `badgeOverride` and pass it in `handleConfirm`**

Find `handleConfirm` and replace its entire body with:

```typescript
  const handleConfirm = async () => {
    if (!parsed) return;
    setError(null);
    setStep('saving');
    try {
      const badgeOverride =
        badgeOverrideMode === 'cancel'
          ? { action: 'cancel' as const }
          : badgeOverrideMode === 'replace' && replaceBadgeId
          ? { action: 'replace' as const, replaceBadgeId }
          : undefined;

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
        month: selectedMonth,
        ...(affirmationPreview ? { affirmation: affirmationPreview } : {}),
        ...(badgeOverride ? { badgeOverride } : {}),
      });
      setAwardedPoints(result.pointsAwarded);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
      setStep('preview');
    }
  };
```

- [ ] **Step 6: Clear new state in `handleReset`**

Find `handleReset` and add before the closing `}`:

```typescript
    setBadgePreview([]);
    setBadgeOverrideMode('award');
    setReplaceBadgeId('');
    setUserBadgeIds([]);
```

- [ ] **Step 7: Add the badge preview UI block in step 2**

In the step 2 section (`(step === 'preview' || step === 'saving') && parsed`), find the affirmation block:

```tsx
          {parsed.totalScore >= 100 && (
            <div className="bg-kameya-burgundy/10 ...">
              ...
            </div>
          )}
```

Insert the following block **immediately after** that closing `)}`:

```tsx
          {badgePreview.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <i className="fas fa-medal text-amber-400"></i>
                Нагорода за цей звіт
              </p>

              <div className="space-y-2">
                {badgePreview.map((badge) => (
                  <div key={badge.badgeId} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <i className={`${badge.icon} ${badge.color} text-lg mt-0.5 flex-shrink-0`}></i>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {badge.name}{badge.year ? ` (${badge.year})` : ''}
                      </p>
                      <p className="text-xs text-slate-500">{badge.condition}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="badgeOverride"
                    value="award"
                    checked={badgeOverrideMode === 'award'}
                    onChange={() => { setBadgeOverrideMode('award'); setReplaceBadgeId(''); }}
                    className="accent-kameya-burgundy"
                  />
                  <span className="text-sm text-slate-700">Нарахувати (за замовчуванням)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="badgeOverride"
                    value="cancel"
                    checked={badgeOverrideMode === 'cancel'}
                    onChange={() => { setBadgeOverrideMode('cancel'); setReplaceBadgeId(''); }}
                    className="accent-kameya-burgundy"
                  />
                  <span className="text-sm text-slate-700">Скасувати нагороду</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="badgeOverride"
                    value="replace"
                    checked={badgeOverrideMode === 'replace'}
                    onChange={() => setBadgeOverrideMode('replace')}
                    className="accent-kameya-burgundy"
                  />
                  <span className="text-sm text-slate-700">Замінити на інший бейдж</span>
                </label>

                {badgeOverrideMode === 'replace' && (
                  <select
                    value={replaceBadgeId}
                    onChange={(e) => setReplaceBadgeId(e.target.value as BadgeId)}
                    className="mt-1 ml-6 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy w-full max-w-xs"
                  >
                    <option value="">Оберіть бейдж...</option>
                    {BADGE_CATALOGUE
                      .filter(b => !userBadgeIds.includes(b.badgeId))
                      .map(b => (
                        <option key={b.badgeId} value={b.badgeId}>{b.name}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>
          )}
```

- [ ] **Step 8: Disable confirm when replace mode but no badge selected**

Find the confirm button in the step 2 buttons row (the `<div className="flex gap-3">` block). The button currently has `disabled={step === 'saving'}`. Update it:

```tsx
              onClick={handleConfirm}
              disabled={step === 'saving' || (badgeOverrideMode === 'replace' && !replaceBadgeId)}
```

There are two confirm buttons — one in the main preview and one in the `showDetailedPreview` view. Only update the one in the **main preview** (inside the `(step === 'preview' || step === 'saving') && parsed` block, NOT inside the `showDetailedPreview` block).

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 10: Manual test in browser**

Start both backend and frontend (`npm run dev` in each). Log in as admin and test the following scenarios:

**Scenario 1 — Default award (no override)**
Upload a PDF for an employee with zero existing reports. Score = 100%. In step 2, badge block should appear showing "Перша перевірка" and "Без розгону" with the "Нарахувати" radio selected. Click confirm. Navigate to UsersView → employee badges — both badges should be present.

**Scenario 2 — Cancel override**
Upload a PDF for an employee with zero existing reports. Score = 100%. Select "Скасувати нагороду". Click confirm. Check employee badges — no new badges added.

**Scenario 3 — Replace override**
Upload a PDF for an employee. Select "Замінити на інший бейдж". Choose "Відмінник" from the dropdown. Confirm button becomes active. Click confirm. Check employee badges — "Відмінник" badge should appear, not the auto-earned ones.

**Scenario 4 — No badge (score < threshold)**
Upload a PDF for an employee who already has `first_report`, with score = 75%. Badge block should NOT appear. Confirm works as before.

**Scenario 5 — Series badge**
Upload Q2 report with score = 100% for an employee who already has a Q1 100% report in the same year. Badge block should show "Срібний гід (2026)".

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/admin/ReportsUploadView.tsx
git commit -m "feat: show badge preview and override UI in report upload step 2"
```
