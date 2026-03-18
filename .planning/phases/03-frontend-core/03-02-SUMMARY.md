---
phase: 03-frontend-core
plan: "02"
subsystem: ui
tags: [react, css-grid, websocket, helius, anchor, zustand, animation, vitest, typescript]

# Dependency graph
requires:
  - phase: 03-frontend-core
    plan: "01"
    provides: useGameStore, PixelSnapshot, computePixelColor, PROGRAM_ID, GRID_SIZE constants, PDA derivation functions, useAnchorProgram hook
  - phase: 01-anchor-program
    provides: PixelState and SeasonState IDL account definitions, discriminator bytes for Anchor coder.accounts.decode
provides:
  - 10x10 CSS Grid canvas (GameCanvas) rendering 100 pixel cells from Zustand store
  - PixelCell with marching-ants active animation, shade/warmth computed background color, fade-in
  - PixelTooltip floating card with color/shade/warmth/round/VRF badge, click-away dismiss
  - RoundInfo showing "Round N of 100" and "Season N" with Splat Cyan progress bar
  - useHeliusSocket: onAccountChange subscriptions for PixelState + SeasonState, 60s getSlot ping, 15s polling fallback, tab visibility re-fetch
  - useSeasonData: initial fetch of SeasonState + all pixel PDAs on mount, BetAccount for active pixel
  - Marching-ants borderMarch CSS keyframe in globals.css
  - 45 unit tests passing across all plan files
