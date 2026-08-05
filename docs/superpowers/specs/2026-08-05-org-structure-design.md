# Org Structure Design

**Date:** 2026-08-05  
**Status:** Approved

## Context

The platform is being redesigned to support an organizational hierarchy. Every registered user belongs to a division, group, and has a position. Admin is now an additional permission flag, not a separate account type.

## Requirements

- Every user must belong to a 3-level hierarchy: Division → Group → Position
- Admin access is a boolean flag (`isAdmin`) independent of organizational placement
- The org structure is static — managed in code, not via an admin UI
- Visibility rules do not change: each user sees only their own data, admins see everyone

## Org Structure

```
Магазини (stores)
  ├── Магазин 1..11  (store_1..store_11)
  │   Positions: Керівник, Консультант, Початківець консультант

Офіс (office)
  ├── Маркетинг       (marketing)
  ├── Бухгалтерія     (accounting)
  ├── Постачання      (supply)
  ├── HR              (hr)
  ├── IT              (it)
  └── Керівник        (management)
      Positions: Співробітник, Керівник

Охорона (security)
  ├── Охоронці        (staff)
  └── Керівник        (management)
      Positions: Охоронець, Керівник
```

## Architecture

### 1. Constants File

Single source of truth for the entire org structure:

**`backend/src/config/org-structure.ts`** (copied to `frontend/src/config/org-structure.ts`)

```ts
export const ORG_STRUCTURE = {
  stores: {
    label: 'Магазини',
    groups: {
      store_1: 'Магазин 1',
      // ... store_2..store_11
    },
    positions: ['Керівник', 'Консультант', 'Початківець консультант'],
  },
  office: {
    label: 'Офіс',
    groups: {
      marketing: 'Маркетинг',
      accounting: 'Бухгалтерія',
      supply: 'Постачання',
      hr: 'HR',
      it: 'IT',
      management: 'Керівник',
    },
    positions: ['Співробітник', 'Керівник'],
  },
  security: {
    label: 'Охорона',
    groups: {
      staff: 'Охоронці',
      management: 'Керівник',
    },
    positions: ['Охоронець', 'Керівник'],
  },
} as const;

export type Division = keyof typeof ORG_STRUCTURE;
export type Group<D extends Division> = keyof typeof ORG_STRUCTURE[D]['groups'];
```

Adding a new store = one line in this file.

### 2. User Model Changes

**Removed fields:**
- `role: 'ADMIN' | 'EMPLOYEE'`
- `store: string`

**Added fields:**
```ts
isAdmin:  { type: Boolean, default: false }
division: { type: String, required: true }   // 'stores' | 'office' | 'security'
group:    { type: String, required: true }   // 'store_1' | 'marketing' | ...
position: { type: String, required: true }   // 'Керівник' | 'Консультант' | ...
```

The existing `position` field is reused — its valid values are now validated against the division.

**Example users:**
```ts
// Store consultant
{ name: 'Олена Коваль', isAdmin: false, division: 'stores', group: 'store_3', position: 'Консультант' }

// IT admin
{ name: 'Іван Петров', isAdmin: true, division: 'office', group: 'it', position: 'Співробітник' }
```

### 3. Auth & Middleware

**JWT payload** updated to include org fields:
```ts
// Before
{ userId, role }

// After
{ userId, isAdmin, division, group, position }
```

**`requireAdmin` middleware:** changes `role === 'ADMIN'` check to `isAdmin === true`.

**Login response** returns the full org fields so the frontend doesn't need extra requests.

### 4. Migration Script

One-time script `backend/src/migrate-org.ts`:
- `role === 'ADMIN'` → `isAdmin: true`, otherwise `isAdmin: false`
- Attempts to map existing `store` string → `group` key automatically
- Users that can't be mapped automatically get `group: ''` for manual assignment by admin
- Removes old `role` and `store` fields after migration

### 5. Frontend Changes

**Types:** `User` type updated — `role` replaced by `isAdmin`, `store` replaced by `division + group`.

**Admin checks:** all `user.role === 'ADMIN'` replaced with `user.isAdmin`.

**User profile display:** shows structured org info instead of raw `store` string:
```
Підрозділ: Магазини
Магазин:   Магазин 3
Посада:    Консультант
```

**User create/edit form (admin panel):** cascading dropdowns driven by `org-structure.ts`:
1. Select division → 2. Select group → 3. Select position  
Changing division resets group and position.

## Data Flow

```
org-structure.ts (constants)
       ↓
User model  →  division + group + position + isAdmin
       ↓
Middleware  →  checks isAdmin for protected routes
       ↓
Frontend   →  cascading dropdowns + updated types + structured display
```

## Out of Scope

- Admin UI for managing org structure (structure changes are code-only)
- Visibility changes (each user still sees only their own data)
- Group-level permissions (e.g., store manager seeing their team's reports)
