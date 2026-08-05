# Access Matrix & Navigation Redesign

**Date:** 2026-08-06
**Status:** Approved

## Context

The app is expanding from a single mystery-shopper system to a 3-module platform:
1. **Таємний покупець** — existing feature (all 4 current employee screens)
2. **Онбординг** — for new trainees (14/30/60-day tracks, content TBD)
3. **Навчання** — courses for everyone (5 sections, content TBD)

Access to each module is controlled per division+position combination and is configurable by admins at runtime via a toggle UI.

## Access Matrix (defaults)

| Division | Position | Таємний покупець | Онбординг | Навчання |
|---|---|---|---|---|
| stores | Початківець консультант | ✗ | ✓ | ✓ |
| stores | Консультант | ✓ | ✗ | ✓ |
| stores | Керівник | ✓ | ✗ | ✓ |
| office | Співробітник | ✗ | ✗ | ✓ |
| office | Керівник | ✗ | ✗ | ✓ |
| security | Охоронець | ✗ | ✗ | ✓ |
| security | Керівник | ✗ | ✗ | ✓ |

Admins (`isAdmin: true`) always have access to all modules.

## Backend

### Model: `AccessMatrix`

Single MongoDB document (singleton pattern — always exactly one document):

```typescript
interface IAccessRule {
  division: string;
  position: string;
  modules: {
    mysteryShop: boolean;
    onboarding: boolean;
    learning: boolean;
  };
}

interface IAccessMatrix {
  rules: IAccessRule[];
}
```

Mongoose model: `AccessMatrix` in `backend/src/models/AccessMatrix.ts`.

On backend startup (`backend/src/index.ts`): seed the document with defaults if it doesn't exist yet (`findOneAndUpdate` with `upsert: true, setOnInsert`).

### API Endpoints

**`GET /api/access-matrix`** — no auth required (public)
- Returns the full matrix document `{ rules: [...] }`
- Used by frontend on app load

**`PUT /api/access-matrix`** — admin only
- Body: `{ rules: IAccessRule[] }`
- Validates all required division+position combos are present
- Replaces the document's rules array
- Returns updated `{ rules: [...] }`

Route file: `backend/src/routes/accessMatrix.ts`
Registered in `backend/src/index.ts` as `app.use('/api/access-matrix', accessMatrixRouter)`

### TypeScript compilation

Both `tsc --noEmit` passes after each task.

## Frontend

### New Screen values (`frontend/src/types.ts`)

```typescript
// Onboarding
ONBOARDING_14 = 'ONBOARDING_14',
ONBOARDING_30 = 'ONBOARDING_30',
ONBOARDING_60 = 'ONBOARDING_60',
// Learning
LEARNING_GENERAL = 'LEARNING_GENERAL',
LEARNING_START = 'LEARNING_START',
LEARNING_CONSULTANT = 'LEARNING_CONSULTANT',
LEARNING_MANAGERS = 'LEARNING_MANAGERS',
LEARNING_MARKETING = 'LEARNING_MARKETING',
// Admin
ADMIN_ACCESS_MATRIX = 'ADMIN_ACCESS_MATRIX',
```

### AccessContext (`frontend/src/context/AccessContext.tsx`)

Fetches `GET /api/access-matrix` once after auth, exposes:

```typescript
interface AccessContextType {
  canMysteryShop: boolean;
  canOnboarding: boolean;
  canLearning: boolean;
  isLoading: boolean;
  matrix: AccessRule[] | null;
  refreshMatrix: () => Promise<void>;
}
```

Computation:
- `isAdmin` → all `true`
- Others → find rule where `rule.division === user.division && rule.position === user.position`
- If no matching rule found → all `false` (safe default)

`useAccess()` hook exported from the same file.

`AccessProvider` wraps the app inside `AuthProvider` in `main.tsx` or `App.tsx`, only fetches when user is logged in.

### Navigation (`frontend/src/components/Layout.tsx`)

