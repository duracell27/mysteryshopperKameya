# Access Matrix & Navigation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 4-item employee nav with a 3-module accordion (Таємний покупець / Онбординг / Навчання), control which modules each division+position can access via a DB-backed matrix that admins can toggle at runtime.

**Architecture:** MongoDB `AccessMatrix` singleton document holds all rules. `GET /api/access-matrix` (public) lets the frontend fetch once on login. `AccessProvider` wraps `AppContent`, exposes `useAccess()` hook. `Layout` reads the hook to render only visible modules. Placeholder screens for all new routes.

**Tech Stack:** Express, Mongoose, React, TypeScript, Tailwind CSS

## Global Constraints

- No new npm packages
- No `any`, no ts-ignore
- All UI strings in Ukrainian
- `tsc --noEmit` — 0 errors after every task (backend: `cd backend && ./node_modules/.bin/tsc --noEmit`; frontend: `cd frontend && ./node_modules/.bin/tsc --noEmit`)
- Module keys throughout: `mysteryShop`, `onboarding`, `learning` (camelCase, consistent)

---

### Task 1: Backend — AccessMatrix model + seed

**Files:**
- Create: `backend/src/models/AccessMatrix.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Produces: `IAccessRule`, `IAccessMatrix`, `DEFAULT_RULES`, `AccessMatrix` mongoose model — consumed by Task 2

- [ ] **Step 1: Create `backend/src/models/AccessMatrix.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessRule {
  division: string;
  position: string;
  modules: {
    mysteryShop: boolean;
    onboarding:  boolean;
    learning:    boolean;
  };
}

export interface IAccessMatrix extends Document {
  rules: IAccessRule[];
}

const AccessRuleSchema = new Schema<IAccessRule>({
  division: { type: String, required: true },
  position: { type: String, required: true },
  modules: {
    mysteryShop: { type: Boolean, default: false },
    onboarding:  { type: Boolean, default: false },
    learning:    { type: Boolean, default: true  },
  },
}, { _id: false });

const AccessMatrixSchema = new Schema<IAccessMatrix>({
  rules: [AccessRuleSchema],
});

export const AccessMatrix = mongoose.model<IAccessMatrix>('AccessMatrix', AccessMatrixSchema);

export const DEFAULT_RULES: IAccessRule[] = [
  { division: 'stores',   position: 'Початківець консультант', modules: { mysteryShop: false, onboarding: true,  learning: true } },
  { division: 'stores',   position: 'Консультант',             modules: { mysteryShop: true,  onboarding: false, learning: true } },
  { division: 'stores',   position: 'Керівник',                modules: { mysteryShop: true,  onboarding: false, learning: true } },
  { division: 'office',   position: 'Співробітник',            modules: { mysteryShop: false, onboarding: false, learning: true } },
  { division: 'office',   position: 'Керівник',                modules: { mysteryShop: false, onboarding: false, learning: true } },
  { division: 'security', position: 'Охоронець',               modules: { mysteryShop: false, onboarding: false, learning: true } },
  { division: 'security', position: 'Керівник',                modules: { mysteryShop: false, onboarding: false, learning: true } },
];
```

- [ ] **Step 2: Seed in `backend/src/index.ts`**

Add import at top:
```typescript
import { AccessMatrix, DEFAULT_RULES } from './models/AccessMatrix';
```

Replace the `connectDB().then(...)` block with:
```typescript
connectDB().then(async () => {
  const existing = await AccessMatrix.findOne();
  if (!existing) {
    await AccessMatrix.create({ rules: DEFAULT_RULES });
    console.log('✅ AccessMatrix seeded with defaults');
  }
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
  });
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/AccessMatrix.ts backend/src/index.ts
git commit -m "feat: add AccessMatrix model with default rules, seed on startup"
```

---

### Task 2: Backend — access-matrix API routes

**Files:**
- Create: `backend/src/routes/accessMatrix.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `AccessMatrix`, `DEFAULT_RULES`, `IAccessRule` from Task 1; `authMiddleware`, `AuthRequest` from existing middleware
- Produces: `GET /api/access-matrix` → `{ rules: IAccessRule[] }`; `PUT /api/access-matrix` → `{ rules: IAccessRule[] }` — consumed by Tasks 3, 6

