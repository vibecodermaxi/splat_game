---
phase: 04-trust-layer-and-docs
plan: "02"
subsystem: ui
tags: [solana, anchor, react, zustand, motion, betting, on-chain]

# Dependency graph
requires:
  - phase: 03-frontend-core
    provides: usePlaceBet transaction pattern, useAnchorProgram, gameStore, PixelSnapshot types
  - phase: 01-anchor-program
    provides: BetAccount, PlayerSeasonStats PDAs, claim_winnings instruction

provides:
  - useBetHistory hook: fetches all player BetAccounts via memcmp filter, resolves win/loss, fetches PlayerSeasonStats
  - useClaimWinnings hook: claim_winnings transaction with single and sequential batch modes
  - MyBetsDrawer: slide-up bottom drawer with drag-to-dismiss handle
  - BetStatsBar: compact 4-metric stats bar (bets/wins/hitRate/volume)
  - BetHistoryList: grouped bet list with Active/Claimable/History sections
  - ClaimButton + ClaimAllButton: per-bet and batch claim actions

affects: [04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useBetHistory: (program.account as any)[betAccount].all([memcmp]) for player BetAccount enumeration"
    - "useClaimWinnings: sequential for...of loop (NOT Promise.all) for batch claims to avoid account-in-use errors"
    - "MyBetsDrawer: drag=y on handle div ONLY to prevent scroll-drag conflict in scrollable list"
    - "Mock typing: vi.mocked(useGameStore) as unknown as ReturnType<typeof vi.fn> for Zustand mock casts"

key-files:
  created:
    - app/src/hooks/useBetHistory.ts
    - app/src/hooks/useClaimWinnings.ts
    - app/src/components/mybets/MyBetsDrawer.tsx
    - app/src/components/mybets/BetHistoryList.tsx
    - app/src/components/mybets/BetStatsBar.tsx
    - app/src/components/mybets/ClaimButton.tsx
    - app/src/__tests__/MyBetsDrawer.test.tsx
  modified: []

key-decisions:
  - "drag=y applied to drag handle div only (not full drawer) to prevent scroll-drag conflict per Pitfall 4 from research"
  - "claimAll uses sequential for...of not Promise.all — all claims write same PlayerSeasonStats PDA"
  - "Claim All footer only shown when claimableBets.length > 1 (not >=1) to avoid single-bet redundancy"
  - "vi.mocked(useGameStore) as unknown as ReturnType<typeof vi.fn> used to cast Zustand store mock — direct ReturnType<typeof vi.fn> cast fails TS compiler"

patterns-established:
  - "Pattern 1: memcmp filter at offset 8 on player pubkey for BetAccount enumeration via program.account[betAccount].all()"
  - "Pattern 2: fetchMultiple for batching pixel PDA reads — avoids N individual requests"
  - "Pattern 3: BN.toNumber() conversion for Anchor-decoded u64 amounts"

requirements-completed: [FS-01, FS-02, FS-03]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 4 Plan 02: My Bets Drawer Summary

**On-chain bet history drawer with memcmp-filtered BetAccount enumeration, sequential claim transactions, and player season stats from PlayerSeasonStats PDA**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T11:54:16Z
- **Completed:** 2026-03-18T11:58:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- useBetHistory fetches all player BetAccounts via memcmp filter at byte offset 8, resolves win/loss for each bet by fetching PixelState accounts in batch, and computes hit rate from PlayerSeasonStats PDA
- useClaimWinnings submits claim_winnings instructions individually or as a sequential batch (for...of not Promise.all) with progress tracking and double-submit protection
- MyBetsDrawer is a 85vh slide-up bottom sheet with spring animation, drag-to-dismiss handle (isolation prevents scroll conflict), stats bar, grouped bet list, and sticky Claim All footer
- 9 tests covering: stats placeholder display, bet categorization, claim button visibility, Claim All count, empty state, and closed state

## Task Commits

Each task was committed atomically:

1. **Task 1: Build useBetHistory and useClaimWinnings hooks** - `005be95` (feat)
2. **Task 2: Build MyBetsDrawer, BetStatsBar, BetHistoryList, and ClaimButton** - `f6462b8` (feat)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified

- `app/src/hooks/useBetHistory.ts` - BetHistoryEntry/PlayerStats interfaces and hook fetching all player BetAccounts with memcmp
- `app/src/hooks/useClaimWinnings.ts` - claim_winnings transaction hook with claimSingle and sequential claimAll
- `app/src/components/mybets/MyBetsDrawer.tsx` - slide-up bottom drawer orchestrating all sub-components
- `app/src/components/mybets/BetStatsBar.tsx` - horizontal 4-metric stats bar with placeholders
- `app/src/components/mybets/BetHistoryList.tsx` - grouped bet rows with color swatches and status badges
- `app/src/components/mybets/ClaimButton.tsx` - ClaimButton (per-bet inline) and ClaimAllButton (sticky footer gradient)
- `app/src/__tests__/MyBetsDrawer.test.tsx` - 9 unit tests for drawer behavior

## Decisions Made

- `drag="y"` applied to the handle pill div only, not the full drawer container — per research Pitfall 4, dragging the full container captures pointer events from the scrollable bet list, breaking scroll
- `claimAll` uses `for...of` with `await` (not `Promise.all`) because all claim transactions write the same `PlayerSeasonStats` PDA; parallel submission causes "account already in use" Solana errors
- Claim All footer only appears when `claimableBets.length > 1` — showing it for a single bet adds no value over the inline Claim button
- `vi.mocked(useGameStore) as unknown as ReturnType<typeof vi.fn>` required in tests — Zustand's `UseBoundStore<StoreApi<T>>` type is not directly castable to `ReturnType<typeof vi.fn>`, adding `unknown` as intermediate cast fixes TS2352

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Test: `getByText("Active")` threw "multiple elements found" because the "Active" text appeared in both the section header and the status badge. Fixed by switching to `getAllByText("Active").length >= 1`.
- TypeScript: `useGameStore as ReturnType<typeof vi.fn>` caused TS2352 due to Zustand's complex store type. Fixed by using `vi.mocked(useGameStore) as unknown as ReturnType<typeof vi.fn>`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- MyBetsDrawer is ready to be wired into the game page header via a "Bets" button (triggers `isOpen` state)
- useBetHistory and useClaimWinnings are standalone hooks — no store changes required
- Phase 04-03 can proceed with season completion overlay and intermission screen

---
*Phase: 04-trust-layer-and-docs*
*Completed: 2026-03-18*
