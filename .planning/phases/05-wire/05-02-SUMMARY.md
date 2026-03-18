---
phase: 05-wire
plan: 02
subsystem: ui
tags: [solana, anchor, environment-variables, devnet, frontend]

# Dependency graph
requires:
  - phase: 03-frontend-core
    provides: hooks (usePlaceBet, useClaimWinnings, useHeliusSocket, useSeasonData) that this plan un-hardcodes
provides:
  - Env-driven ROUND_DURATION_SECONDS constant (reads from NEXT_PUBLIC_ROUND_DURATION_SECONDS)
  - BETTING_WINDOW_SECONDS derived from ROUND_DURATION_SECONDS dynamically
  - WalletProvider defaulting to devnet.solana.com (not mainnet)
  - useSeasonData with configurable initialSeasonNumber parameter (default 1)
affects:
  - 05-wire (subsequent plans that assume devnet-ready frontend)
  - 06-deploy-and-prove (runtime configuration and env setup)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Env-var-driven constants: parseInt(process.env.NEXT_PUBLIC_X || 'default', 10)"
    - "Derived constants: compute BETTING_WINDOW_SECONDS from ROUND_DURATION_SECONDS at module level"
    - "Hook parameterization: accept optional param with sensible default rather than hardcoding"

key-files:
  created: []
  modified:
    - app/src/lib/constants.ts
    - app/src/components/providers/WalletProvider.tsx
    - app/src/hooks/useSeasonData.ts

key-decisions:
  - "LOCKOUT_SECONDS stays hardcoded at 120 — it is a protocol constant, not a deployment config"
  - "PROGRAM_ID stays hardcoded — same deployed address on devnet and mainnet per Anchor.toml"
  - "useSeasonData reads initialSeasonNumber as param (not from store) because store.seasonNumber starts at 0 and only gets set AFTER useSeasonData fetches — circular dependency if it read from store"
  - "app/.env.local is gitignored — changes documented in plan, not committed"

patterns-established:
  - "Constants that vary per environment use parseInt(process.env.NEXT_PUBLIC_X || 'default', 10)"
  - "Derived timing constants are computed at module load time from the env-driven base value"

requirements-completed: [INT-03, INT-04, INT-05, INT-06]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 5 Plan 02: Env-Driven Constants and Devnet Wiring Summary

**Env-driven round timing constants, devnet-default RPC endpoint, and parameterized useSeasonData hook to complete devnet frontend wiring**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-18T19:55:51Z
- **Completed:** 2026-03-18T19:57:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ROUND_DURATION_SECONDS reads from NEXT_PUBLIC_ROUND_DURATION_SECONDS env var with 1800 default
- BETTING_WINDOW_SECONDS derived dynamically from ROUND_DURATION_SECONDS minus LOCKOUT_SECONDS
- WalletProvider defaults to devnet.solana.com instead of mainnet-beta.solana.com
- useSeasonData accepts optional initialSeasonNumber parameter (default 1) eliminating hardcoded season
- Confirmed all transaction hooks use real .rpc() calls (no mocks, stubs, or TODOs)
- TypeScript compiles with zero errors across all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Make frontend constants env-driven and fix hardcoded defaults** - `aa85cc8` (feat)
2. **Task 2: Fix hardcoded season number in useSeasonData and verify full hook chain** - `dd37290` (feat)

## Files Created/Modified

- `app/src/lib/constants.ts` - ROUND_DURATION_SECONDS now reads from env var, BETTING_WINDOW_SECONDS derived
- `app/src/components/providers/WalletProvider.tsx` - Default RPC changed from mainnet to devnet
- `app/src/hooks/useSeasonData.ts` - Accepts initialSeasonNumber param, no hardcoded season 1 in body

## Decisions Made

- LOCKOUT_SECONDS stays hardcoded at 120 — protocol-level constant, not a deployment config
- PROGRAM_ID stays hardcoded — same deployed address on both devnet and mainnet per Anchor.toml
- useSeasonData takes initialSeasonNumber as a parameter (not from Zustand store) because the store starts at 0 and only gets written AFTER this hook runs — reading from store would create a circular initialization problem
- app/.env.local is gitignored, so it was modified locally but not committed; documented in plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — app/.env.local was already pre-populated with NEXT_PUBLIC_SOLANA_RPC_URL=devnet. Added NEXT_PUBLIC_ROUND_DURATION_SECONDS=1800 to it. File is gitignored so only the source code changes were committed.

## User Setup Required

None — no external service configuration required. The app/.env.local already has devnet RPC URL set.

## Next Phase Readiness

- Frontend hook chain is fully devnet-ready: WalletProvider -> useAnchorProgram -> usePlaceBet -> .rpc()
- Round timing is configurable via env var for fast devnet testing (change to 300 for 5-min rounds)
- All data hooks (useSeasonData, useHeliusSocket, useBetHistory, useColorPools) use real chain queries
- Ready for Phase 5 plan 03+ and subsequent deploy/prove phase

---
*Phase: 05-wire*
*Completed: 2026-03-18*