- [ ] **Step 1: Create `backend/src/routes/accessMatrix.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { AccessMatrix, DEFAULT_RULES } from '../models/AccessMatrix';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/access-matrix — public
router.get('/', async (_req: Request, res: Response) => {
  try {
    const matrix = await AccessMatrix.findOne().lean();
    return res.json({ rules: matrix?.rules ?? DEFAULT_RULES });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PUT /api/access-matrix — admin only
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  const { rules } = req.body as { rules: unknown };
  if (!Array.isArray(rules) || rules.length === 0) {
    return res.status(400).json({ message: 'rules має бути непорожнім масивом' });
  }
  try {
    const matrix = await AccessMatrix.findOneAndUpdate(
      {},
      { rules },
      { new: true, upsert: true }
    ).lean();
    return res.json({ rules: matrix!.rules });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
```

- [ ] **Step 2: Register route in `backend/src/index.ts`**

Add import:
```typescript
import accessMatrixRoutes from './routes/accessMatrix';
```

Add before `app.get('/api/health', ...)`:
```typescript
app.use('/api/access-matrix', accessMatrixRoutes);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Manual smoke test**

Start backend (`npm run dev`), then:
```bash
# Public GET — no token needed
curl http://localhost:3001/api/access-matrix
# Expected: { rules: [...7 rules...] }
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/accessMatrix.ts backend/src/index.ts
git commit -m "feat: add GET/PUT /api/access-matrix endpoints"
```

---

### Task 3: Frontend — Screen enum + AccessContext + AccessProvider

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/context/AccessContext.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/access-matrix` from Task 2; `useAuth()` from existing `AuthContext`
- Produces: `useAccess()` → `{ canMysteryShop, canOnboarding, canLearning, matrix, refreshMatrix }` — consumed by Tasks 4, 5, 6

- [ ] **Step 1: Add new Screen values to `frontend/src/types.ts`**

In the `Screen` enum, add after `ADMIN_COMPANY_STRUCTURE`:
```typescript
// Onboarding
ONBOARDING_14 = 'ONBOARDING_14',
ONBOARDING_30 = 'ONBOARDING_30',
ONBOARDING_60 = 'ONBOARDING_60',
// Learning
LEARNING_GENERAL    = 'LEARNING_GENERAL',
LEARNING_START      = 'LEARNING_START',
LEARNING_CONSULTANT = 'LEARNING_CONSULTANT',
LEARNING_MANAGERS   = 'LEARNING_MANAGERS',
LEARNING_MARKETING  = 'LEARNING_MARKETING',
// Admin
ADMIN_ACCESS_MATRIX = 'ADMIN_ACCESS_MATRIX',
```

- [ ] **Step 2: Create `frontend/src/context/AccessContext.tsx`**

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/apiFetch';

export interface AccessRule {
  division: string;
  position: string;
  modules: {
    mysteryShop: boolean;
    onboarding:  boolean;
    learning:    boolean;
  };
}

interface AccessContextType {
  canMysteryShop: boolean;
  canOnboarding:  boolean;
  canLearning:    boolean;
  isLoading:      boolean;
  matrix:         AccessRule[] | null;
  refreshMatrix:  () => Promise<void>;
}

