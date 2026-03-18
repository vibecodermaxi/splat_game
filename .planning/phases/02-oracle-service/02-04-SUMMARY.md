---
phase: 02-oracle-service
plan: 04
subsystem: oracle
tags: [node, typescript, round-lifecycle, failure-cascade, vrf, switchboard, tdd, retry]

# Dependency graph
requires:
  - phase: 02-oracle-service
    provides: oracle/src/chain.ts (ChainClient), oracle/src/types.ts (ClaudeResult, ResolutionResult, RoundHistoryEntry)
  - phase: 02-oracle-service
    provides: oracle/src/prompt.ts (buildSystemPrompt, buildUserMessage, buildFullPrompt, hashPrompt)
  - phase: 02-oracle-service
    provides: oracle/src/claude.ts (callClaude)

provides:
  - oracle/src/round.ts: OracleContext interface, sleep(), callClaudeWithFallback(), runRound()
  - oracle/src/vrf.ts: resolveViaVrf() — Switchboard On-Demand v3 VRF fallback
  - oracle/src/__tests__/retry.test.ts: 7 unit tests for failure cascade timing and behavior

affects: [02-oracle-service plans 05+, lifecycle entry point, Arweave upload integration]

# Tech tracking
tech-stack:
  added:
    - "@switchboard-xyz/on-demand@3.9.0 (Randomness class for VRF request + polling)"
  patterns:
    - "Failure cascade: 3-tier pattern (fast retry → delay state → VRF) with injectable sleep/callClaude/vrf hooks"
    - "OracleContext: dependency injection via explicit context object — all external dependencies visible and mockable"
    - "_testHooks: named override field on OracleContext for test injection (callClaude, sleep, resolveViaVrf)"
    - "VRF fulfillment check: poll accountInfo.data.slice(80, 144) for any non-zero byte; colorIndex = value[0] % 16"
    - "N+1 pre-opening: placeholder hash via SHA-256('placeholder-{season}-{pixelIndex+1}'); skip on last pixel"

key-files:
  created:
    - oracle/src/round.ts
    - oracle/src/vrf.ts
    - oracle/src/__tests__/retry.test.ts

key-decisions:
  - "OracleContext._testHooks: test injection via optional field on context (not module-level override) — keeps production code free of test concerns while allowing full mock control"
  - "Switchboard SDK anchor type conflict: @coral-xyz/anchor vs SDK's bundled anchor-31 — resolved with `any` cast for sbProgram (runtime identical, type-safe at oracle boundary)"
  - "VRF module uses duck-typed access to ChainClient internals (connection, oracleWallet) — avoids exposing private fields publicly while enabling VRF to reuse the existing connection"
  - "Tier 2 delay sleep BEFORE call (not after): ensures 5-min sleep precedes each of the 6 delay attempts, matching spec intent"

patterns-established:
  - "callClaudeWithFallback always resolves (never throws) — guaranteed by Tier 3 VRF fallback"
  - "runRound is fully imperative and sequential — no concurrency, easy to reason about"

requirements-completed: [ORC-05, ORC-06, ORC-07, ORC-08]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 2 Plan 4: Round Lifecycle and Failure Cascade Summary

**3-tier failure cascade (3x30s fast retry, 6x5min delay state, VRF fallback) guaranteeing every round resolves within ~32 minutes even when Claude is completely unavailable; full round lifecycle from open through resolve with N+1 pixel pre-opening**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-17T18:08:23Z
- **Completed:** 2026-03-17T18:14:27Z
- **Tasks:** 2/2 complete
- **Files modified:** 3 created (round.ts, vrf.ts, retry.test.ts)

## Accomplishments

- Built `round.ts` with `callClaudeWithFallback` implementing the exact 3-tier cascade: 3 fast retries at 30s, 6 delay retries at 5 min, VRF fallback
- Built `round.ts` `runRound` lifecycle: open → wait 28min → lock → wait 2min → resolve → history push → alert
- Built `vrf.ts` with `resolveViaVrf` using Switchboard On-Demand v3 SDK (Randomness.create + commitIx + polling loop)
- 7 unit tests all pass; `tsc --noEmit` exits clean
- OracleContext._testHooks injection pattern enables full mocking of sleep, callClaude, and VRF without module-level patching
- N+1 pixel pre-opening with placeholder SHA-256 hash enables SC-17 future pixel betting

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for failure cascade** - `7330a0b` (test)
2. **Task 1 GREEN: round.ts failure cascade + lifecycle** - `1f6f3fc` (feat)
3. **Task 2: Switchboard VRF fallback module** - `20cb0f8` (feat)

## Files Created/Modified

- `oracle/src/round.ts` — OracleContext interface, sleep(), callClaudeWithFallback() (3-tier cascade), runRound() (complete lifecycle)
- `oracle/src/vrf.ts` — resolveViaVrf() with Switchboard On-Demand v3 Randomness.create + commit + poll loop
- `oracle/src/__tests__/retry.test.ts` — 7 unit tests covering all cascade behaviors with mocked time/Claude/VRF

## Decisions Made

- `OracleContext._testHooks` injection pattern: test mocks injected via optional field on context object rather than module-level override. Production code untouched by test concerns.
- Switchboard SDK `any` cast: `@switchboard-xyz/on-demand` bundles its own `@coral-xyz/anchor-31` with incompatible `Program` types. Using `any` for `sbProgram` bridges the type mismatch — runtime behavior is identical.
- VRF duck-typed internals: `resolveViaVrf` accesses `ChainClient.connection` and `ChainClient.oracleWallet` via bracket notation to reuse the established connection without exposing private fields as public API.
- Tier 2 sleep placement: `await sleepFn(DELAY_RETRY_MS)` precedes each call in the 6-iteration delay loop — sleep happens before each attempt (not after failure), which matches the spec's "retrying every 5 minutes" intent.

## Deviations from Plan

None — plan executed exactly as written.

The Switchboard SDK API discovery at implementation time (flagged as MEDIUM confidence in RESEARCH) confirmed the `Randomness.create(program, kp, queue)` approach. The anchor type conflict was auto-resolved with an `any` cast (Rule 1 pattern — TypeScript error blocking compilation).

## Issues Encountered

- None. All 7 tests passed on first GREEN run. TypeScript compiled clean.

## Next Phase Readiness

- `round.ts` and `vrf.ts` are ready for use by the oracle entry point (Plan 05)
- `runRound(ctx)` is the single call the entry point needs; ctx aggregates all dependencies
- Arweave upload (Plan 05) can be wired into `runRound` as a post-resolve step via `ctx.chain.setArweaveTxid`
- Telegram alert implementations (Plan 05) need to be wired into `ctx.alerts`
- No blockers for oracle Plans 05+ (entry point, Arweave, lifecycle manager)

---
*Phase: 02-oracle-service*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: oracle/src/round.ts
- FOUND: oracle/src/vrf.ts
- FOUND: oracle/src/__tests__/retry.test.ts
- FOUND: .planning/phases/02-oracle-service/02-04-SUMMARY.md
- FOUND commit: 7330a0b (test: RED failing tests for failure cascade)
- FOUND commit: 1f6f3fc (feat: round.ts failure cascade + lifecycle GREEN)
- FOUND commit: 20cb0f8 (feat: Switchboard VRF fallback module)
