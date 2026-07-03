# Badge Preview on Report Confirm — Design Spec

**Date**: 2026-07-03  
**Status**: Approved

## Problem

When an admin uploads a questionnaire (анкета) and confirms it, badges are awarded automatically in the background. The admin has no visibility into which badge the employee will receive or why, and no ability to intervene before it happens.

## Goal

Show the admin a badge preview in step 2 of the report upload flow (before confirmation), including the badge name, icon, and the condition that triggered it. The admin can then accept the auto-award, cancel it, or replace it with a different badge of their choice.

## Scope

Single feature: badge preview + override in `ReportsUploadView`. No changes to employee-facing views. No changes to the existing `BadgesModal` in `UsersView`.

---

## Architecture

### Backend

#### New function: `computePendingBadges`

Extract the read-only evaluation logic from `evaluateOnReportConfirm` into a pure async function:

```ts
export async function computePendingBadges(
  userId: string,
  totalScore: number,
  quarter: string,
  year: number,
): Promise<{ badgeId: BadgeId; year?: number }[]>
```

- Reads user badges and reports from DB, computes which badges *would* be earned
- Does **not** write anything
- `evaluateOnReportConfirm` is refactored to call this function and then apply the results

#### New endpoint: `GET /api/reports/preview-badges`

**Auth**: ADMIN only  
**Query params**: `userId`, `totalScore`, `quarter`, `year`

**Logic**: calls `computePendingBadges`, enriches each result with display metadata from `BADGE_CATALOGUE` (name, icon, color, condition), returns the array.

**Response** (200):
```json
[
  {
    "badgeId": "first_report",
    "name": "Перша перевірка",
    "icon": "fas fa-clipboard-check",
    "color": "text-blue-500",
    "condition": "Отримай перший звіт від таємного покупця"
  }
]
```

Empty array `[]` if no badges would be earned.

#### Modified endpoint: `POST /api/reports/confirm`

New optional body field:
```ts
badgeOverride?: { action: 'cancel' | 'replace'; replaceBadgeId?: BadgeId }
```

Behavior:
- **No `badgeOverride`** (default): `evaluateOnReportConfirm` runs as before
- **`action: 'cancel'`**: `evaluateOnReportConfirm` is skipped entirely — no badges awarded
- **`action: 'replace'`**: `evaluateOnReportConfirm` is skipped, instead `replaceBadgeId` is manually pushed to the user's badges array (with `earnedAt: new Date()`)

`replaceBadgeId` is required when `action === 'replace'`; backend validates and returns 400 if missing or not a valid `BadgeId`.

---

### Frontend

#### New service function

```ts
export const previewBadges = async (
  userId: string,
  totalScore: number,
  quarter: string,
  year: number,
): Promise<BadgePreview[]>
```

Calls `GET /api/reports/preview-badges`.

#### New type

```ts
export interface BadgePreview {
  badgeId: BadgeId;
  name: string;
  icon: string;
  color: string;
  condition: string;
  year?: number;
}
```

#### New state in `ReportsUploadView`

```ts
const [badgePreview, setBadgePreview] = useState<BadgePreview[]>([]);
const [badgeOverride, setBadgeOverride] = useState<
  { action: 'cancel' | 'replace'; replaceBadgeId?: BadgeId } | null
>(null);
const [replaceBadgeId, setReplaceBadgeId] = useState<BadgeId | ''>('');
const [userBadgeIds, setUserBadgeIds] = useState<BadgeId[]>([]);
```

#### Trigger

After `parseReport` succeeds → call `previewBadges(selectedUserId, result.totalScore, selectedQuarter, selectedYear)` and store result in `badgePreview`. Errors are silently ignored (badge preview is non-critical).

When employee is selected (`handleSelectEmployee`) → fetch their current badge IDs to filter the replacement dropdown. Use existing `GET /api/reports/my/badges` or a user-scoped endpoint; add `GET /api/users/:id/badges` (admin) if not available.

#### UI block (step 2 only, before action buttons)

Rendered only when `badgePreview.length > 0`.

```
┌─────────────────────────────────────────────────────┐
│ 🏅 Нагорода за цей звіт                             │
│                                                     │
│  [icon] Badge Name                                  │
│         Condition text                              │
│                                                     │
│  ○ Нарахувати (за замовчуванням)                    │
│  ○ Скасувати нагороду                               │
│  ○ Замінити на інший бейдж  ▼ [dropdown]            │
└─────────────────────────────────────────────────────┘
```

- If multiple badges: all shown, override applies to **all** (cancel all or replace all with one chosen badge)
- Default selected option: "Нарахувати" (no override sent)
- Dropdown for replace: all 9 catalogue badges **except** those already owned by the employee

#### Confirm call

```ts
confirmReport({
  ...payload,
  ...(badgeOverride ? { badgeOverride } : {}),
})
```

#### Reset

`handleReset` clears: `badgePreview`, `badgeOverride`, `replaceBadgeId`, `userBadgeIds`.

---

## Data Flow

```
Admin uploads PDF
       ↓
  /parse → parsed result
       ↓
  /preview-badges (parallel with affirmation preview if score=100)
       ↓
  Step 2 shows badge block + radio override
       ↓
  Admin chooses: award / cancel / replace
       ↓
  /confirm  (with optional badgeOverride)
       ↓
  Backend saves report + applies badge logic per override
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No badges would be earned | Badge block hidden entirely |
| Employee already has the badge | `computePendingBadges` already excludes it (existing `has()` check) |
| Admin picks replace but no badge selected | Confirm button stays disabled until selection made |
| `preview-badges` request fails | Badge block hidden; confirm proceeds without override |
| `replaceBadgeId` not in catalogue | Backend returns 400 |

---

## Files Changed

**Backend**
- `backend/src/services/badgeService.ts` — extract `computePendingBadges`, refactor `evaluateOnReportConfirm`
- `backend/src/routes/reports.ts` — add `GET /preview-badges`, update `POST /confirm` to handle `badgeOverride`

**Frontend**
- `frontend/src/services/reportsService.ts` — add `previewBadges`, `BadgePreview` type, update `ConfirmReportPayload`
- `frontend/src/components/admin/ReportsUploadView.tsx` — new state, preview fetch, badge UI block, pass override to confirm
- `frontend/src/types.ts` — add `BadgePreview` if shared (or keep in reportsService)
