# Admin Notifications System — Design Spec
Date: 2026-07-09

## Overview

Add a "Сповіщення" (Notifications) menu item to the admin panel that tracks key employee actions (reflection submissions, learning plan generation and completion) with links to the relevant reports. A separate "Системні сповіщення" (System Notifications) button in the top-right corner tracks login events.

---

## Database: New Collections

### `Notification` collection

Stores events triggered by employee actions on reports.

```ts
{
  type: 'reflection_submitted' | 'plan_generated' | 'plan_completed',
  userId: ObjectId,         // employee who performed the action
  reportId: ObjectId,       // report the event is linked to
  userName: string,         // cached display name (avoids join on every fetch)
  reportFileName: string,   // display label for the report link
  isOnTime: boolean | null, // true/false for reflection_submitted and plan_completed; null for plan_generated
  isRead: boolean,          // default: false
  createdAt: Date
}
```

**Indexes:** `isRead` (for unread count), `createdAt desc` (for sorted listing).

### `SystemLog` collection

Stores authentication events.

```ts
{
  type: 'login_success' | 'login_failed',
  phone: string,            // phone used in login attempt
  userName: string | null,  // resolved name if user found; null if user not found
  ip: string | null,        // request IP address
  isRead: boolean,          // default: false
  createdAt: Date
}
```

**Indexes:** `isRead`, `createdAt desc`.

---

## Backend

### Where Notifications Are Created

**`routes/reports.ts`** — hook into existing endpoints:

| Trigger | Action |
|---|---|
| `POST /api/reports/:id/reflection` succeeds | `Notification.create({ type: 'reflection_submitted', isOnTime: reflection.isOnTime })` |
| `POST /api/reports/:id/learning-plan` succeeds | `Notification.create({ type: 'plan_generated', isOnTime: null })` |
| `PATCH /api/reports/:id/learning-plan/task` — last task becomes `isCompleted: true` | `Notification.create({ type: 'plan_completed', isOnTime: now <= plan.deadline })` |

**`routes/auth.ts`** — hook into `/login`:

| Trigger | Action |
|---|---|
| User found + password correct | `SystemLog.create({ type: 'login_success', userName: user.name })` |
| User not found | `SystemLog.create({ type: 'login_failed', userName: null })` |
| User found + wrong password | `SystemLog.create({ type: 'login_failed', userName: user.name })` |

### New Route File: `routes/notifications.ts`

All endpoints require ADMIN role (checked via `authMiddleware` + role guard).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications` | List main notifications, newest first, limit 100 |
| `GET` | `/api/notifications/unread-count` | Returns `{ count: number }` |
| `PATCH` | `/api/notifications/:id/read` | Mark one notification as read |
| `GET` | `/api/notifications/system` | List system logs, newest first, limit 200 |
| `GET` | `/api/notifications/system/unread-count` | Returns `{ count: number }` |
| `PATCH` | `/api/notifications/system/:id/read` | Mark one system log as read |

---

## Frontend

### New Screen

Add `ADMIN_NOTIFICATIONS = 'ADMIN_NOTIFICATIONS'` to the `Screen` enum in `types.ts`.

### Layout changes (`Layout.tsx`)

- Add `{ id: Screen.ADMIN_NOTIFICATIONS, label: 'Сповіщення', icon: 'fa-bell' }` to `ADMIN_NAV`.
- The nav button for Notifications renders a red badge circle with unread count when `unreadCount > 0`. Badge shows max "99+" if count exceeds 99.
- Mobile bottom nav: same badge on the bell icon.
- Desktop sidebar header area (or mobile header): add a "Системні сповіщення" button (icon `fa-shield-halved`) with its own badge. Clicking opens a slide-over panel or modal.
- The Layout fetches both `unreadCount` and `systemUnreadCount` on mount and polls every 60 seconds.

### `AdminNotificationsView` component

Located at `frontend/src/components/admin/AdminNotificationsView.tsx`.

**Main notifications list** — each card shows:
- Icon + color by type:
  - `reflection_submitted` → blue bell icon
  - `plan_generated` → yellow graduation cap
  - `plan_completed` → green check circle
- Text: `"[userName] подав(ла) рефлексію до звіту [reportFileName]"` / `"... створив(ла) план навчання ..."` / `"... завершив(ла) план навчання ..."`
- On-time badge: `"Вчасно"` (green) or `"Запізно"` (orange) — shown for `reflection_submitted` and `plan_completed`; hidden for `plan_generated`
- Timestamp: relative (`"2 год тому"`) + absolute on hover
- Button `"Переглянути"` → calls `PATCH /notifications/:id/read`, then navigates admin to the employee's report (opens `AdminReportsListView` filtered to that report, or a direct report detail view if it exists)
- Unread cards have a subtle left border highlight; read cards are normal

**Empty state:** "Немає сповіщень" with bell icon.

**Loading state:** skeleton cards.

### `SystemNotificationsPanel` component

Located at `frontend/src/components/admin/SystemNotificationsPanel.tsx`.

Rendered as a slide-over panel from the right side (overlay with backdrop).

Each log entry shows:
- Icon: green checkmark (`login_success`) or red X (`login_failed`)
- Text: `"[userName ?? phone] — успішний вхід"` / `"[userName ?? phone] — невірний пароль"`
- Phone number (greyed out)
- Timestamp
- Clicking an entry marks it as read via `PATCH /notifications/system/:id/read`

Panel closes on backdrop click or ESC key.

---

## Navigation: Linking to a Report

When admin clicks "Переглянути" on a notification, the app must navigate to the specific report. Since `AdminReportsListView` already lists all reports, the simplest approach is to:

1. Pass `initialReportId` prop to `AdminReportsListView` (or navigate to `Screen.ADMIN_REPORTS_LIST` with a selected report ID stored in App state).
2. `AdminReportsListView` scrolls to and highlights that report, auto-expanding its detail view.

This avoids creating a new "report detail" screen.

---

## Migration for Existing Data

Existing reflection/plan data in the DB will NOT automatically appear as notifications (Approach B requires events to be fired at action time). The notification list will be empty until new actions occur after deployment. This is acceptable — the feature is forward-looking.

---

## Out of Scope

- Email or push notifications
- Notification preferences (mute types)
- Bulk mark-all-as-read (can be added later)
- Pagination beyond the 100/200 item limit