affects: [03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS keyframe animation for marching-ants border (borderMarch) — avoids motion library type constraints on DOM elements
    - Anchor coder bracket-notation access: (program.account as any)["pixelState"] to bypass AccountNamespace<Idl> type gap
    - Tooltip click-away via document mousedown/touchstart listeners with ref.contains() guard
    - WebSocket subscription with closured connection object for clean mock isolation in tests
    - decodePixelStateToSnapshot: shared decode utility duplicated in both hooks (consistency over DRY for hook independence)

key-files:
  created:
    - app/src/components/canvas/GameCanvas.tsx
    - app/src/components/canvas/PixelCell.tsx
    - app/src/components/canvas/PixelTooltip.tsx
    - app/src/components/round/RoundInfo.tsx
    - app/src/hooks/useHeliusSocket.ts
    - app/src/hooks/useSeasonData.ts
    - app/src/__tests__/GameCanvas.test.tsx
    - app/src/__tests__/RoundInfo.test.tsx
    - app/src/__tests__/useHeliusSocket.test.ts
  modified:
    - app/src/app/globals.css (marching-ants animation, tooltip fade-in, pixel fade-in)
    - app/src/app/page.tsx (GameCanvas + RoundInfo + #betting-panel placeholder)

key-decisions:
  - "CSS keyframe for tooltip animation instead of motion animate(): motion library's animate() has strict ObjectTarget<HTMLDivElement> type that excludes opacity/scale on DOM elements; CSS @keyframes tooltipFadeIn achieves same visual with no type issues"
  - "Anchor account bracket-notation with any cast: program.account['pixelState'].fetchMultiple() requires (program.account as any) — AccountNamespace<Idl> does not expose camelCase account names in its type; consistent with oracle service approach"
  - "useHeliusSocket params: explicit pixelPDA + seasonPDA + seasonNumber instead of deriving internally — caller knows which accounts to watch, avoids hidden store reads inside hook"
  - "decodePixelStateToSnapshot duplicated in useHeliusSocket and useSeasonData — hooks are independent modules; sharing via a lib/ util would require an extra file for a 20-line function; acceptable duplication"
  - "WebSocket test uses module-level mutable connection object — avoids beforeEach mock-update complexity; tests mutate connection.onAccountChange.mockImplementation directly"

patterns-established:
  - "Canvas pixel tap pattern: GameCanvas onClick event delegation (data-pixel-index attr) captures exact clientX/clientY for tooltip placement; PixelCell.onTap used only for scroll-to-betting-panel"
  - "Active pixel scroll: PixelCell checks isActive and calls document.getElementById('betting-panel').scrollIntoView on click"
  - "Polling fallback pattern: ping failure in setInterval catch activates startPolling(); clearPolling() called when WS callback fires successfully"
  - "Tab visibility re-fetch: document.addEventListener visibilitychange → immediate re-fetch + ping interval reset to prevent browser-throttled stale data"

requirements-completed: [FE-02, FE-03, FE-12, FE-13, FE-16]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 3 Plan 02: Canvas Rendering and WebSocket Summary

**10x10 CSS Grid canvas with marching-ants active pixel, shade/warmth color rendering, pixel tooltips, RoundInfo progress, and Helius WebSocket subscription with Anchor coder decoding and 15-second polling fallback**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-17T22:45:16Z
- **Completed:** 2026-03-17T22:55:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Built 10x10 CSS Grid canvas (GameCanvas) rendering 100 PixelCell components from Zustand store, with marching-ants animation on the active pixel and shade/warmth-computed inline background-color for resolved pixels
- Implemented PixelTooltip (floating card with color name, shade, warmth, round, VRF badge, click-away dismiss) and RoundInfo (Round N of 100, Season N, progress bar in Splat Cyan)
- Wired useHeliusSocket (onAccountChange subscriptions, 60s ping, 15s polling fallback, tab visibility re-fetch) and useSeasonData (batch pixel fetch on mount, BetAccount for active pixel); all 45 tests pass, production build succeeds

## Task Commits

1. **Task 1: Build canvas components and season progress** - `79bb539` (feat)
2. **Task 2: Wire Helius WebSocket subscription and season data hooks** - `104859f` (feat)

## Files Created/Modified

- `app/src/components/canvas/GameCanvas.tsx` - 10x10 CSS Grid, tooltip state management, event delegation for click position
- `app/src/components/canvas/PixelCell.tsx` - Background color, marching-ants class, scroll-to-betting-panel on active tap
- `app/src/components/canvas/PixelTooltip.tsx` - Floating card, COLOR_NAMES lookup, VRF badge, click-away listener
- `app/src/components/round/RoundInfo.tsx` - Round N of 100, Season N, Splat Cyan progress bar
- `app/src/hooks/useHeliusSocket.ts` - WebSocket subscriptions, 60s getSlot ping, polling fallback, tab visibility
- `app/src/hooks/useSeasonData.ts` - SeasonState + pixel batch fetch on mount, BetAccount for active pixel
- `app/src/__tests__/GameCanvas.test.tsx` - 100-cell render, active class, background-color assertions
- `app/src/__tests__/RoundInfo.test.tsx` - Round 43 of 100, Season 1 text assertions
- `app/src/__tests__/useHeliusSocket.test.ts` - 4 tests: setPixelState callback, 60s ping, unmount cleanup, null guard
- `app/src/app/globals.css` - tooltipFadeIn, pixelFadeIn, borderMarch keyframes, pixel-active/pixel-resolved classes
- `app/src/app/page.tsx` - Header with RoundInfo + WalletMultiButton, GameCanvas, #betting-panel placeholder

## Decisions Made

- **CSS keyframe for tooltip animation:** The `motion` library's `animate()` function enforces `ObjectTarget<HTMLDivElement>` which excludes `opacity` and `scale` properties. Replaced with a `@keyframes tooltipFadeIn` CSS animation applied via element.style.animation in useEffect — same visual result, zero type errors.
- **Anchor account any-cast:** `program.account["pixelState"].fetchMultiple()` requires `(program.account as any)` because `AccountNamespace<Idl>` does not expose camelCase account names in its TypeScript interface. Same pattern used in the oracle service.
- **useHeliusSocket params explicit:** Hook receives `pixelPDA`, `seasonPDA`, `seasonNumber` as explicit props instead of reading from Zustand inside the hook — separation of concerns and easier to test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] motion library animate() type error on HTMLDivElement**
- **Found during:** Task 2 (production build verification)
- **Issue:** `animate(el, { opacity: [0, 1], scale: [0.9, 1] })` — TypeScript error: `Object literal may only specify known properties, and 'opacity' does not exist in type 'ObjectTarget<HTMLDivElement>'`
- **Fix:** Removed `animate` import from `motion`; replaced with CSS `@keyframes tooltipFadeIn` applied via `el.style.animation` in useEffect. Added keyframe to globals.css.
- **Files modified:** `app/src/components/canvas/PixelTooltip.tsx`, `app/src/app/globals.css`
- **Verification:** `npm run build` TypeScript check passes; `npm run test` still passes
- **Committed in:** 104859f (Task 2 commit)

**2. [Rule 1 - Bug] Anchor AccountNamespace<Idl> type gap for fetchMultiple**
- **Found during:** Task 2 (production build verification)
- **Issue:** `program.account["pixelState"].fetchMultiple(pixelPDAs)` — TypeScript error: `Element implicitly has an 'any' type because expression of type '"pixelState"' can't be used to index type 'AccountNamespace<Idl>'`
- **Fix:** Cast to `(program.account as any)["pixelState"].fetchMultiple()` and typed the forEach callback explicitly. Added `decoded: unknown` and cast at usage site.
- **Files modified:** `app/src/hooks/useSeasonData.ts`
- **Verification:** Build passes; intent preserved
- **Committed in:** 104859f (Task 2 commit)

**3. [Rule 3 - Blocking] WebSocket test @vitest-environment node incompatible with renderHook**
- **Found during:** Task 2 (test run)
- **Issue:** WebSocket test initially had `// @vitest-environment node` annotation (to isolate from jsdom for @solana/web3.js). But the hook uses `document.visibilityState` and `renderHook` from @testing-library/react requires DOM — causing `ReferenceError: document is not defined`.
- **Fix:** Removed the node environment annotation. The test doesn't call any @solana/web3.js PDA derivation, so jsdom works fine. Connection and PublicKey are mocked entirely.
- **Files modified:** `app/src/__tests__/useHeliusSocket.test.ts`
- **Verification:** All 4 WebSocket tests pass in jsdom environment
- **Committed in:** 104859f (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All three required for build and test correctness. No scope creep.

## Issues Encountered

- The WebSocket test mock pattern required care: using module-level mutable mock objects (rather than vi.fn in beforeEach) was the key to avoiding `mockReturnValue is not a function` errors that occur when trying to update mocks from inside async beforeEach after module initialization.

## User Setup Required

None — no new external service configuration required beyond the Helius RPC URL already documented in Plan 01.

## Next Phase Readiness

- Canvas components ready for visual integration testing at localhost:3000
- useHeliusSocket and useSeasonData ready to wire into the root page for live data
- #betting-panel placeholder in place for Plan 03 (betting panel) to target
- All 45 tests passing; production build clean

---
*Phase: 03-frontend-core*
*Completed: 2026-03-18*

## Self-Check: PASSED
