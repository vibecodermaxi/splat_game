---
phase: 01-anchor-program
plan: 01
subsystem: blockchain
tags: [anchor, solana, rust, litesvm, typescript, mocha, parimutuel-betting]

# Dependency graph
requires: []
provides:
  - Anchor 0.32.1 workspace with pixel-predict program skeleton
  - SeasonState, PixelState, BetAccount, PlayerSeasonStats, ConfigAccount structs
  - SeasonStatus and RoundStatus enums with repr(u8)
  - Program constants: MIN_BET, MAX_BET_PER_COLOR, NUM_COLORS, RAKE_BPS, TREASURY_BPS, JACKPOT_BPS, BETTING_WINDOW_SECONDS, ROUND_DURATION_SECONDS
  - PixelPredictError enum with 23 error codes covering all failure modes
  - Stub instruction handlers for all 9 instructions (initialize_config, start_season, open_round, place_bet, lock_round, resolve_round, resolve_round_vrf, claim_winnings, update_oracle)
  - IDL at target/idl/pixel_predict.json with all account types and instruction signatures
  - LiteSVM TypeScript test scaffold with PDA helpers, time helpers, and passing smoke test
affects:
  - 01-02 (implement_config_season instructions consume stub account structs and IDL)
  - 01-03 (betting instructions build on PixelState/BetAccount/PlayerSeasonStats)
  - 01-04 (resolve/claim build on error enum and rake constants)
  - 01-05 (VRF fallback and season completion use VRF error codes)
  - phase-2-oracle (consumes IDL for CPI calls)
  - phase-3-frontend (consumes IDL types for wallet interactions)

# Tech tracking
tech-stack:
  added:
    - anchor-lang 0.32.1 with init-if-needed feature
    - litesvm 0.3.3 (LiteSVM Rust-native Solana test environment)
    - anchor-litesvm 0.2.1 (LiteSVMProvider for Anchor compatibility)
    - ts-mocha 11.x (Node 22 compatible test runner)
    - typescript 5.7.3 with strict mode and es2022 target
  patterns:
    - All account structs derive #[account] and InitSpace
    - Enums derive InitSpace with repr(u8) for 1-byte storage
    - PDA seeds use little-endian u16 byte arrays (to_le_bytes())
    - Treasury and jackpot wallets hardcoded as program constants (not admin-redirectable)
    - overflow-checks = true, lto = fat, codegen-units = 1 in release profile

key-files:
  created:
    - programs/pixel-predict/src/lib.rs
    - programs/pixel-predict/src/state/mod.rs
    - programs/pixel-predict/src/state/config_account.rs
    - programs/pixel-predict/src/state/season_state.rs
    - programs/pixel-predict/src/state/pixel_state.rs
    - programs/pixel-predict/src/state/bet_account.rs
    - programs/pixel-predict/src/state/player_season_stats.rs
    - programs/pixel-predict/src/constants.rs
    - programs/pixel-predict/src/errors.rs
    - programs/pixel-predict/src/instructions/mod.rs
    - tests/helpers.ts
    - tests/pixel-predict.ts
  modified:
    - Anchor.toml
    - Cargo.toml
    - programs/pixel-predict/Cargo.toml
    - package.json
    - tsconfig.json

key-decisions:
  - "anchor_lang::pubkey!() macro (not solana_program::pubkey!) for Anchor 0.32 const Pubkeys"
  - "arweave_txid stored as [u8; 43] + has_arweave_txid: bool because InitSpace does not support Option<[u8; 43]>"
  - "correct_predictions tracked at claim time (not resolve time) to avoid unbounded compute at resolution"
  - "LiteSVM Clock requires NAPI class constructor (not plain object) for setClock()"
  - "ts-mocha 11.x required for Node 22 compatibility (10.x has broken bin path resolution)"

patterns-established:
  - "PDA seeds: u16 values encoded as Buffer.alloc(2).writeUInt16LE() in TypeScript tests"
  - "Test setup: fromWorkspace('./') loads .so files from target/deploy via Anchor.toml"
  - "All account space calculated via InitSpace derive macro (not manual SPACE constants)"

