---
phase: 02-oracle-service
plan: 05
subsystem: oracle
tags: [node, typescript, arweave, irys, telegram, round-history, tdd, atomic-writes]

# Dependency graph
requires:
  - phase: 02-oracle-service
    plan: 02
    provides: oracle project scaffold; OracleConfig; RoundHistoryEntry type; logger

provides:
  - oracle/src/history.ts: RoundHistory class with atomic read/push/reconstruct (5-entry cap)
  - oracle/src/arweave.ts: uploadToArweave() with 60s timeout, returns null on failure
  - oracle/src/alerts.ts: createAlerts() returning Telegram or no-op Alerts implementation
  - oracle/src/__tests__/history.test.ts: 6 TDD tests for round history persistence

affects: [02-oracle-service plans 04, 06+ (lifecycle manager, index.ts)]

# Tech tracking
tech-stack:
  added:
    - "@irys/upload-solana ^0.1.8 — Irys SDK for Arweave uploads (Builder pattern API)"
    - "@irys/upload — bundled with @irys/upload-solana; provides Builder() factory"
  patterns:
    - "Atomic write: fs.writeFile(path.tmp) then fs.rename(path.tmp, path) — POSIX atomic"
    - "Irys Builder pattern: Builder(Solana).withWallet(key).withRpc(rpcUrl).mainnet().build()"
    - "Alert dual-mode: createAlerts returns NoopAlerts when Telegram unconfigured, TelegramAlerts when configured"
    - "All external service calls wrapped in try/catch returning null — never block round lifecycle"

key-files:
  created:
    - oracle/src/history.ts
    - oracle/src/arweave.ts
    - oracle/src/alerts.ts
    - oracle/src/__tests__/history.test.ts
  modified:
    - oracle/package.json (added @irys/upload-solana to dependencies)

key-decisions:
  - "@irys/upload-solana uses Builder factory pattern (Builder(Solana).withWallet()...) not new Irys({}) constructor — adapted from actual package exports after reading node_modules"
  - "alerts.ts sendRetryWarning takes pixelIndex param — plan spec had no param but callers need it for the message format"
  - "Dynamic require() for @irys/upload and node-telegram-bot-api — avoids ESM/CJS conflicts and allows graceful fallback if packages absent"

requirements-completed: [ORC-09]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 2 Plan 5: Round History, Arweave Upload, and Telegram Alerts Summary

**Atomic round history persistence (5-entry cap), Irys/Arweave prompt upload with 60s timeout, and Telegram alert notifications with no-op fallback when unconfigured**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T18:08:18Z
- **Completed:** 2026-03-17T18:12:29Z
- **Tasks:** 2/2 complete
- **Files modified:** 4 created, 1 modified

## Accomplishments

- Built RoundHistory class with atomic writes (tmp-then-rename) and 5-entry ring buffer
- All 6 TDD tests pass including persistence, ENOENT, corrupt JSON, overflow cap, and atomicity
- Built uploadToArweave() that wraps the Irys Builder API with a 60-second timeout and graceful null return
- Built createAlerts() with dual-mode: live Telegram when configured, silent no-op when not
- All three modules are resilient — external service failures never block the round lifecycle
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for RoundHistory** — `2d0c2e6` (test)
2. **Task 1 GREEN: RoundHistory implementation** — `270a93f` (feat)
3. **Task 2: Arweave + Telegram modules** — `4db0437` (feat)

## Files Created/Modified

- `oracle/src/history.ts` — RoundHistory class: atomic read/push/reconstruct, 5-entry cap
- `oracle/src/arweave.ts` — uploadToArweave with Builder pattern, 60s timeout, null-on-failure
- `oracle/src/alerts.ts` — createAlerts, Alerts interface, NoopAlerts, TelegramAlerts
- `oracle/src/__tests__/history.test.ts` — 6 TDD tests using tmp directories
- `oracle/package.json` — added @irys/upload-solana to dependencies

## Decisions Made

- **Irys SDK actual API:** The plan expected `new Irys({url, token, key, config})` but the actual `@irys/upload-solana` package exports a `Solana` token class used with the `Builder` factory from `@irys/upload`: `Builder(Solana).withWallet(key).withRpc(rpcUrl).mainnet().build()`. Adapted implementation to match actual exports after reading node_modules.
- **sendRetryWarning pixelIndex param:** Plan's `Alerts` interface had `sendRetryWarning()` with no params but the message format includes `{pixelIndex}`. Added `pixelIndex: number` parameter to the method signature so callers can produce meaningful alerts.
- **Dynamic require for Irys and Telegram:** Both `@irys/upload` and `node-telegram-bot-api` loaded via `require()` inside functions to avoid top-level ESM/CJS conflicts and allow graceful fallback if packages are missing or misconfigured.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Irys SDK uses Builder pattern, not constructor**
- **Found during:** Task 2 (implementing arweave.ts)
- **Issue:** Plan expected `new Irys({url, token, key, config})` but actual API is `Builder(Solana).withWallet(...).withRpc(...).mainnet().build()`. Plan itself noted "MEDIUM confidence" on this.
- **Fix:** Read `node_modules/@irys/upload-solana/dist/types/` and `node_modules/@irys/upload/dist/cjs/builder.js` to find the actual API, implemented accordingly.
- **Files modified:** oracle/src/arweave.ts
- **Committed in:** 4db0437

**2. [Rule 2 - Missing critical functionality] Added pixelIndex param to sendRetryWarning**
- **Found during:** Task 2 (implementing alerts.ts)
- **Issue:** Plan's interface spec had `sendRetryWarning(): Promise<void>` but message format includes `{pixelIndex}` — without the param, the message would be unusable.
- **Fix:** Added `pixelIndex: number` parameter to `sendRetryWarning` signature and message.
- **Files modified:** oracle/src/alerts.ts
- **Committed in:** 4db0437

---

**Total deviations:** 2 auto-fixed
**Impact on plan:** Both fixes were correctness improvements. No scope creep.

## User Setup Required

Telegram bot configuration (optional — oracle runs fine without it in no-op mode):
- `TELEGRAM_BOT_TOKEN` — from @BotFather on Telegram: `/newbot` then copy the token
- `TELEGRAM_CHAT_ID` — send a message to your bot, then GET `https://api.telegram.org/bot{token}/getUpdates` and read `result.message.chat.id`

## Next Phase Readiness

- history.ts exports `RoundHistory` — ready for import by lifecycle manager (plan 04)
- arweave.ts exports `uploadToArweave` — ready for import by lifecycle manager
- alerts.ts exports `createAlerts` and `Alerts` — ready for import by lifecycle manager
- No blockers for remaining oracle plans

---
*Phase: 02-oracle-service*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: oracle/src/history.ts
- FOUND: oracle/src/arweave.ts
- FOUND: oracle/src/alerts.ts
- FOUND: oracle/src/__tests__/history.test.ts
- FOUND: .planning/phases/02-oracle-service/02-05-SUMMARY.md
- FOUND commit: 2d0c2e6 (test: RED)
- FOUND commit: 270a93f (feat: GREEN history)
- FOUND commit: 4db0437 (feat: arweave + alerts)
