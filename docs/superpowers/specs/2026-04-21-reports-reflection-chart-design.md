# Design: Q-Label, Dashboard Chart, Reflection System

**Date:** 2026-04-21
**Project:** mysteryshopperKameya

---

## 1. Q-Period Label in MyReportsView

**What:** In the report detail view (when employee clicks a report card), add a prominent Q-period badge at the top above the score circle.

**How:** Inside the detail view JSX, before the score card div, add a styled badge:
```tsx
{selected.quarter && selected.year && (
  <div className="inline-flex items-center gap-2 px-3 py-1 bg-kameya-burgundy/10 text-kameya-burgundy rounded-full text-sm font-semibold">
    <i className="fas fa-calendar-check text-xs"></i>
    {selected.quarter} {selected.year}
  </div>
)}
```

**Scope:** One change in `frontend/src/components/employee/MyReportsView.tsx`.

---

## 2. Dashboard Score Chart (Recharts)

### Library
Install `recharts` (`npm install recharts`).

### Data
Derived from `getMyReports()` already called in Dashboard. Filter by current year, group by quarter (Q1–Q4), take the latest report per quarter. Result: array of `{ quarter, totalScore, date, pointsAwarded }` sorted Q1→Q4.

### Component
New file: `frontend/src/components/employee/ScoreChart.tsx`

**Props:** `reports: AuditResult[]`

**Chart type:** `AreaChart` from recharts — line with filled area below.

**Styling:**
- Area fill: `#7B1C3A` at 15% opacity
- Line stroke: `#7B1C3A`, strokeWidth 2
- Dots: filled `#7B1C3A`, radius 5
- X axis: Q1, Q2, Q3, Q4
- Y axis: 0–100, no decimals
- Grid: light slate dashed lines
- Custom `Tooltip`: shows date + `pointsAwarded` (from PointsTransaction or calculated inline)

**Tooltip content:**
```
Q1 2026
18.02.2026
Результат: 94%
Нараховано: 100 балів
```

**Edge cases:**
- 0 reports for year → render nothing (component returns null)
- 1 report → show single dot, no line (recharts handles this)

### Dashboard layout change
Replace the current Points Balance Card right side with a 2-column layout:
- Left: Points Balance (existing)
- Right: ScoreChart (new)

Or put chart below the two top cards as a full-width card titled "Динаміка оцінок {currentYear}".

**Decision: full-width card below** — cleaner, chart needs horizontal space.

### Files
- Create: `frontend/src/components/employee/ScoreChart.tsx`
- Modify: `frontend/src/components/Dashboard.tsx` (add chart card below grid)

---

## 3. Reflection System

### 3.1 Backend — Data Model

Add `reflection` subdocument to `Report` model:

```typescript
interface IReflection {
  answer1: string;  // "Що я зроблю інакше наступного разу?"
  answer2: string;  // "Який пункт був для мене несподіванкою?"
  submittedAt: Date;
  isOnTime: boolean; // true if submittedAt - report.createdAt <= 72h
  bonusPointsAwarded: boolean; // true if +20 awarded
}
```

Field on Report: `reflection?: IReflection` (optional, absent until submitted).

### 3.2 Backend — Endpoint

**`POST /api/reports/:id/reflection`** — employee only (own reports only)

Logic:
1. Find report by id, verify `userId === req.user.userId`
2. If `report.reflection` already exists → 409 Conflict
3. Calculate `isOnTime`: `Date.now() - report.createdAt.getTime() <= 72 * 3600 * 1000`
4. Save `reflection: { answer1, answer2, submittedAt: new Date(), isOnTime, bonusPointsAwarded: isOnTime }`
5. If `isOnTime` → directly: `User.findByIdAndUpdate(userId, { $inc: { points: 20 } })` + `PointsTransaction.create({ userId, reportId, quarter, year, scorePercent: 0, pointsAwarded: 20 })`
6. Return updated report

**Note:** `GET /api/reports/my` already returns all employee reports — just ensure `reflection` field is included in the response (it will be since Mongoose returns the full document).

### 3.3 Frontend — Employee: MyReportsView Changes

**Remove the two-step detail view** (short view + "Детальний звіт" button). Replace with a single full detail view.

**Section highlighting:** A section is "failed" if `section.score < section.maxScore`. Failed sections get:
- `border-red-300 bg-red-50` instead of default border
- Red dot or warning icon next to section title

**Reflection status:**
- Not submitted + within 72h → show "Ознайомився" button
- Not submitted + over 72h → show "Термін рефлексії минув" (grey, disabled)
- Submitted → show "✓ Рефлексію подано" badge (green) + submitted date

**Reflection modal** (shown on "Ознайомився" click):
- Title: "Рефлексія"
- Field 1: textarea "Що я зроблю інакше наступного разу?" (required, min 10 chars)
- Field 2: textarea "Який пункт був для мене несподіванкою?" (required, min 10 chars)
- Submit button: "Надіслати"
- On success: modal closes, button replaced with green badge

**Timing info for employee:** small text under the button showing how much time is left, e.g. "Залишилось 48 год для подання рефлексії"

### 3.4 Frontend — Admin: AdminReportsListView Changes

In the detail view of a report, add a "Рефлексія" section:

**States:**
- `reflection === undefined && hours < 72` → `⏱ Очікується` (grey) — time remaining shown
- `reflection?.isOnTime === true` → `✅ Отримана вчасно` (green) + "Переглянути" button
- `reflection?.isOnTime === false` → `❌ Отримана не вчасно` (orange) + "Переглянути" button
- `reflection === undefined && hours >= 72` → `❌ Не подана` (red)

**"Переглянути відповіді" modal:**
- Shows `reflection.submittedAt` (formatted date)
- Shows answer1 and answer2 with labels
- Shows `+20 балів` or `0 балів` bonus

### 3.5 Points Integration

`PointsTransaction` for reflection bonus:
```
scorePercent: 0
pointsAwarded: 20
quarter: report.quarter
year: report.year
```
The `scorePercent: 0` distinguishes reflection bonuses from audit scores in history view. Display in history as "Рефлексія Q1 2026 +20".

---

## File Map

**Backend:**
- `backend/src/models/Report.ts` — add `IReflection` + `reflection` field
- `backend/src/routes/reports.ts` — add `POST /:id/reflection`; update `GET /my` to include reflection

**Frontend:**
- `frontend/package.json` — add `recharts`
- `frontend/src/components/employee/ScoreChart.tsx` — new chart component
- `frontend/src/components/employee/MyReportsView.tsx` — Q badge, single detail view, reflection button/modal
- `frontend/src/components/admin/AdminReportsListView.tsx` — reflection status + modal in detail view
- `frontend/src/services/reportsService.ts` — add `submitReflection(reportId, answer1, answer2)`
- `frontend/src/types.ts` — add `Reflection` interface, add to `AuditResult`
- `frontend/src/components/Dashboard.tsx` — add ScoreChart card

---

## Out of Scope

- Editing a submitted reflection
- Admin submitting reflection on behalf of employee
- Push notifications for reflection deadline
