---
phase: 01-anchor-program
plan: 03
subsystem: blockchain
tags: [anchor, solana, rust, parimutuel-betting, pda, litesvm, typescript, place-bet, lock-round]

# Dependency graph
requires:
  - phase: 01-anchor-program/01-02
    provides: PixelState (Open status), SeasonState (Active status), ConfigAccount, N+1 pre-open pattern
provides:
  - place_bet instruction: SOL custody in PixelState PDA, BetAccount creation, PlayerSeasonStats init
  - lock_round instruction: permissionless time-gated crank for Open -> Locked transition
  - SC-03 integration tests: initial bet placement, SOL transfer, pool updates, stats
  - SC-04 integration tests: bet increase on same color
  - SC-05 integration tests: color mismatch rejection
  - SC-06 integration tests: min/max bet enforcement
  - SC-07 integration tests: lock_round before/after window, permissionless, double-lock
  - SC-17 integration tests: future pixel betting on pre-opened N+1 pixel
affects:
  - 01-04 (resolve_round reads total_pool and color_pools from PixelState, reads Locked status)
  - 01-05 (claim_winnings reads BetAccount, PlayerSeasonStats; checks Resolved status)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct lamport manipulation for system_program::transfer to program-owned PDAs"
    - "init_if_needed: player == Pubkey::default() as 'is new bet' guard (avoids claimed constraint on accounts struct)"
    - "lock_round accepts season_number + pixel_index as instruction args (avoids self-referential PDA seeds)"
    - "advanceTime() calls svm.expireBlockhash() to prevent AlreadyProcessed on retry after time advance"
    - "TDD: tests with different amounts to avoid duplicate transaction bytes in LiteSVM"

key-files:
  created:
    - programs/pixel-predict/src/instructions/place_bet.rs
    - programs/pixel-predict/src/instructions/lock_round.rs
  modified:
    - programs/pixel-predict/src/instructions/mod.rs
    - programs/pixel-predict/src/lib.rs
    - tests/pixel-predict.ts
    - tests/helpers.ts

key-decisions:
  - "lock_round takes season_number and pixel_index as instruction args rather than self-referential seeds — avoids Anchor 0.32 PDA seed validation failure on self-referential accounts"
  - "Direct lamport manipulation (try_borrow_mut_lamports) not needed — system_program::transfer correctly transfers player (system-owned) to pixel_state (program-owned) via CPI"
  - "init_if_needed constraint removed from accounts struct, moved to handler — avoids potential constraint ordering issues; re-init guard checks bet_account.claimed in handler"
  - "advanceTime helper expires blockhash on every call — prevents AlreadyProcessed when same instruction bytes submitted after time advance (LiteSVM caches transaction signatures)"

requirements-completed: [SC-03, SC-04, SC-05, SC-06, SC-07, SC-17]

# Metrics
duration: 18min
completed: 2026-03-17
---

# Phase 1 Plan 03: Place Bet and Lock Round Summary

**Player betting path with all constraints enforced: color commitment, min/max limits, 28-minute lockout, bet increase; plus permissionless time-gated lock_round crank**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-16T22:33:40Z
- **Completed:** 2026-03-16T22:51:40Z
- **Tasks:** 2 (executed together due to shared TDD fixes)
- **Files modified:** 6

## Accomplishments

- `place_bet` instruction implements the full player betting path:
  - Creates `BetAccount` (init_if_needed) with color, amount, player pubkey
  - Creates `PlayerSeasonStats` (init_if_needed) on first-ever season bet
  - Enforces: color validation (0-15), MIN_BET (0.01 SOL), MAX_BET_PER_COLOR (10 SOL cumulative), 28-minute lockout window, one-color-per-pixel enforcement
  - SOL transferred from player to PixelState PDA via system_program CPI
  - Updates color_pools, total_pool, PlayerSeasonStats, SeasonState aggregates
  - Increments unique_wallets on first bet per player per season
- `lock_round` instruction implements permissionless time-gated crank:
  - Anyone can call with any account as fee payer (no authorization required)
  - Validates `clock.unix_timestamp >= opened_at + 1680` (28 minutes)
  - Transitions PixelState.status: Open → Locked, sets locked_at timestamp
- All 20 tests pass (9 existing SC-01/SC-02 + 11 new SC-03/04/05/06/17/07)

## Task Commits

Both tasks committed atomically (place_bet and lock_round built together due to shared TDD debugging):

1. **Tasks 1+2: place_bet + lock_round** - `d6ede46` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN), committed together per task_

## Files Created/Modified

- `programs/pixel-predict/src/instructions/place_bet.rs` - PlaceBet accounts struct + handler with all constraints
- `programs/pixel-predict/src/instructions/lock_round.rs` - LockRound accounts struct + permissionless handler
- `programs/pixel-predict/src/instructions/mod.rs` - Added place_bet and lock_round modules, removed PlaceBet/LockRound placeholder structs
- `programs/pixel-predict/src/lib.rs` - Wired real place_bet and lock_round handlers into program entry points
- `tests/pixel-predict.ts` - Added SC-03, SC-04, SC-05, SC-06, SC-17, SC-07 test suites (11 new tests)
- `tests/helpers.ts` - advanceTime now calls svm.expireBlockhash() to prevent duplicate transaction issues

