---
phase: 01-anchor-program
plan: 06
subsystem: infra
tags: [anchor, solana, devnet, deployment, keypair]

# Dependency graph
requires:
  - phase: 01-anchor-program plan 05
    provides: Fully tested Anchor program with VRF, E2E tests, all 43 passing

provides:
  - Real devnet treasury and jackpot wallet keypairs in keys/ directory
  - constants.rs with real Solana pubkeys replacing system program placeholders
  - Anchor.toml with [programs.devnet] section
  - pixel-predict program deployed to Solana devnet at FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG

affects:
  - 02-oracle-service (must use this program ID when sending transactions to devnet)
  - 03-frontend-core (IDL and program ID for wallet/transaction integration)

# Tech tracking
tech-stack:
  added: [solana-keygen CLI for keypair generation]
  patterns:
    - Operator-controlled keypairs stored in keys/ (gitignored) for treasury and jackpot custody
    - provider.cluster kept as localnet in Anchor.toml; deployment uses --provider.cluster devnet flag at deploy time
    - Separate [programs.localnet] and [programs.devnet] sections in Anchor.toml for environment isolation

key-files:
  created:
    - keys/treasury-wallet.json (gitignored — devnet treasury keypair)
    - keys/jackpot-wallet.json (gitignored — devnet jackpot keypair)
  modified:
    - programs/pixel-predict/src/constants.rs (real treasury/jackpot pubkeys replacing system program placeholders)
    - Anchor.toml (added [programs.devnet] section)
    - tests/pixel-predict.ts (updated wallet addresses to match new constants.rs values)
    - .gitignore (added keys/ directory exclusion)

key-decisions:
  - "keys/ directory gitignored to prevent keypair secrets from being committed; operator must back up keys/ manually"
  - "Anchor.toml [provider] cluster left as localnet; deployment uses --provider.cluster devnet flag (not permanent cluster change) to avoid breaking local dev workflow"
  - "Treasury and jackpot constants updated to real devnet addresses — required for on-chain lamport transfers to succeed on devnet"

patterns-established:
  - "Devnet keypairs stored in project keys/ dir, gitignored, backed up out-of-band by operator"

requirements-completed: [SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09, SC-10, SC-11, SC-12, SC-13, SC-14, SC-15, SC-16, SC-17]

# Metrics
duration: ~30min
completed: 2026-03-17
---

# Phase 01 Plan 06: Deploy to Devnet Summary

**pixel-predict Anchor program deployed to Solana devnet at FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG with real operator-controlled treasury and jackpot wallet keypairs replacing system program placeholders**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-17T12:43:00Z (estimated)
- **Completed:** 2026-03-17T18:30:00Z (estimated)
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- Generated real Solana devnet keypairs for treasury and jackpot wallets; stored in keys/ directory (gitignored)
- Replaced system program placeholder pubkeys (11111...12 and 11111...13) in constants.rs with real devnet addresses
- Added [programs.devnet] section to Anchor.toml; all 43 tests pass after wallet address updates
- User deployed pixel-predict to Solana devnet — program live at FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate treasury/jackpot wallets, update constants and Anchor.toml for devnet** - `363c76e` (feat)
2. **Task 2: Deploy to devnet and smoke test** - performed by user at checkpoint; no additional code changes

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `programs/pixel-predict/src/constants.rs` - Replaced system program placeholder pubkeys with real devnet treasury and jackpot addresses
- `Anchor.toml` - Added [programs.devnet] section with program ID FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG
- `tests/pixel-predict.ts` - Updated hardcoded wallet addresses to match new constants.rs values (prevents test mismatch)
- `.gitignore` - Added keys/ directory exclusion to prevent keypair secret exposure
- `keys/treasury-wallet.json` - Devnet treasury wallet keypair (gitignored, operator-managed)
- `keys/jackpot-wallet.json` - Devnet jackpot wallet keypair (gitignored, operator-managed)

## Decisions Made

- keys/ directory gitignored to prevent keypair secrets from being committed — operator must back these up out-of-band before any machine wipe
- Anchor.toml [provider] cluster intentionally left as localnet; deployment uses the --provider.cluster devnet CLI flag so local development workflow is unchanged
- Treasury and jackpot addresses updated before deployment so the deployed program references real accounts that can receive lamport transfers

## Deviations from Plan

None - plan executed exactly as written. Task 1 completed automatically by Claude; Task 2 was a checkpoint that the user resolved by deploying to devnet.

## Issues Encountered

None — anchor build and all 43 anchor test --skip-deploy tests passed cleanly after wallet address updates.

## User Setup Required

None — keypairs were generated and stored in keys/ directory. Operator should back up keys/treasury-wallet.json and keys/jackpot-wallet.json to a secure location separate from this repository.

## Next Phase Readiness

- Phase 1 (Anchor Program) is fully complete: program designed, implemented, tested (43 tests), and deployed to Solana devnet
- Phase 2 (Oracle Service) can begin: the devnet program ID (FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG) and IDL are available for the keeper to use
- No blockers for Phase 2 kickoff

---
*Phase: 01-anchor-program*
*Completed: 2026-03-17*