requirements-completed: [SC-01, SC-02, SC-03, SC-05, SC-06, SC-12, SC-16]

# Metrics
duration: 13min
completed: 2026-03-17
---

# Phase 1 Plan 01: Anchor Workspace Initialization Summary

**Anchor 0.32.1 workspace with all 5 parimutuel betting account structs, 23 error codes, 9 instruction stubs, compiled IDL, and passing LiteSVM test scaffold**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-16T22:09:56Z
- **Completed:** 2026-03-16T22:23:20Z
- **Tasks:** 4
- **Files modified:** 19

## Accomplishments

- Anchor workspace builds cleanly with overflow-checks, LTO, and init-if-needed
- All 5 account structs defined with correct field types, InitSpace derive, and PDA seed documentation
- Complete error enum with 23 codes covering all instruction failure modes including VRF-specific errors
- IDL generated at target/idl/pixel_predict.json with all 9 instruction signatures and account types
- LiteSVM test scaffold boots with smoke test passing: program loaded, PDA helpers verified, time advancement works

## Task Commits

1. **Task 1: Scaffold Anchor workspace and configure build** - `77782cc` (chore)
2. **Task 2: Define all account state structs and enums** - `79273f9` (feat)
3. **Task 3: Define constants, errors, lib.rs wiring, and instruction placeholders** - `7711b91` (feat)
4. **Task 4: Set up LiteSVM test scaffold with helpers and fixtures** - `5464e2c` (feat)

## Files Created/Modified

- `programs/pixel-predict/src/state/config_account.rs` - ConfigAccount PDA (admin + oracle pubkeys)
- `programs/pixel-predict/src/state/season_state.rs` - SeasonState PDA with volume/bet/wallet tracking
- `programs/pixel-predict/src/state/pixel_state.rs` - PixelState PDA with color_pools[16], prompt_hash, arweave_txid
- `programs/pixel-predict/src/state/bet_account.rs` - BetAccount PDA per (player, pixel)
- `programs/pixel-predict/src/state/player_season_stats.rs` - PlayerSeasonStats PDA with colors_bet[16]
- `programs/pixel-predict/src/state/mod.rs` - SeasonStatus + RoundStatus enums, all re-exports
- `programs/pixel-predict/src/constants.rs` - All 10 program constants including hardcoded wallet addresses
- `programs/pixel-predict/src/errors.rs` - PixelPredictError with 23 error codes
- `programs/pixel-predict/src/instructions/mod.rs` - Placeholder Accounts structs for all 9 instructions
- `programs/pixel-predict/src/lib.rs` - Module declarations + 9 stub instruction handlers
- `tests/helpers.ts` - setupTestEnvironment, 5 PDA helpers, advanceTime, constants
- `tests/pixel-predict.ts` - SC-SCAFFOLD smoke test + 17 skipped SC describe blocks
- `Anchor.toml` - Updated test script to npx ts-mocha
- `Cargo.toml` - overflow-checks, LTO, codegen-units in release profile
- `programs/pixel-predict/Cargo.toml` - anchor-lang 0.32.1 with init-if-needed feature
- `package.json` - Added litesvm, anchor-litesvm, ts-mocha 11.x
- `tsconfig.json` - strict mode, es2022 target, moduleResolution node

## Decisions Made

