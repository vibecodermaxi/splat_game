---
phase: 05-wire
plan: 01
subsystem: infra
tags: [anchor, idl, oracle, env, config, cron, solana]

# Dependency graph
requires:
  - phase: 02-oracle
    provides: "Oracle service (oracle/src/) with chain.ts, config.ts, scheduler.ts, index.ts"
  - phase: 03-frontend
    provides: "Frontend (app/src/lib/) with idl.json placeholder"
provides:
  - "scripts/copy-idl.sh: automated IDL propagation from target/ to app and oracle"
  - "oracle/src/idl.json: local IDL copy for oracle (no fragile relative paths)"
  - ".env.example: single root reference for all env vars across all subsystems"
  - "OracleConfig.roundDurationMinutes + derived fields: configurable round timing"
  - "Dynamic cron schedule from ROUND_DURATION_MINUTES env var"
affects: [06-deploy, any phase that runs the oracle locally]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IDL distribution via copy script: anchor build + copy-idl.sh keeps all subsystems in sync"
    - "Config-derived timing: oracle computes all timing windows from a single ROUND_DURATION_MINUTES var"
    - "Cron expression derived from duration: roundDurationMinutes <= 30 uses /N notation, otherwise comma-separated"

key-files:
  created:
    - scripts/copy-idl.sh
    - .env.example
    - oracle/src/idl.json (gitignored build artifact)
  modified:
    - oracle/src/chain.ts
    - oracle/src/config.ts
    - oracle/src/scheduler.ts
    - oracle/src/index.ts
    - oracle/.env.example
    - scripts/devnet-setup.ts
    - oracle/src/__tests__/chain.test.ts
    - .gitignore

key-decisions:
  - "IDL loaded via static import (import idl from './idl.json') rather than runtime require — fails at compile time if missing, which is the correct behavior"
  - "oracle/src/idl.json gitignored as build artifact — must run scripts/copy-idl.sh after anchor build"
  - "ROUND_DURATION_MINUTES not added to required[] array — it has a safe default of 30"
  - "Cron formula: minutes <= 30 uses */N notation; above 30 uses 0,N (handles devnet 5-min and mainnet 30-min cases)"

patterns-established:
  - "Single source of truth for round timing: ROUND_DURATION_MINUTES -> OracleConfig fields -> scheduler + index"
  - "Root .env.example as canonical reference for all subsystem env vars"

requirements-completed: [INT-01, INT-02, DEP-03]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 5 Plan 1: IDL Copy Script and Env Config Summary

**IDL propagation via copy-idl.sh, oracle switching to local idl.json import, and ROUND_DURATION_MINUTES-driven configurable cron scheduling across all three subsystems**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T19:55:59Z
- **Completed:** 2026-03-18T19:59:40Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created scripts/copy-idl.sh that propagates a single IDL from target/ to both app/src/lib/ and oracle/src/ with error handling if anchor build hasn't been run
- Eliminated fragile `../../target/idl/pixel_predict.json` relative path in oracle/src/chain.ts — now uses a top-level `import idl from "./idl.json"` (compile-time safety)
- Added roundDurationMinutes, bettingWindowMinutes, lockWindowMinutes, and cronSchedule fields to OracleConfig — oracle timing is now fully driven by ROUND_DURATION_MINUTES env var (default: 30)
- Created root .env.example documenting all env vars for frontend and oracle subsystems in one place
- Updated oracle/.env.example and devnet-setup.ts to use the local IDL copy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IDL copy script and switch oracle to local IDL** - `16e529d` (feat)
2. **Task 2: Centralize env var config with configurable round timing** - `c6465c6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `scripts/copy-idl.sh` - Bash script to copy IDL from target/ to app and oracle destinations
- `oracle/src/chain.ts` - Removed path import and runtime require; now uses static JSON import
- `oracle/src/config.ts` - Added roundDurationMinutes/bettingWindowMinutes/lockWindowMinutes/cronSchedule to OracleConfig and loadConfig()
- `oracle/src/scheduler.ts` - Reads cron schedule from ctx.config.cronSchedule (not hardcoded)
- `oracle/src/index.ts` - Timing windows computed from config fields inside main()
- `.env.example` - New root env var reference for all subsystems
- `oracle/.env.example` - Added ROUND_DURATION_MINUTES field
- `scripts/devnet-setup.ts` - Loads IDL from oracle/src/idl.json (local copy)
- `oracle/src/__tests__/chain.test.ts` - Updated IDL path test to use local oracle copy
- `.gitignore` - Added oracle/src/idl.json as gitignored build artifact

## Decisions Made
- Used static `import idl from "./idl.json"` instead of `require()` at runtime: fails at compile time if the IDL is missing, which is the desired behavior for a required build artifact
- oracle/src/idl.json is gitignored — running scripts/copy-idl.sh after anchor build is the required workflow step
- ROUND_DURATION_MINUTES not in the `required[]` array since it has a safe default (30 minutes)
- Cron formula: durations <= 30 use `*/N * * * *`; above 30 use `0,N * * * *` (covers devnet 5-min and mainnet 30-min use cases)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated chain.test.ts IDL path to use local oracle copy**
- **Found during:** Task 1 (final verification)
- **Issue:** Test file `oracle/src/__tests__/chain.test.ts` still referenced `../../../target/idl/pixel_predict.json` — would mislead future developers that the IDL should be loaded from target/
- **Fix:** Updated test IDL path to `../idl.json` (relative to `__tests__/`, pointing to `oracle/src/idl.json`), updated comment
- **Files modified:** oracle/src/__tests__/chain.test.ts
- **Verification:** TypeScript compiles cleanly; test logic unchanged
- **Committed in:** 16e529d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 consistency/correctness fix)
**Impact on plan:** Necessary to keep test aligned with the IDL loading strategy change. No scope creep.

## Issues Encountered
- JSDoc comment in scheduler.ts used `*/30 * * * *` which caused the `*/` sequence to terminate the block comment, resulting in TypeScript parse errors. Fixed by rewriting the example out of the docblock.

## User Setup Required
None — no external service configuration required. Users run `scripts/copy-idl.sh` after `anchor build` to populate the IDL copies.

## Next Phase Readiness
- IDL distribution is automated — anchor build + copy-idl.sh is the full workflow
- Round timing is configurable for devnet (ROUND_DURATION_MINUTES=5) and mainnet (ROUND_DURATION_MINUTES=30)
- Root .env.example serves as the reference for configuring all subsystems
- Ready for Phase 5 Plan 2 (oracle-to-chain wiring)

## Self-Check: PASSED

- scripts/copy-idl.sh: FOUND
- .env.example: FOUND
- oracle/src/idl.json: FOUND
- 05-01-SUMMARY.md: FOUND
- Commit 16e529d: FOUND
- Commit c6465c6: FOUND

---
*Phase: 05-wire*
*Completed: 2026-03-18*
