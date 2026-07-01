# Confetti 100% Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a confetti animation and a congratulatory banner when an employee opens a mystery shopper report with totalScore === 100.

**Architecture:** Install `canvas-confetti`, then modify `MyReportsView.tsx` to fire two confetti bursts (left + right) via a `useEffect` triggered when `selected` changes and its score is 100. A small green banner is rendered below the score card.

**Tech Stack:** React 18, TypeScript, canvas-confetti, Tailwind CSS

## Global Constraints

- No new files or components — all changes go into `MyReportsView.tsx`
- No backend changes
- Confetti fires every time the detail view is opened for a 100% report
- Working directory for npm commands: `frontend/`

---

### Task 1: Install canvas-confetti

**Files:**
- Modify: `frontend/package.json` (via npm install)

**Interfaces:**
- Produces: `import confetti from 'canvas-confetti'` available in the project

- [ ] **Step 1: Install the package**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

Expected output: both packages added to `node_modules`, `package.json` updated with `"canvas-confetti"` in `dependencies` and `"@types/canvas-confetti"` in `devDependencies`.

- [ ] **Step 2: Verify the import resolves**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors about `canvas-confetti` module not found.

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: install canvas-confetti for 100% score celebration"
```

---

### Task 2: Add confetti effect and banner to MyReportsView

**Files:**
- Modify: `frontend/src/components/employee/MyReportsView.tsx`

**Interfaces:**
- Consumes: `confetti` from `canvas-confetti` (Task 1)
- Consumes: `selected.totalScore` — number field on `AuditResult` type (already present)

- [ ] **Step 1: Add the import at the top of the file**

Open `frontend/src/components/employee/MyReportsView.tsx`.

After the existing imports (around line 8), add:

```ts
import confetti from 'canvas-confetti';
```

- [ ] **Step 2: Add the useEffect that fires confetti**

In the detail view section (after `if (selected) {`, around line 93), add a `useEffect` before the `return`. The full block to insert immediately before `return (` in the detail view:

```tsx
  useEffect(() => {
    if (!selected || selected.totalScore < 100) return;
    const timer = setTimeout(() => {
      confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
    return () => clearTimeout(timer);
  }, [selected]);
```

The 300ms delay lets the detail view render first so the canvas appears above the content naturally.

- [ ] **Step 3: Add the congratulatory banner below the score card**

In the JSX, find the score card block (the `<div className={...scoreBgBorderClass...}>` block that ends around line 140). Immediately after its closing `</div>`, add:

```tsx
        {selected.totalScore >= 100 && (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-6 py-4">
            <span className="text-2xl">🎉</span>
            <p className="text-green-700 font-bold text-lg">Ідеальний результат!</p>
            <span className="text-2xl">🎉</span>
          </div>
        )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test — run the dev server**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npm run dev
```

Open the app in the browser, log in as an employee who has a report with 100% score, click that report. Verify:
- Confetti bursts appear from both sides of the screen
- The green "Ідеальний результат! 🎉" banner appears below the score card
- Navigating back to the list and opening the same report fires confetti again

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add frontend/src/components/employee/MyReportsView.tsx
git commit -m "feat: add confetti animation and banner for 100% score reports"
```
