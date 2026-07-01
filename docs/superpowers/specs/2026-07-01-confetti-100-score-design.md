# Confetti Animation for 100% Score — Design Spec

**Date:** 2026-07-01  
**Scope:** `frontend/src/components/employee/MyReportsView.tsx`

## Goal

When an employee opens a mystery shopper report with `totalScore === 100`, show a confetti animation as a congratulatory moment. Fires every time the report is opened.

## Library

`canvas-confetti` + `@types/canvas-confetti` — lightweight (~3kb), renders on a canvas overlay, no React wrapper needed.

## Implementation

### 1. Install dependencies
```
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

### 2. MyReportsView.tsx changes

- Import `confetti` from `canvas-confetti`
- In the detail view section (when `selected` is set), add a `useEffect` that triggers when `selected` changes:
  - If `selected.totalScore === 100`, fire two confetti bursts from left and right sides (classic celebration effect)
  - Use `setTimeout` for the second burst (~150ms delay)
- Below the score card, when `totalScore === 100`, render a small banner:  
  `"Ідеальний результат! 🎉"` in green styling (matching existing green color tokens)

### Confetti config
```ts
confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } });
confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
```

## Boundaries

- No new files or components
- No backend changes
- Animation does not persist between sessions — fires fresh on each open
- The banner is purely decorative, no interaction required