const AccessContext = createContext<AccessContextType | null>(null);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [matrix, setMatrix]       = useState<AccessRule[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await apiFetch('/api/access-matrix');
      const data = await res.json() as { rules: AccessRule[] };
      setMatrix(data.rules);
    } catch {
      setMatrix([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchMatrix();
    else setMatrix(null);
  }, [user, fetchMatrix]);

  const rule = matrix?.find(
    r => r.division === user?.division && r.position === user?.position
  );

  const canMysteryShop = user?.isAdmin ? true : (rule?.modules.mysteryShop ?? false);
  const canOnboarding  = user?.isAdmin ? true : (rule?.modules.onboarding  ?? false);
  const canLearning    = user?.isAdmin ? true : (rule?.modules.learning    ?? false);

  return (
    <AccessContext.Provider value={{ canMysteryShop, canOnboarding, canLearning, isLoading, matrix, refreshMatrix: fetchMatrix }}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
};
```

- [ ] **Step 3: Wrap `AppContent` with `AccessProvider` in `frontend/src/App.tsx`**

Add import:
```typescript
import { AccessProvider } from './context/AccessContext';
```

Find the bottom of App.tsx:
```typescript
const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);
```

Replace with:
```typescript
const App: React.FC = () => (
  <AuthProvider>
    <AccessProvider>
      <AppContent />
    </AccessProvider>
  </AuthProvider>
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors (Layout.tsx will have warnings about missing useAccess import — that is acceptable at this stage since Task 4 updates it)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/context/AccessContext.tsx frontend/src/App.tsx
git commit -m "feat: add Screen enum values, AccessContext with useAccess hook"
```

---

### Task 4: Frontend — Navigation redesign (Layout.tsx accordion)

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `useAccess()` from Task 3; all new `Screen.*` values from Task 3
- Produces: accordion sidebar nav, module-icon mobile bottom nav — visible only for accessible modules

- [ ] **Step 1: Add imports and MODULE_NAV definition to `Layout.tsx`**

Add to existing imports:
```typescript
import { useAccess } from '../context/AccessContext';
```

Replace the `EMPLOYEE_NAV` constant with `MODULE_NAV`:
```typescript
const MODULE_NAV = [
  {
    key: 'mysteryShop' as const,
    label: 'Таємний покупець',
    icon: 'fa-magnifying-glass',
    screens: [Screen.DASHBOARD, Screen.MY_REPORTS, Screen.PROGRESS, Screen.TRAINING_PLAN, Screen.AUDIT_DETAILS, Screen.QUIZ],
    items: [
      { id: Screen.DASHBOARD,     label: 'Дашборд',       icon: 'fa-house' },
      { id: Screen.MY_REPORTS,    label: 'Мої звіти',     icon: 'fa-clipboard-list' },
      { id: Screen.PROGRESS,      label: 'Мій прогрес',   icon: 'fa-trophy' },
      { id: Screen.TRAINING_PLAN, label: 'План розвитку', icon: 'fa-graduation-cap' },
    ],
  },
  {
    key: 'onboarding' as const,
    label: 'Онбординг',
    icon: 'fa-user-clock',
    screens: [Screen.ONBOARDING_14, Screen.ONBOARDING_30, Screen.ONBOARDING_60],
    items: [
      { id: Screen.ONBOARDING_14, label: '14 днів', icon: 'fa-calendar-days' },
      { id: Screen.ONBOARDING_30, label: '30 днів', icon: 'fa-calendar-days' },
      { id: Screen.ONBOARDING_60, label: '60 днів', icon: 'fa-calendar-days' },
    ],
  },
  {
    key: 'learning' as const,
    label: 'Навчання',
    icon: 'fa-book-open',
    screens: [Screen.LEARNING_GENERAL, Screen.LEARNING_START, Screen.LEARNING_CONSULTANT, Screen.LEARNING_MANAGERS, Screen.LEARNING_MARKETING],
    items: [
      { id: Screen.LEARNING_GENERAL,    label: 'Загальний розвиток',    icon: 'fa-seedling' },
      { id: Screen.LEARNING_START,      label: 'Старт роботи',          icon: 'fa-play' },
      { id: Screen.LEARNING_CONSULTANT, label: 'Продавець-консультант', icon: 'fa-tag' },
      { id: Screen.LEARNING_MANAGERS,   label: 'Керівники',             icon: 'fa-crown' },
      { id: Screen.LEARNING_MARKETING,  label: 'Маркетинг',             icon: 'fa-bullhorn' },
    ],
  },
] as const;

type ModuleKey = typeof MODULE_NAV[number]['key'];
```

- [ ] **Step 2: Add accordion state and access filtering inside `Layout` component**

Inside the `Layout` function body, after the existing state declarations, add:

```typescript
const { canMysteryShop, canOnboarding, canLearning } = useAccess();

const accessMap: Record<ModuleKey, boolean> = {
  mysteryShop: canMysteryShop,
  onboarding:  canOnboarding,
  learning:    canLearning,
};

const visibleModules = MODULE_NAV.filter(m => accessMap[m.key]);

const [openModule, setOpenModule] = useState<ModuleKey | null>(null);

useEffect(() => {
  const active = MODULE_NAV.find(m => (m.screens as readonly Screen[]).includes(activeScreen));
  if (active && accessMap[active.key]) setOpenModule(active.key);
}, [activeScreen]);
```

- [ ] **Step 3: Replace employee sidebar nav with accordion**

In the sidebar `<nav>` section, find the `{navItems.map(...)}` block that renders employee nav items. Replace the entire block (the non-admin branch) so the sidebar renders either ADMIN_NAV (unchanged) or the accordion:

```tsx
<nav className="flex-1 px-4 py-4 space-y-1">
  {isAdmin ? (
    // Admin nav — unchanged flat list
    ADMIN_NAV.map((item) => (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
          activeScreen === item.id ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
        }`}
      >
        <i className={`fas ${item.icon} w-4 text-center`}></i>
        <span>{item.label}</span>
        {item.id === Screen.ADMIN_NOTIFICATIONS && (
          <Badge count={notificationsUnread} />
        )}
      </button>
    ))
  ) : (
    // Employee accordion nav
    visibleModules.map((module) => {
      const isOpen   = openModule === module.key;
      const hasActive = (module.screens as readonly Screen[]).includes(activeScreen);
      return (
        <div key={module.key}>
          <button
            onClick={() => setOpenModule(isOpen ? null : module.key)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
              hasActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
            }`}
          >
            <div className="flex items-center space-x-3">
              <i className={`fas ${module.icon} w-4 text-center`}></i>
              <span>{module.label}</span>
            </div>
            <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-xs opacity-50`}></i>
          </button>
          {isOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-white/20 pl-3">
              {module.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    activeScreen === item.id ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                  }`}
                >
                  <i className={`fas ${item.icon} w-4 text-center opacity-70`}></i>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    })
  )}
