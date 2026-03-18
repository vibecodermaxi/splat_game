---
phase: 02-oracle-service
plan: 01
subsystem: anchor-program
tags: [anchor, solana, rust, arweave, oracle, commit-reveal]

# Dependency graph
requires:
  - phase: 01-anchor-program
    provides: PixelState with arweave_txid/has_arweave_txid fields; oracle authorization pattern via has_one on ConfigAccount

provides:
  - set_arweave_txid instruction allowing oracle to write Arweave transaction IDs back on-chain after prompt uploads
  - Updated IDL (target/idl/pixel_predict.json) with set_arweave_txid instruction
  - 3 new passing tests covering success path, auth rejection, and status rejection
  - Redeployed program on devnet at FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG with set_arweave_txid live

affects: [02-oracle-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "instruction args for PDA seeds in Anchor 0.32 (same as lock_round) to avoid self-referential PDA validation failure"
    - "oracle authorization via has_one = oracle constraint on ConfigAccount"

key-files:
  created:
    - programs/pixel-predict/src/instructions/set_arweave_txid.rs
  modified:
    - programs/pixel-predict/src/instructions/mod.rs
    - programs/pixel-predict/src/lib.rs
    - tests/pixel-predict.ts

key-decisions:
  - "set_arweave_txid uses instruction args for PDA seeds (same as lock_round) to avoid Anchor 0.32 self-referential PDA validation failure"

patterns-established:
  - "Oracle-only instructions follow: ConfigAccount with has_one = oracle, oracle as Signer, instruction args for PDA derivation"

requirements-completed: [ORC-05]

# Metrics
duration: 15min
completed: 2026-03-17
---

# Phase 2 Plan 1: set_arweave_txid Instruction Summary

**Oracle write-back instruction for Arweave txids on resolved PixelState accounts, completing the commit-reveal chain with 46/46 tests passing**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-17T15:00:00Z
- **Completed:** 2026-03-17T15:17:30Z
- **Tasks:** 2/2 complete
- **Files modified:** 4

## Accomplishments
- Created `set_arweave_txid` instruction that oracle can call after Arweave upload
- Instruction validates pixel is in Resolved status and oracle is authorized (via has_one constraint)
- Anchor program rebuilt; IDL at `target/idl/pixel_predict.json` now includes set_arweave_txid
- All 46 tests pass: 43 existing regressions + 3 new set_arweave_txid tests
- Program redeployed to devnet at FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG — set_arweave_txid instruction live

## Task Commits

Each task was committed atomically:

1. **Test RED: set_arweave_txid failing tests** - `fcdc702` (test)
2. **Feat GREEN: implement set_arweave_txid instruction** - `234ded4` (feat)
3. **Checkpoint / devnet deployment** - `0d2e17f` (docs) — interim checkpoint commit; deployment performed by user

_TDD approach: failing tests committed first, then implementation. Task 2 was a human-verify checkpoint — user ran `anchor deploy --provider.cluster devnet`._

## Files Created/Modified
- `programs/pixel-predict/src/instructions/set_arweave_txid.rs` - New instruction: SetArweaveTxid accounts struct + handler
- `programs/pixel-predict/src/instructions/mod.rs` - Added `pub mod set_arweave_txid` and re-export
- `programs/pixel-predict/src/lib.rs` - Added `set_arweave_txid` function wiring to handler
- `tests/pixel-predict.ts` - 3 new tests in `describe("set_arweave_txid")` block

## Decisions Made
- Used instruction args for PDA seeds in `SetArweaveTxid` (same pattern as `lock_round`) — avoids Anchor 0.32 self-referential PDA validation failure where reading `pixel_state.season_number` before the PDA is validated causes a constraint error.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — build succeeded first attempt. Pattern from `lock_round.rs` applied directly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `set_arweave_txid` instruction is live on devnet and ready for the oracle service to call after Arweave uploads
- Oracle service (02-02+) can now use this instruction to close the commit-reveal loop: prompt hash at open -> prompt text on Arweave -> txid written on-chain
- No blockers for the next oracle-service plan

---
*Phase: 02-oracle-service*
*Completed: 2026-03-17*
