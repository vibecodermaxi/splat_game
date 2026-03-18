---
phase: 01-anchor-program
plan: 02
subsystem: blockchain
tags: [anchor, solana, rust, parimutuel-betting, pda, oracle, admin, litesvm, typescript]

# Dependency graph
requires:
  - phase: 01-anchor-program/01-01
    provides: Account structs (ConfigAccount, SeasonState, PixelState), PixelPredictError enum, stub instruction placeholders, LiteSVM test scaffold
provides:
  - initialize_config instruction: creates singleton Config PDA with admin + oracle pubkeys
  - start_season instruction: creates SeasonState PDA (admin-only via has_one constraint)
  - open_round instruction: creates PixelState PDA per pixel with oracle authorization and N+1 lookahead
  - SC-01 integration tests (3 passing): config init, season start, admin-only enforcement
  - SC-02 integration tests (5 passing): round open, oracle auth, coordinate derivation, N+1 pre-open, N+2 rejection
affects:
  - 01-03 (place_bet builds on PixelState Open status and SeasonState current_pixel_index)
  - 01-04 (resolve_round reads Config PDA oracle for authorization)
  - 01-05 (season completion uses SeasonState current_pixel_index and status)
  - phase-2-oracle (oracle service calls open_round with pixel_index + prompt_hash)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - open_round accepts pixel_index N or N+1 (FINAL approach from RESEARCH Option A)
    - Coordinates derived on-chain: x = pixel_index % grid_width, y = pixel_index / grid_width
    - has_one constraint on ConfigAccount enforces admin and oracle authorization
    - init PDA constraint with seeds ensures each account can only be created once (idempotency guard)

key-files:
  created:
    - programs/pixel-predict/src/instructions/initialize_config.rs
    - programs/pixel-predict/src/instructions/start_season.rs
    - programs/pixel-predict/src/instructions/open_round.rs
  modified:
    - programs/pixel-predict/src/instructions/mod.rs
    - programs/pixel-predict/src/lib.rs
    - tests/pixel-predict.ts

key-decisions:
  - "open_round accepts pixel_index N or N+1 (not CPI or separate instruction) — simplest approach for SC-17 future pixel betting"
  - "Coordinates derived on-chain in open_round handler (x = pixel_index % grid_width) — no coordinate fields needed in seeds"
  - "start_season trusts admin for sequential ordering (no previous season check) — v1 simplicity, avoids optional account complexity"

patterns-established:
  - "oracle authorization: has_one = oracle on ConfigAccount (not a separate signer check)"
  - "admin authorization: has_one = admin on ConfigAccount (same pattern as oracle)"

requirements-completed: [SC-01, SC-02, SC-17]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 1 Plan 02: Config, Season, and Round Opening Summary

**Admin/oracle authority chain with Config PDA, SeasonState initialization, and PixelState opening with N+1 lookahead for SC-17 future pixel betting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T22:27:17Z
- **Completed:** 2026-03-16T22:31:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- initialize_config creates singleton Config PDA with rotatable oracle keypair
- start_season creates SeasonState PDA with Active status, 10x10 grid, enforced admin-only via has_one
- open_round creates PixelState PDA with oracle authorization, sequential enforcement (current or current+1), and on-chain coordinate derivation
- Oracle can pre-open pixel N+1 to enable SC-17 future pixel betting before pixel N resolves
- All 9 tests pass (1 scaffold + 3 SC-01 + 5 SC-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement initialize_config and start_season** - `f2229ae` (feat)
2. **Task 2: Implement open_round with N+1 pre-opening** - `79822a5` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN), committed together per task_

## Files Created/Modified

- `programs/pixel-predict/src/instructions/initialize_config.rs` - InitializeConfig accounts struct + handler
- `programs/pixel-predict/src/instructions/start_season.rs` - StartSeason accounts struct + handler (admin has_one)
- `programs/pixel-predict/src/instructions/open_round.rs` - OpenRound accounts struct + handler (oracle has_one, N+1 lookahead)
- `programs/pixel-predict/src/instructions/mod.rs` - Exports real modules, removes placeholder structs for implemented instructions
- `programs/pixel-predict/src/lib.rs` - Wires real handlers into program entry points
- `tests/pixel-predict.ts` - SC-01 and SC-02 test suites (8 new tests)

## Decisions Made

- **open_round accepts pixel_index N or N+1:** The plan described three approaches (CPI, separate instruction, dual-call). The "FINAL approach" from the plan was chosen — allow `pixel_index >= current_pixel_index && pixel_index <= current_pixel_index + 1`. Oracle calls open_round twice per round: once for N (real prompt_hash), once for N+1 (zeroed/pre-committed hash). The PDA init constraint prevents double-opening the same pixel.
- **start_season trusts admin for sequential ordering:** Checking previous season completion would require an optional account with different seeds. V1 trusts the admin to call start_season sequentially. A comment in the code documents this limitation.
- **Coordinates derived on-chain:** x and y are computed in the handler from pixel_index and grid_width rather than being passed as arguments — prevents oracle from providing incorrect coordinates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `import * as anchor` to test file**
- **Found during:** Task 1 (RED phase test run)
- **Issue:** Test file used `anchor.web3.SystemProgram.programId` without importing anchor
- **Fix:** Added `import * as anchor from "@coral-xyz/anchor"` at top of tests/pixel-predict.ts
- **Files modified:** tests/pixel-predict.ts
- **Verification:** Tests compiled and ran correctly
- **Committed in:** f2229ae (Task 1 commit)

**2. [Rule 1 - Bug] Removed unused import warning in instructions/mod.rs**
- **Found during:** Task 1 (anchor build warning)
- **Issue:** `use crate::state::*` in mod.rs was unused after placeholder structs were replaced
- **Fix:** Removed the unused import
- **Files modified:** programs/pixel-predict/src/instructions/mod.rs
- **Verification:** Build passes with no warnings
- **Committed in:** f2229ae (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes required for compilation and clean tests. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- initialize_config, start_season, open_round all fully implemented with Anchor constraints
- Config PDA stores rotatable oracle key (ready for Plan 04+ oracle rotation)
- SeasonState tracks current_pixel_index (Plan 03 place_bet reads this to validate pixel is active)
- PixelState created with Open status (Plan 03 place_bet validates RoundStatus::Open)
- N+1 pre-opening pattern established (Plan 03 place_bet on future pixels enabled by SC-17)
- Ready for Plan 03: place_bet, lock_round instructions

---
*Phase: 01-anchor-program*
*Completed: 2026-03-17*

## Self-Check: PASSED

All required files verified:
- programs/pixel-predict/src/instructions/initialize_config.rs: FOUND
- programs/pixel-predict/src/instructions/start_season.rs: FOUND
- programs/pixel-predict/src/instructions/open_round.rs: FOUND
- .planning/phases/01-anchor-program/01-02-SUMMARY.md: FOUND

All task commits verified:
- f2229ae (Task 1: initialize_config + start_season): FOUND
- 79822a5 (Task 2: open_round): FOUND
