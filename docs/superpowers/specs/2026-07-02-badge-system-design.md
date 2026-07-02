# Badge System Design
Date: 2026-07-02

## Overview

A badge (achievement) system for the "Мій прогрес" page. Badges are awarded automatically based on employee report history and learning plan completion. Admins can view, manually assign, and delete badges per employee. Badges never disappear automatically once earned — only admins can delete them.

---

## Data Model

### User schema extension

Add an embedded `badges` array to the existing `User` document:

```typescript
interface IBadgeAward {
  _id: ObjectId;    // auto-generated; used to target deletion
  badgeId: BadgeId;
  earnedAt: Date;
  year?: number;    // required for yearly badges (Серія, Студент року)
  manual?: boolean; // true if assigned manually by admin
}
```

Add to `UserSchema`:
```typescript
badges: { type: [BadgeAwardSchema], default: [] }
```

### Badge catalogue (static, defined in code)

| badgeId | Category | Name | Repeatable | Reset |
|---|---|---|---|---|
| `first_report` | Старт | Перша перевірка | no | never |
| `first_perfect` | Старт | Без розгону | no | never |
| `honor_student` | Навчання | Відмінник | no | never |
| `student_of_year` | Навчання | Студент року | yes | new award each calendar year |
| `clean_form` | Якість | Чиста анкета | no | never (condition TBD) |
| `silver_guide` | Серія | Срібний гід | yes | counter resets Jan 1 each year |
| `gold_series` | Серія | Золота серія | yes | counter resets Jan 1 each year |
| `platinum_standard` | Серія | Платиновий стандарт | yes | counter resets Jan 1 each year |
| `comeback` | Камбек | Зробила висновки | yes | one award per qualifying situation |

---

## Badge Earn Conditions

### Старт

**Перша перевірка (`first_report`)**
User has at least one Report in the system. Awarded at confirm of the first report.

**Без розгону (`first_perfect`)**
The user's very first report (chronologically) has `totalScore === 100`. Awarded at confirm of the first report if condition met.

### Навчання

**Відмінник (`honor_student`)**
A learning plan exists on a report (`learningPlan` present) and all tasks were completed (`isCompleted = true`) before `learningPlan.deadline`. One-time badge — once earned, never re-awarded automatically.

Evaluated: when the last remaining task in a learning plan is toggled complete (`PATCH /:id/learning-plan/:taskIndex`).

**Студент року (`student_of_year`)**
Every report in a calendar year that has a `learningPlan` has all tasks completed on time (all `completedAt ≤ learningPlan.deadline`). Reports with no learning plan (e.g. 100% score) are excluded from the check.

Evaluated: yearly, on December 31 (cron or manual trigger). Stored with `year` field. Can be earned once per calendar year.

### Якість

**Чиста анкета (`clean_form`)**
Condition TBD (user will clarify "без жодної редакції таємного"). Implementation deferred until condition is specified.

### Серія

Consecutive reports are defined by **quarter order within the same year** (Q1 → Q2 → Q3 → Q4). A gap (missing quarter) or a non-100% result breaks the streak. The counter resets to 0 on January 1 each year.

For each year, take the user's reports sorted by quarter. Walk Q1→Q4:
- If a quarter has a report with `totalScore === 100`, increment streak counter.
- If a quarter has a report with `totalScore < 100`, reset counter to 0.
- If a quarter has no report, reset counter to 0.

Award the badge when the counter reaches the threshold, if not already awarded for that year:

| badgeId | Threshold |
|---|---|
| `silver_guide` | 2 consecutive 100% |
| `gold_series` | 3 consecutive 100% |
| `platinum_standard` | 4 consecutive 100% |

All three are stored with `year` field. A user can earn each once per year.

Evaluated: after every `POST /api/reports/confirm`.

### Камбек

**Зробила висновки (`comeback`)**
Condition: the user's previous report had `totalScore < 85` AND that report's `learningPlan` has all tasks with `isCompleted = true` (regardless of deadline), AND the current (new) report has `totalScore === 100`.

"Previous report" = the most recent report by `createdAt` before the current one.

Repeatable: awarded once per qualifying situation. Number of `comeback` entries in `badges` reflects how many times the condition was met.

Evaluated: after every `POST /api/reports/confirm`.

---

## Idempotency Rules

| Type | Guard |
|---|---|
| One-time badge | Skip if `badges` already contains any entry with this `badgeId` |
| Yearly badge (Серія, Студент року) | Skip if `badges` already contains entry with this `badgeId` + this `year` |
| Comeback | Award if count of `comeback` entries in `badges` < number of qualifying situations found in report history |

---

## Backend

### New service: `badgeService.ts`

```
evaluateOnReportConfirm(userId, reportId) → void
  - awards: first_report, first_perfect, silver_guide, gold_series, platinum_standard, comeback

evaluateOnLearningPlanComplete(userId, reportId) → void
  - awards: honor_student

evaluateStudentOfYear(userId, year) → void
  - awards: student_of_year
```

Each function reads the user's `badges` array + relevant reports, applies idempotency guards, and pushes new `IBadgeAward` entries to `user.badges` using `$push`.

### Integration hooks

- `POST /api/reports/confirm` → call `evaluateOnReportConfirm` after saving report (non-blocking, like birthday check)
- `PATCH /api/reports/:id/learning-plan/:taskIndex` → after save, if all tasks now complete, call `evaluateOnLearningPlanComplete`
- December 31 cron (or manual admin trigger) → call `evaluateStudentOfYear` for all employees

### New API endpoints

```
GET    /api/reports/my/badges
  → returns current user's badges array (employee)

GET    /api/users/:id/badges
  → returns target user's badges array (admin only)

POST   /api/users/:id/badges
  body: { badgeId: BadgeId, earnedAt?: string, year?: number }
  → manually add a badge award (admin only)

DELETE /api/users/:id/badges/:awardId
  → remove a specific badge award by _id (admin only)
```

---

## Frontend

### ProgressView (employee — "Мій прогрес")

The badge section below the top cards is reorganised into **5 category groups**. Each group has a heading and a horizontal/grid row of badge tiles.

**Badge tile states:**
- **Earned:** coloured icon, name in dark text
- **Not earned:** greyed-out icon, name in muted text
- **Repeatable earned multiple times:** small counter chip in top-right corner of tile (`×2`, `×3`, …)

**Tooltip behaviour:**
- Desktop hover (`onMouseEnter`/`onMouseLeave`): earned → list of `earnedAt` dates; not earned → condition description string
- Mobile long press (`onTouchStart` sets 500ms timer, `onTouchEnd` cancels): same content in a small popup

Data fetched from `GET /api/reports/my/badges` on mount alongside existing rank/points calls.

### UsersView (admin)

Each row in the users table gains a **"Нагороди"** button.

Clicking opens a modal:
- Header: user name + "Нагороди"
- Body: 5 category sections, each showing all badges in that category
- **Earned badge:** coloured, shows `earnedAt` date (and year if applicable), `×` button to delete that specific award
- **Unearned badge:** grey, "Призначити" button → inline mini-form: date picker (default today) + optional year field (for yearly badges) + "Підтвердити"
- Deletion and assignment call the admin badge endpoints and refresh the modal

---

## Out of Scope

- `clean_form` (Чиста анкета) implementation — condition not yet defined
- `evaluateStudentOfYear` cron scheduling — wired up manually for now, cron added later
- Badge notifications / push alerts to employee on earn
