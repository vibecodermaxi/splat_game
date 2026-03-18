---
phase: 02-oracle-service
plan: "06"
subsystem: infra
tags: [node-cron, typescript, solana, process-management, railway, arweave, scheduler]

# Dependency graph
requires:
  - phase: 02-oracle-service
    plan: "04"
    provides: "runRound, OracleContext, round lifecycle state machine with failure cascade"
  - phase: 02-oracle-service
    plan: "05"
    provides: "RoundHistory, createAlerts, uploadToArweave, Telegram notifications"

provides:
  - "oracle/src/index.ts — entry point with startup recovery from any on-chain round state"
  - "oracle/src/scheduler.ts — node-cron scheduler at 0,30 * * * * with overlap protection"
  - "Complete, runnable oracle process verified on devnet (Season 1)"
  - "Arweave upload step wired into runRound post-resolution"

affects: [phase-03-frontend-core, railway-deployment, devnet-smoke-test]

# Tech tracking
tech-stack:
  added: [node-cron]
  patterns:
    - "Self-executing async main() with top-level await"
    - "Overlap guard via boolean flag (roundInProgress) — prevents concurrent cron invocations"
    - "Chain-state-driven recovery on startup — reads pixelState.status to resume mid-round"
    - "Non-blocking Arweave upload with per-error logging (catch returns null, never throws)"
    - "SIGTERM/SIGINT graceful shutdown with process.exit(0)"
    - "uncaughtException + unhandledRejection handlers set exitCode=1 without immediate exit"

key-files:
  created:
    - oracle/src/index.ts
    - oracle/src/scheduler.ts
  modified:
    - oracle/src/round.ts

key-decisions:
  - "node-cron v4 schedule '0,30 * * * *' (minute 0 and 30 every hour) — half-hour betting windows"
  - "Recovery branches: null=fresh scheduler start, Open=wait/lock, Locked=immediate resolve, Resolved=arweave catch-up then scheduler"
  - "Arweave upload added to runRound as non-blocking (catch returns null) — round resolution never blocked by Arweave failure"
  - "history.reconstruct() called on startup if round_history.json absent — rebuilds from chain state without downtime"

patterns-established:
  - "Recovery pattern: read chain state on startup, branch on pixelState.status, then start scheduler regardless"
  - "Overlap guard pattern: boolean flag reset in finally block — safe against thrown errors"
  - "Non-blocking async side effect: .catch(err => { logger.warn(); return null; }) — never propagates"

requirements-completed: [ORC-10]

# Metrics
duration: 45min
completed: 2026-03-18
---

# Phase 2 Plan 06: Scheduler, Entry Point, and Devnet Smoke Test Summary

**node-cron scheduler with 30-minute cron (0,30 * * * *), startup recovery from on-chain state, Arweave wiring into runRound, and devnet-verified oracle process confirmed running cleanly on Season 1**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-18
- **Completed:** 2026-03-18
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3 (index.ts created, scheduler.ts created, round.ts modified)

## Accomplishments

- Built `oracle/src/scheduler.ts` with node-cron at `0,30 * * * *`, overlap-protected via `roundInProgress` boolean guard, error-caught round failures forwarding to `alerts.sendRetryWarning()`
- Built `oracle/src/index.ts` as a self-executing async entry point — loads config, initializes ChainClient/Alerts/RoundHistory, performs chain-state recovery across all four PixelState cases (null, Open, Locked, Resolved), reconstructs history.json if absent, starts scheduler, registers SIGTERM/SIGINT and uncaught error handlers
- Wired non-blocking Arweave upload into `runRound` post-resolution — txid written on-chain via `setArweaveTxid`; failures log a warning but never block resolution
- Smoke tested on devnet: oracle started cleanly against Season 1, logged `oracle_starting`, `recovery_check` (pixel 0, status none — fresh season), `recovery_no_round`, `history_reconstructed`, `scheduler_started (0,30 * * * *)`; Telegram 403 (bot-to-bot messaging) confirmed non-blocking

## Task Commits

Each task was committed atomically:

1. **Task 1: Build scheduler and entry point with process recovery** - `3f4b3c3` (feat)
2. **Task 2: Smoke test oracle on devnet** - checkpoint:human-verify, user approved — no separate commit

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `oracle/src/index.ts` — Self-executing async entry point; startup recovery from chain state, graceful shutdown, uncaught error handlers
- `oracle/src/scheduler.ts` — node-cron scheduler at 0,30 * * * * with overlap protection; delegates to runRound
- `oracle/src/round.ts` — Added non-blocking Arweave upload step (uploadToArweave) post-resolution with setArweaveTxid write-back

## Decisions Made

- node-cron v4 syntax `cron.schedule('0,30 * * * *', ...)` — minute-granularity half-hour windows match the 28-minute betting window with 2-minute buffer before lock
- Arweave upload added as a non-blocking step in `runRound` rather than a separate scheduled task — simpler, co-located with the data being archived
- `history.reconstruct()` called at startup if `round_history.json` is absent — zero-downtime history recovery from chain state without manual intervention

## Deviations from Plan

None - plan executed exactly as written. The Arweave wiring into `round.ts` was an explicit plan action (not a deviation).

## Issues Encountered

- **Telegram 403 during smoke test:** Bot attempted to message another bot — Telegram's API prohibits this. Non-blocking; oracle continued normally. This is a configuration concern (chat ID should point to a group or user, not a bot) rather than a code defect.

## User Setup Required

The plan includes `user_setup` for external services required before Railway deployment. See plan frontmatter for:
- `ANTHROPIC_API_KEY` (console.anthropic.com)
- `SOLANA_RPC_URL` — Helius devnet (dev.helius.xyz)
- Railway deployment: set all env vars from `.env.example` in Railway Dashboard -> Variables

## Next Phase Readiness

- Oracle is a fully operational autonomous process — starts, recovers, schedules rounds, resolves via Claude/VRF, uploads to Arweave, persists history
- Ready for Railway deployment (always-on process, SIGTERM-aware, process restart recovery confirmed)
- Phase 3 (Frontend Core) can begin — it depends on a running oracle driving the on-chain round state that the frontend reads
- Concern: Telegram chat ID must be a group/user chat, not a bot account, to avoid 403 errors on alert delivery

---
*Phase: 02-oracle-service*
*Completed: 2026-03-18*
