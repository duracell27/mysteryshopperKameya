# Design: Points System & Q-Period Reports

**Date:** 2026-04-21  
**Project:** mysteryshopperKameya

---

## Overview

Introduce a cumulative points system for employees based on mystery shopper audit scores. Each report is tagged with a quarter (Q1–Q4) and year. Points are awarded automatically when an admin confirms a report. All percentage displays use a unified color scheme.

---

## 1. Data Models

### User (existing — add field)
- `points: Int` — default `0`, cumulative across all time

### Report (existing — add fields)
- `quarter: String` — one of `"Q1" | "Q2" | "Q3" | "Q4"`
- `year: Int` — e.g., `2026`

### PointsTransaction (new model)
| Field | Type | Description |
|---|---|---|
| id | ObjectId | |
| userId | ref User | |
| reportId | ref Report | |
| quarter | String | Q1–Q4 |
| year | Int | e.g., 2026 |
| scorePercent | Float | totalScore of the report |
| pointsAwarded | Int | 0 / 50 / 100 / 150 / 200 |
| createdAt | Date | auto |

---

## 2. Points Calculation Logic

Use `Math.floor(totalScore)` (truncate, do not round):

| Floor score | Points awarded |
|---|---|
| < 80 | +0 |
| 80–89 | +50 |
| 90–94 | +100 |
| 95–99 | +150 |
| 100 | +200 |

Example: `totalScore = 94.8` → `Math.floor = 94` → `+100 points`

---

## 3. Color Scheme for Percentages

Applied **everywhere** a percentage is displayed (admin and employee views).

| Score (floored) | Color | Note |
|---|---|---|
| < 80% | Red | |
| 80–94% | Yellow | |
| 95–99% | Green | |
| 100% | 🏆 trophy icon | |

Implemented as a shared utility: `frontend/src/utils/scoreColor.ts`  
Returns Tailwind CSS class + optional icon.

---

## 4. Backend Changes

### `POST /api/reports/confirm` (extended)
- Accepts additional body fields: `quarter`, `year`
- Saves report with quarter/year
- Calculates `pointsAwarded` using the formula above
- Atomically:
  1. Creates a `PointsTransaction` record
  2. Increments `User.points` by `pointsAwarded`
- Response includes `pointsAwarded` and user's new `totalPoints`

### New endpoint
- `GET /api/users/:id/points` — admin only, returns list of PointsTransactions for a user (for audit/debugging)

### Unchanged endpoints
- `POST /api/reports/parse`, `DELETE /api/reports/:id`, `GET /api/reports/my`, `GET /api/reports/my/rank`

---

## 5. Frontend — Admin

### `ReportsUploadView`
Two new fields added to the confirm form:
- **Рік** (Year) — select: `2025`, `2026` (default: current year)
- **Квартал** (Quarter) — select: `Q1`, `Q2`, `Q3`, `Q4`

### `AdminReportsListView`
- Accordion UI grouped by period label `"Q1 2026"`, `"Q2 2026"`, etc.
- Sort order: newest first (year desc → Q desc)
- Each row shows percentage with color scheme

### `UsersView`
- Show current points balance on each user card/row
- Button to open a modal with PointsTransaction history (date, Q period, score %, points awarded)

---

## 6. Frontend — Employee

### `MyReportsView`
- Report cards show period label `"Q1 2026"` instead of plain date
- Percentage shown with color scheme

### `AuditView`
- Header/subheader shows `"Q1 2026"` period label
- Percentage shown with color scheme

### `Dashboard`
- Show employee's current points balance (from `/api/auth/me` or a separate request)

---

## 7. Shared Utility

**`frontend/src/utils/scoreColor.ts`**

```ts
export function getScoreColor(score: number): { colorClass: string; icon?: string } {
  const floored = Math.floor(score);
  if (floored === 100) return { colorClass: 'text-yellow-500', icon: '🏆' };
  if (floored >= 95)   return { colorClass: 'text-green-600' };
  if (floored >= 80)   return { colorClass: 'text-yellow-500' };
  return { colorClass: 'text-red-600' };
}
```

---

## 8. Out of Scope (future)

- Spending points (marketplace, rewards)
- Admin manually adjusting points
- Points reset per year
