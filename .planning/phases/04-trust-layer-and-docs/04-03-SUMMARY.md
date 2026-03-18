---
phase: 04-trust-layer-and-docs
plan: "03"
subsystem: ui
tags: [react, nextjs, season-completion, confetti, canvas-confetti, html-to-image, png-export, countdown, intermission]

# Dependency graph
requires:
  - phase: 03-frontend-core
    provides: computePixelColor, PixelSnapshot type, WinNotification confetti pattern, motion/react patterns, Zustand store, useSeasonData Anchor decode patterns
provides:
  - useSeasonCompletion hook — fetches SeasonState, decodes active/completed/intermission status + intermissionEndsSeconds
  - SeasonCompleteOverlay — full-screen celebration with confetti burst, zoomed 10x10 canvas, season stats, share/dismiss buttons
  - IntermissionScreen — full-page 12h countdown (HH:MM:SS), completed canvas display, season stats, share/view buttons
  - ShareCanvas — offscreen branded PNG template + useShareCanvas hook (toPng, navigator.share, download fallback)
  - ShareCanvasTemplate — reusable offscreen div for html-to-image capture
affects:
  - 04-trust-layer-and-docs (other plans integrating season completion flow into game page)

# Tech tracking
tech-stack:
  added:
    - html-to-image ^1.11.13 — DOM-to-PNG via SVG serialization; used in ShareCanvas.tsx
  patterns:
    - SeasonState status enum decode: statusRaw.completed !== undefined → "completed", statusRaw.intermission !== undefined → "intermission"
    - Sustained confetti: 4-second rAF loop with dual-origin left/right bursts using 6 brand colors
    - Offscreen share template: position absolute left-9999px visibility-hidden with inline hex styles (not CSS vars)
    - navigator.canShare guard before navigator.share to avoid desktop crash (Pitfall 7)
    - HH:MM:SS countdown via setInterval + Math.floor(Date.now()/1000)

key-files:
  created:
    - app/src/hooks/useSeasonCompletion.ts
    - app/src/components/season/SeasonCompleteOverlay.tsx
    - app/src/components/season/IntermissionScreen.tsx
    - app/src/components/share/ShareCanvas.tsx
    - app/src/__tests__/SeasonCompleteOverlay.test.tsx
    - app/src/__tests__/IntermissionScreen.test.tsx
  modified:
    - app/package.json (html-to-image added)
    - app/package-lock.json

key-decisions:
  - "useSeasonCompletion fetches SeasonState account directly with Anchor coder (not Zustand store) — store lacks season status/completedAt fields and adding them was out of scope for this plan"
  - "ShareCanvas uses inline hex styles not CSS variables — html-to-image may not resolve CSS custom properties in offscreen elements (Pitfall 2 from research)"
  - "navigator.canShare check with files argument before navigator.share — desktop Chrome supports text/url sharing but not file sharing (Pitfall 7)"
  - "SeasonCompleteOverlay onShare prop is optional — allows embedding without share feature, tested both cases"
  - "IntermissionScreen setInterval updates every 1000ms; isExpired flag prevents double-interval creation after countdown reaches 0"

patterns-established:
  - "Offscreen PNG template pattern: visibility:hidden position:absolute left:-9999px div + html-to-image toPng(ref)"
  - "Season status decode: check statusRaw.completed/intermission !== undefined (Anchor enum object variant pattern)"

requirements-completed: [FS-04, FS-05, FS-06]

# Metrics
duration: 35min
completed: 2026-03-18
---

# Phase 04 Plan 03: Season Completion Celebration and Branded PNG Share Summary

**Full-screen season completion overlay with confetti burst, 12-hour intermission countdown, and branded PNG generation using html-to-image with navigator.share/download fallback**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-18T11:24:00Z
- **Completed:** 2026-03-18T11:59:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Built `useSeasonCompletion` hook that fetches SeasonState on-chain, decodes `status` enum (active/completed/intermission), and computes `intermissionEndsSeconds = completedAt + 12h`
- Built `SeasonCompleteOverlay` with 4-second dual-origin confetti burst, zoomed 10x10 pixel grid using `computePixelColor`, season stats, and Share/Continue buttons — respects `prefers-reduced-motion`
- Built `IntermissionScreen` with live `HH:MM:SS` countdown (updates every second), completed canvas, season stats, Share Canvas and View Canvas buttons
- Built `ShareCanvas` + `ShareCanvasTemplate` + `useShareCanvas` hook using `html-to-image` `toPng()` with inline hex styles, `navigator.canShare` guard, and programmatic download fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Build useSeasonCompletion hook and SeasonCompleteOverlay** - `c2cc134` (feat)
2. **Task 2: Build IntermissionScreen and ShareCanvas with PNG generation** - `d79ca19` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/src/hooks/useSeasonCompletion.ts` — Reads SeasonState account, decodes status enum, exposes refresh() callback
- `app/src/components/season/SeasonCompleteOverlay.tsx` — Full-screen celebration overlay (z-index 600), confetti, zoomed canvas grid, stats
- `app/src/components/season/IntermissionScreen.tsx` — Full-page intermission with countdown timer, canvas display, share/view buttons
- `app/src/components/share/ShareCanvas.tsx` — ShareCanvasTemplate (offscreen branded div), useShareCanvas hook, ShareCanvas wrapper
- `app/src/__tests__/SeasonCompleteOverlay.test.tsx` — 7 tests covering heading, 100 pixel cells, share/dismiss buttons
- `app/src/__tests__/IntermissionScreen.test.tsx` — 8 tests covering countdown format, 1s update, expiry, pixel cells, all buttons
- `app/package.json` — html-to-image ^1.11.13 added
- `app/package-lock.json` — lockfile updated

## Decisions Made
- Used inline hex styles in ShareCanvasTemplate (not CSS variables) to avoid html-to-image CSS resolution failure in offscreen elements
- Added `navigator.canShare({ files: [file] })` guard before calling `navigator.share` to handle desktop browsers gracefully
- `useSeasonCompletion` fetches SeasonState account directly via Anchor coder — Zustand store doesn't track season status or completedAt (those fields are separate from what previous plans added)
- `SeasonCompleteOverlay`'s `onShare` prop is optional so the component can be rendered without share functionality during testing or when ShareCanvas is managed externally

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing required PixelSnapshot fields to test mock**
- **Found during:** Task 1 (SeasonCompleteOverlay tests)
- **Issue:** `PixelSnapshot` type in `game.ts` already had `promptHash`, `arweaveTxid`, `hasArweaveTxid` fields (added in a prior plan). Test mock omitted them, causing TS2739.
- **Fix:** Added `promptHash: new Array(32).fill(0)`, `arweaveTxid: null`, `hasArweaveTxid: false` to mock pixels in both test files.
- **Files modified:** `app/src/__tests__/SeasonCompleteOverlay.test.tsx`
- **Verification:** `npx tsc --noEmit` returned zero errors; all tests pass
- **Committed in:** c2cc134 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type conformance)
**Impact on plan:** Minor test mock fix. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `MyBetsDrawer.test.tsx` (from plan 04-02) — these are out of scope and not caused by our changes. All 88 tests still pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Season completion flow components are ready for integration into the main game `page.tsx`
- `useSeasonCompletion` + `SeasonCompleteOverlay` + `IntermissionScreen` can be wired together with `useHeliusSocket` WebSocket updates that trigger season account state changes
- `ShareCanvas` is self-contained and embeddable in any parent component

---
*Phase: 04-trust-layer-and-docs*
*Completed: 2026-03-18*