</nav>
```

- [ ] **Step 4: Replace mobile bottom nav**

Find the mobile `<nav>` at the bottom. Replace the `{navItems.map(...)}` with:

```tsx
{isAdmin ? (
  ADMIN_NAV.slice(0, 5).map((item) => (
    <button
      key={item.id}
      onClick={() => onNavigate(item.id)}
      className={`relative px-4 py-2.5 rounded-full transition-all ${
        activeScreen === item.id ? 'text-kameya-burgundy bg-red-50' : 'text-gray-400'
      }`}
    >
      <i className={`fas ${item.icon} text-lg`}></i>
      {item.id === Screen.ADMIN_NOTIFICATIONS && notificationsUnread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {notificationsUnread > 99 ? '99+' : notificationsUnread}
        </span>
      )}
    </button>
  ))
) : (
  visibleModules.map((module) => (
    <button
      key={module.key}
      onClick={() => onNavigate(module.items[0].id)}
      className={`relative px-5 py-2.5 rounded-full transition-all ${
        (module.screens as readonly Screen[]).includes(activeScreen)
          ? 'text-kameya-burgundy bg-red-50'
          : 'text-gray-400'
      }`}
    >
      <i className={`fas ${module.icon} text-lg`}></i>
    </button>
  ))
)}
```

- [ ] **Step 5: Remove the now-unused `EMPLOYEE_NAV` and `navItems` variable**

The `navItems` variable (`const navItems = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV`) is no longer used. Remove it and `EMPLOYEE_NAV`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: TypeScript errors only for Screen.ONBOARDING_* and Screen.LEARNING_* not having cases in App.tsx renderEmployeeScreen — these are fine; they will be fixed in Task 5.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: replace flat employee nav with 3-module accordion + module mobile nav"
```

---

### Task 5: Frontend — Placeholder screens + App.tsx wiring + initial screen redirect

**Files:**
- Create: `frontend/src/components/onboarding/OnboardingView.tsx`
- Create: `frontend/src/components/learning/LearningView.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `Screen.*` values from Task 3; `useAccess()` from Task 3

- [ ] **Step 1: Create `frontend/src/components/onboarding/OnboardingView.tsx`**

```typescript
import React from 'react';

interface OnboardingViewProps {
  track: '14' | '30' | '60';
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ track }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
      <i className="fas fa-user-clock text-2xl text-kameya-burgundy" />
    </div>
    <h2 className="text-xl font-bold text-slate-800 mb-2">Онбординг — {track} днів</h2>
    <p className="text-slate-400 text-sm">Розділ в розробці</p>
  </div>
);
```

- [ ] **Step 2: Create `frontend/src/components/learning/LearningView.tsx`**

```typescript
import React from 'react';

const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  general:    { label: 'Загальний розвиток',    icon: 'fa-seedling'   },
  start:      { label: 'Старт роботи',          icon: 'fa-play'       },
  consultant: { label: 'Продавець-консультант', icon: 'fa-tag'        },
  managers:   { label: 'Керівники',             icon: 'fa-crown'      },
  marketing:  { label: 'Маркетинг',             icon: 'fa-bullhorn'   },
};

interface LearningViewProps {
  section: keyof typeof SECTION_LABELS;
}

