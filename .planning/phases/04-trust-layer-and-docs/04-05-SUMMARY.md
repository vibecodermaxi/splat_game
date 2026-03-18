---
phase: 04-trust-layer-and-docs
plan: "05"
subsystem: ui
tags: [react, onboarding, wallet-adapter, next.js, vitest]

# Dependency graph
requires:
  - phase: 04-trust-layer-and-docs
    provides: MyBetsDrawer, SeasonCompleteOverlay, IntermissionScreen, useBetHistory, useSeasonCompletion
  - phase: 03-frontend-core
    provides: GameCanvas, BettingPanel, RoundInfo, useResolution, useGameStore, useHeliusSocket

provides:
  - OnboardingTour: 4-step first-visit tooltip tour with localStorage persistence
  - WalletDisconnectBanner: orange recovery banner on wallet true->false disconnect transition
  - JackpotTeaser: compact Coming soon header element in Splat Cyan
  - page.tsx: fully wired game page with all Phase 4 components, header buttons, season routing

affects:
  - Any future phase modifying page.tsx or header layout

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prevConnectedRef pattern for detecting wallet true->false transition without firing on initial render"
    - "useRef + useEffect for one-shot transition detection (avoids double-trigger on hydration)"
    - "Fixed-position tooltip via getBoundingClientRect with viewport clamping and above/below placement logic"
    - "as any cast for WalletContextState mock in tests (WalletContextState.autoConnect required field)"

key-files:
  created:
    - app/src/components/onboarding/OnboardingTour.tsx
    - app/src/components/ui/WalletDisconnectBanner.tsx
    - app/src/components/ui/JackpotTeaser.tsx
    - app/src/__tests__/OnboardingTour.test.tsx
    - app/src/__tests__/WalletDisconnectBanner.test.tsx
  modified:
    - app/src/app/page.tsx

key-decisions:
  - "OnboardingTour positions tooltip via getBoundingClientRect with 80ms settle delay to avoid measuring before layout"
  - "WalletDisconnectBanner uses prevConnectedRef to detect only true->false transitions (not initial false state)"
  - "id='game-canvas' added to canvas div and id='splat-header' to header for OnboardingTour targeting"
  - "WalletContextState mock requires autoConnect field — use as any cast in tests to avoid maintenance burden"
  - "JackpotTeaser is purely static — no on-chain read, no state, just a Coming soon pill badge"
  - "Bets button only renders when wallet is connected (useWallet().connected)"
  - "IntermissionScreen replaces the entire game; SeasonCompleteOverlay renders as z-index overlay above game"

patterns-established:
  - "prevConnectedRef: use useRef to detect state transitions in hooks that must fire only on edge changes"
  - "Tour components are self-contained (own localStorage reads, own hook calls) — no prop drilling required"

requirements-completed: [FS-10, FS-11, FS-12, FS-13]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 4 Plan 05: Phase 4 Integration Summary

**4-step onboarding tooltip tour, wallet disconnect recovery banner, jackpot teaser, and full Phase 4 component wiring into game page with header Bets/? buttons and season completion routing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T12:01:51Z
- **Completed:** 2026-03-18T12:09:00Z
- **Tasks:** 2 of 3 (Task 3 = human verify checkpoint)
- **Files modified:** 6

## Accomplishments
- OnboardingTour: 4-step first-visit tooltip tour with localStorage persistence, step indicator dots, Next/Got it! buttons, viewport-clamped positioning
- WalletDisconnectBanner: orange slide-down banner triggered only on true->false wallet transition, with Reconnect and Dismiss buttons
- JackpotTeaser: compact Splat Cyan "Coming soon" pill in header
- page.tsx wired with all Phase 4 components: MyBetsDrawer (Bets button), SeasonCompleteOverlay, IntermissionScreen, WalletDisconnectBanner, OnboardingTour
- Header updated with Bets button (conditional on wallet connection), ? button linking to /how-it-works, and JackpotTeaser

## Task Commits

Each task was committed atomically:

1. **Task 1: Build OnboardingTour, WalletDisconnectBanner, and JackpotTeaser components** - `31c9b74` (feat)
2. **Task 2: Wire all Phase 4 components into page.tsx** - `dda12b5` (feat)
3. **Task 3: Visual verification** - Awaiting human checkpoint

## Files Created/Modified
- `app/src/components/onboarding/OnboardingTour.tsx` - 4-step first-visit tooltip tour with localStorage persistence
- `app/src/components/ui/WalletDisconnectBanner.tsx` - Orange recovery banner on wallet disconnect transition
- `app/src/components/ui/JackpotTeaser.tsx` - Static Coming soon pill badge for header
- `app/src/__tests__/OnboardingTour.test.tsx` - 10 tests for tour behavior (first visit, skip, navigation, localStorage)
- `app/src/__tests__/WalletDisconnectBanner.test.tsx` - 5 tests for banner (initial state, transition, reconnect, dismiss)
- `app/src/app/page.tsx` - All Phase 4 components wired; header buttons; season state routing

## Decisions Made
- WalletDisconnectBanner uses prevConnectedRef to detect only true->false transitions — avoids banner appearing on initial page load when not connected
- id="game-canvas" added to canvas wrapper div, id="splat-header" to header element for OnboardingTour targeting
- WalletContextState mock requires autoConnect field in tests — used `as any` cast to avoid maintenance burden as wallet adapter types evolve
- JackpotTeaser is purely static (no on-chain read per FS-11 spec)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in test mock objects**
- **Found during:** Task 2 (verification via tsc --noEmit)
- **Issue:** WalletDisconnectBanner tests had missing `autoConnect` field in WalletContextState mock objects; OnboardingTour test had null localStorage return type mismatch
- **Fix:** Added `autoConnect: false` + `as any` cast for wallet mock; changed localStorage mock return to `null as unknown as string`
- **Files modified:** app/src/__tests__/WalletDisconnectBanner.test.tsx, app/src/__tests__/OnboardingTour.test.tsx
- **Verification:** tsc --noEmit exits with 0 errors
- **Committed in:** dda12b5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Necessary for zero-error TypeScript. No scope creep.

## Issues Encountered
- None beyond the TypeScript mock type mismatch, which was auto-fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 requirements (FS-10, FS-11, FS-12, FS-13) implemented
- Awaiting Task 3 human visual verification checkpoint
- After verification: Phase 4 complete, product ready for v1.0 launch

---
*Phase: 04-trust-layer-and-docs*
*Completed: 2026-03-18*