Replace flat `EMPLOYEE_NAV` with accordion-style module nav. Each module = collapsible section.

Module definitions:

```typescript
const MODULE_NAV = [
  {
    key: 'mysteryShop',
    label: 'Таємний покупець',
    icon: 'fa-magnifying-glass',
    items: [
      { id: Screen.DASHBOARD,     label: 'Дашборд',       icon: 'fa-house' },
      { id: Screen.MY_REPORTS,    label: 'Мої звіти',     icon: 'fa-clipboard-list' },
      { id: Screen.PROGRESS,      label: 'Мій прогрес',   icon: 'fa-trophy' },
      { id: Screen.TRAINING_PLAN, label: 'План розвитку', icon: 'fa-graduation-cap' },
    ],
  },
  {
    key: 'onboarding',
    label: 'Онбординг',
    icon: 'fa-user-clock',
    items: [
      { id: Screen.ONBOARDING_14, label: '14 днів', icon: 'fa-calendar-days' },
      { id: Screen.ONBOARDING_30, label: '30 днів', icon: 'fa-calendar-days' },
      { id: Screen.ONBOARDING_60, label: '60 днів', icon: 'fa-calendar-days' },
    ],
  },
  {
    key: 'learning',
    label: 'Навчання',
    icon: 'fa-book-open',
    items: [
      { id: Screen.LEARNING_GENERAL,    label: 'Загальний розвиток',   icon: 'fa-seedling' },
      { id: Screen.LEARNING_START,      label: 'Старт роботи',         icon: 'fa-play' },
      { id: Screen.LEARNING_CONSULTANT, label: 'Продавець-консультант', icon: 'fa-tag' },
      { id: Screen.LEARNING_MANAGERS,   label: 'Керівники',            icon: 'fa-crown' },
      { id: Screen.LEARNING_MARKETING,  label: 'Маркетинг',            icon: 'fa-bullhorn' },
    ],
  },
];
```

Sidebar accordion behavior:
- Only show modules where the user has access (`canMysteryShop`, `canOnboarding`, `canLearning`)
- Track `openModule: string | null` in state
- Active module (contains `activeScreen`) always shows open; user can collapse/expand others
- On mount: auto-open the module that contains the current `activeScreen`

Mobile bottom nav: show one icon per accessible module (max 3). Tap → navigates to first screen of that module.

Admin nav: unchanged (flat list, no accordion).

### Placeholder Screens

Create `frontend/src/components/onboarding/OnboardingView.tsx` — single component that accepts a `track: '14' | '30' | '60'` prop, renders a placeholder with title and "Розділ в розробці" message.

Create `frontend/src/components/learning/LearningView.tsx` — single component that accepts a `section: string` prop, renders a placeholder with section title.

Wire up all new Screens in `App.tsx`.

### Admin: Access Matrix UI

New screen `ADMIN_ACCESS_MATRIX` wired in `App.tsx`, nav item added to `ADMIN_NAV` in `Layout.tsx` (icon: `fa-sliders`, label: "Доступи").

Component: `frontend/src/components/admin/AccessMatrixView.tsx`

UI: table with rows = all division+position combos (7 rows from the matrix), columns = 3 module toggles. Each toggle calls `PUT /api/access-matrix` with the full updated rules array immediately on change (optimistic update, revert on error).

Fetches matrix via `refreshMatrix()` from `AccessContext` on mount.

## Data Flow

```
App loads → user logs in
→ AccessProvider fetches GET /api/access-matrix
→ useAccess() computes canMysteryShop/canOnboarding/canLearning
→ Layout renders only accessible module dropdowns

Admin toggles a permission
→ PUT /api/access-matrix
→ AccessContext.refreshMatrix() re-fetches
→ UI updates immediately
```

## Out of Scope

- Actual content for onboarding tracks and learning sections
- Per-user override of access (only per division+position)
- Access matrix versioning/history