export const LearningView: React.FC<LearningViewProps> = ({ section }) => {
  const { label, icon } = SECTION_LABELS[section];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
        <i className={`fas ${icon} text-2xl text-kameya-burgundy`} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">{label}</h2>
      <p className="text-slate-400 text-sm">Розділ в розробці</p>
    </div>
  );
};
```

- [ ] **Step 3: Add imports in `frontend/src/App.tsx`**

```typescript
import { OnboardingView } from './components/onboarding/OnboardingView';
import { LearningView }   from './components/learning/LearningView';
import { useAccess }      from './context/AccessContext';
```

- [ ] **Step 4: Add new Screen cases to `renderEmployeeScreen()` in App.tsx**

Inside `renderEmployeeScreen()`, add before the `default` case:

```typescript
case Screen.ONBOARDING_14: return <OnboardingView track="14" />;
case Screen.ONBOARDING_30: return <OnboardingView track="30" />;
case Screen.ONBOARDING_60: return <OnboardingView track="60" />;
case Screen.LEARNING_GENERAL:    return <LearningView section="general" />;
case Screen.LEARNING_START:      return <LearningView section="start" />;
case Screen.LEARNING_CONSULTANT: return <LearningView section="consultant" />;
case Screen.LEARNING_MANAGERS:   return <LearningView section="managers" />;
case Screen.LEARNING_MARKETING:  return <LearningView section="marketing" />;
```

- [ ] **Step 5: Add initial screen redirect in `AppContent`**

Inside `AppContent` function body, add `useAccess()` call and a redirect effect. Add after the existing `useAuth()` call:

```typescript
const { canMysteryShop, canOnboarding, canLearning, isLoading: accessLoading } = useAccess();

const MYSTERY_SHOP_SCREENS = new Set([Screen.DASHBOARD, Screen.MY_REPORTS, Screen.PROGRESS, Screen.TRAINING_PLAN, Screen.AUDIT_DETAILS, Screen.QUIZ]);
const ONBOARDING_SCREENS   = new Set([Screen.ONBOARDING_14, Screen.ONBOARDING_30, Screen.ONBOARDING_60]);
const LEARNING_SCREENS     = new Set([Screen.LEARNING_GENERAL, Screen.LEARNING_START, Screen.LEARNING_CONSULTANT, Screen.LEARNING_MANAGERS, Screen.LEARNING_MARKETING]);

useEffect(() => {
  if (!user || isLoading || accessLoading) return;
  if (user.isAdmin) return;

  const onMystery  = MYSTERY_SHOP_SCREENS.has(currentScreen);
  const onOnboard  = ONBOARDING_SCREENS.has(currentScreen);
  const onLearning = LEARNING_SCREENS.has(currentScreen);

  if (onMystery && !canMysteryShop) {
    if (canOnboarding)  setCurrentScreen(Screen.ONBOARDING_14);
    else if (canLearning) setCurrentScreen(Screen.LEARNING_GENERAL);
  } else if (onOnboard && !canOnboarding) {
    if (canMysteryShop) setCurrentScreen(Screen.DASHBOARD);
    else if (canLearning) setCurrentScreen(Screen.LEARNING_GENERAL);
  } else if (onLearning && !canLearning) {
    if (canMysteryShop) setCurrentScreen(Screen.DASHBOARD);
    else if (canOnboarding) setCurrentScreen(Screen.ONBOARDING_14);
  }
}, [user, isLoading, accessLoading, canMysteryShop, canOnboarding, canLearning, currentScreen]);
```

Note: `MYSTERY_SHOP_SCREENS`, `ONBOARDING_SCREENS`, `LEARNING_SCREENS` must be defined outside the component (module level) to avoid recreating on every render.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Manual test**

1. Log in as a user with `division: 'stores', position: 'Початківець консультант'`
2. Sidebar should show: Онбординг (open) + Навчання — no Таємний покупець
3. Navigate between Онбординг sub-items and Навчання sub-items
4. Accordion opens/closes correctly

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/onboarding/OnboardingView.tsx \
        frontend/src/components/learning/LearningView.tsx \
        frontend/src/App.tsx
git commit -m "feat: placeholder onboarding/learning screens, App.tsx wiring, initial screen redirect"
```

---

### Task 6: Frontend — Admin AccessMatrixView + nav item

**Files:**
- Create: `frontend/src/components/admin/AccessMatrixView.tsx`
- Modify: `frontend/src/components/Layout.tsx` (ADMIN_NAV)
- Modify: `frontend/src/App.tsx` (renderAdminScreen)

**Interfaces:**
- Consumes: `PUT /api/access-matrix` from Task 2; `useAccess()` (for `matrix` and `refreshMatrix`) from Task 3; `Screen.ADMIN_ACCESS_MATRIX` from Task 3

- [ ] **Step 1: Create `frontend/src/components/admin/AccessMatrixView.tsx`**