## Decisions Made

- **lock_round instruction args for seeds:** Self-referential seeds in Anchor 0.32 (where seed values come from the same account being validated) cause PDA derivation failure. Using instruction args `season_number: u16` and `pixel_index: u16` avoids this and follows the pattern established in `open_round`.

- **init_if_needed constraint removed from accounts struct:** Moved `!bet_account.claimed` check to the handler body. This avoids potential constraint evaluation ordering issues with `init_if_needed` in Anchor 0.32 and makes the re-init guard explicit and auditable.

- **advanceTime expires blockhash:** LiteSVM tracks submitted transaction signatures. When the same instruction is called twice (e.g., lock_round BEFORE and AFTER time advance), the transaction bytes are identical → same signature → `AlreadyProcessed` (error code 6). Calling `svm.expireBlockhash()` after `setClock()` rotates the blockhash, ensuring different transaction signatures.

- **SC-04 test uses 60M lamports (not 50M):** The initial bet is 50M lamports. If the increase test also used 50M, the transaction would be byte-identical to the first bet → `AlreadyProcessed` in LiteSVM. Using 60M produces different bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lock_round used self-referential seeds causing PDA validation failure**
- **Found during:** Task 2 (GREEN phase, SC-07-LOCK test)
- **Issue:** `seeds = [b"pixel", pixel_state.season_number..., pixel_state.pixel_index...]` in LockRound accounts causes Anchor 0.32 PDA validation failure (error code 6 = IncorrectProgramId in LiteSVM)
- **Fix:** Changed to `#[instruction(season_number: u16, pixel_index: u16)]` with instruction args in seeds; updated lock_round handler signature and lib.rs entry point; updated tests to pass `lockRound(season, pixel)` args
- **Files modified:** lock_round.rs, lib.rs, tests/pixel-predict.ts
- **Committed in:** d6ede46

**2. [Rule 1 - Bug] LiteSVM AlreadyProcessed for identical transactions after time advance**
- **Found during:** Task 2 (SC-07-LOCK, SC-07-EARLY → SC-07-LOCK retry)
- **Issue:** LiteSVM caches all submitted transaction signatures (success AND failure). After SC-07-EARLY fails with LockoutNotReached, SC-07-LOCK submits an identical transaction → same signature → `AlreadyProcessed` (code 6 = empty logs)
- **Fix:** Added `svm.expireBlockhash()` call inside `advanceTime()` helper to rotate the blockhash on every time advance
- **Files modified:** tests/helpers.ts
- **Committed in:** d6ede46

**3. [Rule 1 - Bug] SC-04 increase bet used duplicate amount causing AlreadyProcessed**
- **Found during:** Task 1 (SC-04-INCREASE test)
- **Issue:** SC-03 bets 50M lamports and SC-04 also bets 50M → identical transaction bytes → same signature → `AlreadyProcessed`
- **Fix:** Changed SC-04 to use 60M lamports (still a valid increase within 10 SOL max)
- **Files modified:** tests/pixel-predict.ts
- **Committed in:** d6ede46

**4. [Rule 2 - Missing] lock_round needs explicit fee payer (Signer)**
- **Found during:** Task 2 (SC-07 tests)
- **Issue:** LockRound accounts struct had no Signer account. Solana transactions require a fee payer that signs the transaction. Tests passing `.signers([env.player1])` failed with "unknown signer" error since player1 wasn't in the accounts.
- **Fix:** Added `caller: Signer<'info>` with `mut` to LockRound accounts struct. This enables permissionless pattern (any signer pays the fee) while maintaining testability.
- **Files modified:** lock_round.rs, tests/pixel-predict.ts
- **Committed in:** d6ede46

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing functionality)

## Issues Encountered

- LiteSVM's `AlreadyProcessed` behavior differs from mainnet: it caches FAILED transaction signatures as well as successful ones. This required the `expireBlockhash()` fix in `advanceTime`.
- Self-referential PDA seeds in Anchor 0.32 silently fail with `IncorrectProgramId` (no program logs). Using instruction arguments for seeds is the safe pattern.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- place_bet custodies SOL in PixelState PDA (ready for Plan 04 resolve_round payout distribution)
- lock_round transitions PixelState to Locked status (Plan 04 resolve_round requires Locked status)
- BetAccount stores player, color, amount (Plan 04 claim_winnings validates and pays out)
- PlayerSeasonStats tracks total_bets, total_volume, colors_bet (Plan 04 claim increments correct_predictions)
- SeasonState.unique_wallets and aggregate stats updated (Plan 05 season completion reads these)
- Ready for Plan 04: resolve_round, claim_winnings instructions

---
*Phase: 01-anchor-program*
*Completed: 2026-03-17*