- Used `anchor_lang::pubkey!()` instead of `solana_program::pubkey!()` for const Pubkey declarations — the latter macro path was removed in newer anchor-lang versions
- `arweave_txid` stored as `[u8; 43]` + `has_arweave_txid: bool` rather than `Option<[u8; 43]>` because InitSpace cannot calculate space for Option<array> types
- Upgraded ts-mocha to 11.x (from 10.x) — ts-mocha 10.x has a broken bin path resolution on Node 22 that produces `Cannot find module '.../node_modules/src/index.js'`
- `advanceTime()` uses `new Clock(slot, epochStartTimestamp, epoch, leaderScheduleEpoch, unixTimestamp)` constructor — litesvm's `setClock()` requires the NAPI Clock class instance, not a plain object

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pubkey! macro path for anchor-lang 0.32**
- **Found during:** Task 3 (constants.rs compilation)
- **Issue:** `anchor_lang::solana_program::pubkey!()` path no longer exists in anchor-lang 0.32; macro moved to `anchor_lang::pubkey!()`
- **Fix:** Changed both TREASURY_WALLET and JACKPOT_WALLET constant declarations to use `anchor_lang::pubkey!()`
- **Files modified:** programs/pixel-predict/src/constants.rs
- **Verification:** anchor build succeeds after fix
- **Committed in:** 7711b91 (Task 3 commit)

**2. [Rule 1 - Bug] Fixed unused import in instructions/mod.rs**
- **Found during:** Task 3 (anchor build warning)
- **Issue:** `use crate::state::*;` was unused because placeholder structs don't reference state types yet
- **Fix:** Removed unused import
- **Files modified:** programs/pixel-predict/src/instructions/mod.rs
- **Verification:** Build passes with no warnings
- **Committed in:** 7711b91 (Task 3 commit)

**3. [Rule 1 - Bug] Fixed LiteSVM setClock() NAPI type mismatch**
- **Found during:** Task 4 (smoke test failure)
- **Issue:** `advanceTime()` passed a plain JS object to `svm.setClock()` but litesvm requires the native NAPI Clock class instance
- **Fix:** Imported `Clock` class from litesvm and used constructor: `new Clock(slot, epochStartTimestamp, epoch, leaderScheduleEpoch, unixTimestamp)`
- **Files modified:** tests/helpers.ts
- **Verification:** SC-SCAFFOLD smoke test passes
- **Committed in:** 5464e2c (Task 4 commit)

**4. [Rule 3 - Blocking] Upgraded ts-mocha from 10.x to 11.x for Node 22 compatibility**
- **Found during:** Task 4 (test execution failure)
- **Issue:** ts-mocha 10.x resolves its own path using `path.join(__dirname, "../src/index.js")` which produces an incorrect absolute path on Node 22, causing `Cannot find module`.
- **Fix:** Upgraded ts-mocha to 11.x which handles the require path correctly
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts` passes with 1 passing test
- **Committed in:** 5464e2c (Task 4 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking issues)
**Impact on plan:** All auto-fixes necessary for compilation and test execution. No scope creep.

## Issues Encountered

- anchor-litesvm@0.5.0 does not exist on npm (latest is 0.2.1). Used 0.2.1 which requires litesvm ^0.3.3. Plan spec version was incorrect.
- ts-mocha 10.x had Node 22 compatibility issue requiring upgrade to 11.x.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Anchor workspace compiles cleanly: `anchor build` succeeds
- IDL generated with all 9 instruction signatures and 5 account types needed by Plans 02-05
- LiteSVM test scaffold boots: smoke test passes
- PDA seed patterns established (u16 as 2-byte LE) for all subsequent test plans
- Ready for Plan 02: initialize_config, start_season, open_round, update_oracle instructions

---
*Phase: 01-anchor-program*
*Completed: 2026-03-17*

## Self-Check: PASSED

All required files verified:
- programs/pixel-predict/src/state/season_state.rs: FOUND
- programs/pixel-predict/src/state/pixel_state.rs: FOUND
- programs/pixel-predict/src/constants.rs: FOUND
- programs/pixel-predict/src/errors.rs: FOUND
- tests/pixel-predict.ts: FOUND
- tests/helpers.ts: FOUND
- target/idl/pixel_predict.json: FOUND

All task commits verified:
- 77782cc (Task 1 scaffold): FOUND
- 79273f9 (Task 2 state structs): FOUND
- 7711b91 (Task 3 constants/errors/lib.rs): FOUND
- 5464e2c (Task 4 test scaffold): FOUND