```typescript
import React, { useState } from 'react';
import { useAccess, AccessRule } from '../../context/AccessContext';
import { apiFetch } from '../../services/apiFetch';

const ROW_LABELS: { division: string; position: string; label: string }[] = [
  { division: 'stores',   position: 'Початківець консультант', label: 'Магазини / Початківець консультант' },
  { division: 'stores',   position: 'Консультант',             label: 'Магазини / Консультант' },
  { division: 'stores',   position: 'Керівник',                label: 'Магазини / Керівник' },
  { division: 'office',   position: 'Співробітник',            label: 'Офіс / Співробітник' },
  { division: 'office',   position: 'Керівник',                label: 'Офіс / Керівник' },
  { division: 'security', position: 'Охоронець',               label: 'Охорона / Охоронець' },
  { division: 'security', position: 'Керівник',                label: 'Охорона / Керівник' },
];

type ModuleField = 'mysteryShop' | 'onboarding' | 'learning';

const MODULE_COLS: { key: ModuleField; label: string }[] = [
  { key: 'mysteryShop', label: 'Таємний покупець' },
  { key: 'onboarding',  label: 'Онбординг' },
  { key: 'learning',    label: 'Навчання' },
];

export const AccessMatrixView: React.FC = () => {
  const { matrix, refreshMatrix } = useAccess();
  const [saving, setSaving] = useState<string | null>(null);

  if (!matrix) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-kameya-burgundy text-2xl" />
      </div>
    );
  }

  const getRule = (division: string, position: string): AccessRule | undefined =>
    matrix.find(r => r.division === division && r.position === position);

  const handleToggle = async (division: string, position: string, moduleKey: ModuleField, value: boolean) => {
    const key = `${division}-${position}-${moduleKey}`;
    setSaving(key);

    const updated: AccessRule[] = ROW_LABELS.map(row => {
      const existing = getRule(row.division, row.position);
      const modules  = existing?.modules ?? { mysteryShop: false, onboarding: false, learning: true };
      if (row.division === division && row.position === position) {
        return { division: row.division, position: row.position, modules: { ...modules, [moduleKey]: value } };
      }
      return { division: row.division, position: row.position, modules };
    });

    try {
      await apiFetch('/api/access-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated }),
      });
      await refreshMatrix();
    } catch {
      // revert is handled by refreshMatrix — UI returns to DB state
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Матриця доступів</h1>
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-4 font-semibold text-slate-600 w-64">Підрозділ / Посада</th>
              {MODULE_COLS.map(col => (
                <th key={col.key} className="px-6 py-4 font-semibold text-slate-600 text-center">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_LABELS.map((row, idx) => {
              const rule = getRule(row.division, row.position);
              return (
                <tr key={row.label} className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                  <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                  {MODULE_COLS.map(col => {
                    const isOn  = rule?.modules[col.key] ?? false;
                    const key   = `${row.division}-${row.position}-${col.key}`;
                    const isBusy = saving === key;
                    return (
                      <td key={col.key} className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggle(row.division, row.position, col.key, !isOn)}
                          disabled={isBusy}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            isOn ? 'bg-kameya-burgundy' : 'bg-slate-200'
                          } ${isBusy ? 'opacity-50' : ''}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            isOn ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Зміни застосовуються одразу. Адміни мають доступ до всього незалежно від матриці.</p>
    </div>
  );
};
```

- [ ] **Step 2: Add nav item to ADMIN_NAV in `Layout.tsx`**

In `ADMIN_NAV`, add after `ADMIN_COMPANY_STRUCTURE`:
```typescript
{ id: Screen.ADMIN_ACCESS_MATRIX, label: 'Доступи', icon: 'fa-sliders' },
```

- [ ] **Step 3: Wire screen in `App.tsx`**

Add import:
```typescript
import { AccessMatrixView } from './components/admin/AccessMatrixView';
```

In `renderAdminScreen()`, add before `default`:
```typescript
case Screen.ADMIN_ACCESS_MATRIX:
  return <AccessMatrixView />;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Manual end-to-end test**

1. Log in as admin → open "Доступи" in sidebar
2. Toggle "Таємний покупець" OFF for "Магазини / Консультант"
3. Log in as a Консультант → sidebar should NOT show Таємний покупець
4. Toggle it back ON as admin
5. Re-login as Консультант → sidebar shows Таємний покупець again

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AccessMatrixView.tsx \
        frontend/src/components/Layout.tsx \
        frontend/src/App.tsx
git commit -m "feat: admin access matrix UI with live toggles"
```
