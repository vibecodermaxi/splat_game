---
phase: 02-oracle-service
verified: 2026-03-18T00:00:00Z
status: passed
score: 4/4 success criteria verified
re_verification: null
gaps: []
human_verification:
  - test: "Full 30-minute round cycle on devnet"
    expected: "Oracle opens a round with prompt hash, waits 28 min, locks, calls Claude at temperature 0, resolves on-chain with color/shade/warmth, uploads prompt to Arweave, writes txid on-chain"
    why_human: "Requires live devnet, real API keys, 30 minutes of clock time — cannot be verified programmatically"
  - test: "VRF fallback path end-to-end"
    expected: "After 3x30s fast retries + 6x5min delay retries all fail, oracle calls resolveRoundVrf on-chain using Switchboard randomness account"
    why_human: "Requires simulating 30+ minutes of Claude failures against a live Switchboard endpoint"
  - test: "Railway deployment and always-on process"
    expected: "Oracle process restarts correctly on Railway after container replacement, reads chain state, reconstructs history, resumes scheduling"
    why_human: "Requires Railway deployment — cannot simulate container restart programmatically"
  - test: "Telegram alert delivery"
    expected: "Operator receives alerts for round success, retry warnings, VRF fallback, and process restart to a group/user chat (not bot account)"
    why_human: "Requires live Telegram bot configuration with correct chat ID"
---

# Phase 2: Oracle Service Verification Report

**Phase Goal:** A running Railway process that autonomously drives the round lifecycle — opening rounds with committed hashes, calling Claude at temperature 0, resolving on-chain, and failing over to VRF — with no human intervention needed
**Verified:** 2026-03-18
**Status:** PASSED (with human verification items noted)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Oracle opens a round by posting SHA-256 prompt hash on-chain before the betting window | VERIFIED | `hashPrompt()` in `prompt.ts` (SHA-256 via `createHash`); `runRound()` calls `openRoundForSeason(seasonNumber, pixelIndex, Array.from(promptHash))` wiring hash to on-chain instruction |
| 2 | Oracle calls Claude at temperature 0, parses COLOR/SHADE/WARMTH/REASONING, validates the response, and resolves the round on-chain with the full prompt data | VERIFIED | `callClaude()` in `claude.ts` uses `temperature: 0` hardcoded; `parseClaudeResponse()` uses regex for all 4 fields; `validateClaudeResult()` checks ranges; `resolveRound()` in `chain.ts` posts result on-chain |
| 3 | On Claude API failure: oracle retries 3x at 30 seconds, then enters 5-minute retry loop for 30 minutes, then falls back to VRF resolution — round always resolves | VERIFIED | `callClaudeWithFallback()` in `round.ts`: Tier 1 = 3 attempts with `sleep(30_000)`, Tier 2 = 6 attempts with `sleep(5*60_000)` preceded by `sendRetryWarning()`, Tier 3 = `resolveViaVrf()`; Switchboard SDK v3 (`@switchboard-xyz/on-demand@3.9.0`) installed and imported in `vrf.ts` |
| 4 | Oracle runs as an always-on Railway process (not cron) and maintains round_history.json across round boundaries | VERIFIED | `index.ts` self-executes `main()`, registers SIGTERM/SIGINT, uses `startScheduler(ctx)` with node-cron; `RoundHistory` class in `history.ts` writes atomically (tmp-then-rename) with 5-entry cap; `history.reconstruct()` called on startup if file missing |

**Score:** 4/4 success criteria verified

---

## Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Key Evidence |
|----------|-----------|-------------|--------|--------------|
| `programs/pixel-predict/src/instructions/set_arweave_txid.rs` | 30 | 52 | VERIFIED | `SetArweaveTxid` accounts struct + handler; Resolved status constraint; oracle `has_one` auth |
| `target/idl/pixel_predict.json` | — | — | VERIFIED | `"name": "set_arweave_txid"` at line 756 of IDL |
| `oracle/package.json` | — | — | VERIFIED | Contains `@anthropic-ai/sdk`, `@switchboard-xyz/on-demand`, `@irys/upload-solana`, `node-cron`, `node-telegram-bot-api` |
| `oracle/tsconfig.json` | — | — | VERIFIED | File exists; `compilerOptions` confirmed |
| `oracle/src/config.ts` | 40 | 95 | VERIFIED | Exports `loadConfig`, `OracleConfig`; validates 5 required env vars; exits on missing |
| `oracle/src/types.ts` | 30 | 78 | VERIFIED | Exports `COLOR_NAMES`, `ClaudeResult`, `RoundHistoryEntry`, `PixelData`, `ResolutionResult` |
| `oracle/src/logger.ts` | 15 | 38 | VERIFIED | Exports `logger` with info/warn/error/debug |
| `oracle/src/chain.ts` | 100 | 562 | VERIFIED | Exports `ChainClient`; wraps all 5 oracle instructions (`openRound`, `lockRound`, `resolveRound`, `resolveRoundVrf`, `setArweaveTxid`); static PDA derivation |
| `oracle/config/system-prompt.txt` | — | — | VERIFIED | Contains `{grid_width}`, `{grid_height}`, `{season_style_summary}` placeholders; "abstract artist" header present |
| `oracle/src/prompt.ts` | 60 | 179 | VERIFIED | Exports `buildSystemPrompt`, `buildUserMessage`, `buildFullPrompt`, `hashPrompt` |
| `oracle/src/claude.ts` | 50 | 129 | VERIFIED | Exports `callClaude`, `parseClaudeResponse`, `validateClaudeResult`; `temperature: 0` hardcoded; model `claude-sonnet-4-6` |
| `oracle/src/round.ts` | 80 | 351 | VERIFIED | Exports `runRound`, `callClaudeWithFallback`, `OracleContext`; full lifecycle + 3-tier cascade |
| `oracle/src/vrf.ts` | 30 | 255 | VERIFIED | Exports `resolveViaVrf`; Switchboard On-Demand v3 SDK; polls value offset 80 for non-zero bytes |
| `oracle/src/history.ts` | 30 | 157 | VERIFIED | Exports `RoundHistory`; atomic write (tmp + rename); 5-entry cap; `reconstruct()` method |
| `oracle/src/arweave.ts` | 20 | 87 | VERIFIED | Exports `uploadToArweave`; Irys Builder pattern; 60s timeout; returns null on failure |
| `oracle/src/alerts.ts` | 30 | 177 | VERIFIED | Exports `createAlerts`, `Alerts`; `NoopAlerts` + `TelegramAlerts`; all 5 alert methods |
| `oracle/src/index.ts` | 40 | 300 | VERIFIED | Exports `main`; recovery for all 4 pixel states (null/open/locked/resolved); SIGTERM/SIGINT; self-executing |
| `oracle/src/scheduler.ts` | 30 | 54 | VERIFIED | Exports `startScheduler`; `0,30 * * * *` cron; `roundInProgress` overlap guard |
| `oracle/dist/index.js` | — | — | VERIFIED | TypeScript compiled to dist/ — file confirmed present |
| `scripts/devnet-setup.ts` | — | 105 | VERIFIED | Devnet setup script for `initialize_config` + `start_season` confirmed present |

---

## Key Link Verification

| From | To | Via | Status | Detail |
|------|----|-----|--------|--------|
| `programs/.../lib.rs` | `set_arweave_txid.rs` | `instructions::set_arweave_txid::set_arweave_txid(ctx, ...)` | WIRED | Lines 102, 108 in lib.rs; mod.rs lines 11, 23 |
| `oracle/src/chain.ts` | `target/idl/pixel_predict.json` | `require(idlPath)` at runtime; path resolves to `../../target/idl/pixel_predict.json` | WIRED | Lines 83-89 in chain.ts |
| `oracle/src/config.ts` | `oracle/src/chain.ts` | `OracleConfig` used by `ChainClient` constructor; `config.solanaRpcUrl`, `config.oracleKeypair`, `config.programId` | WIRED | ChainClient line 73-103 |
| `oracle/src/prompt.ts` | `oracle/config/system-prompt.txt` | `fs.readFileSync` via `loadTemplate()`; `path.resolve(__dirname, "../config/system-prompt.txt")` | WIRED | prompt.ts lines 26-30 |
| `oracle/src/prompt.ts` | `oracle/src/types.ts` | `PixelData`, `RoundHistoryEntry` types imported | WIRED | prompt.ts line 15 |
| `oracle/src/claude.ts` | `@anthropic-ai/sdk` | `client.messages.create(...)` with `temperature: 0` | WIRED | claude.ts lines 91-99 |
| `oracle/src/round.ts` | `oracle/src/chain.ts` | `chain.openRoundForSeason`, `chain.lockRound`, `chain.resolveRound`, `chain.setArweaveTxid` all called in `runRound()` | WIRED | round.ts lines 220, 253, 279, 303 |
| `oracle/src/round.ts` | `oracle/src/claude.ts` | `callClaude()` imported and called in `callClaudeWithFallback()` | WIRED | round.ts lines 14, 112-118 |
| `oracle/src/round.ts` | `oracle/src/vrf.ts` | `resolveViaVrf()` called as Tier 3 fallback | WIRED | round.ts lines 16, 157 |
| `oracle/src/index.ts` | `oracle/src/scheduler.ts` | `startScheduler(ctx)` called after recovery check | WIRED | index.ts line 259 |
| `oracle/src/index.ts` | `oracle/src/chain.ts` | `getSeasonState`, `getPixelState` called in recovery logic | WIRED | index.ts lines 64-66 |
| `oracle/src/scheduler.ts` | `oracle/src/round.ts` | `runRound(ctx)` called on each cron tick | WIRED | scheduler.ts line 39 |
| `oracle/src/round.ts` | `oracle/src/arweave.ts` | `uploadToArweave()` called post-resolution; txid written via `setArweaveTxid` | WIRED | round.ts lines 289-311 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ORC-01 | 02-03 | Oracle constructs AI prompt from canvas state, neighbors, last 5 selections | SATISFIED | `buildUserMessage()` in `prompt.ts` builds canvas state, 8-direction neighbors, last 5 history; called in `runRound()` |
| ORC-02 | 02-02 | Oracle computes SHA-256 hash of prompt and posts it on-chain at round open | SATISFIED | `hashPrompt()` returns 32-byte SHA-256 digest; `openRoundForSeason(seasonNumber, pixelIndex, Array.from(promptHash))` wires it on-chain |
| ORC-03 | 02-03 | Oracle calls Claude API at temperature 0 and parses COLOR, SHADE, WARMTH, REASONING | SATISFIED | `callClaude()` uses `temperature: 0`; `parseClaudeResponse()` regex-matches all 4 fields |
| ORC-04 | 02-03 | Oracle validates AI response (color is one of 16, shade/warmth 0-100) | SATISFIED | `validateClaudeResult()` checks `colorIndex 0-15`, `shade 0-100`, `warmth 0-100`; `callClaude()` throws on invalid |
| ORC-05 | 02-01, 02-02 | Oracle posts winning color, shade, warmth, and full prompt data on-chain at resolution | SATISFIED | `resolveRound()` in `chain.ts` posts `winning_color`, `shade`, `warmth`; `setArweaveTxid()` writes Arweave txid; `set_arweave_txid` Anchor instruction live on-chain |
| ORC-06 | 02-04 | Oracle retries failed API calls 3 times at 30-second intervals | SATISFIED | `FAST_RETRY_COUNT = 3`, `FAST_RETRY_DELAY_MS = 30_000`; Tier 1 loop in `callClaudeWithFallback()` |
| ORC-07 | 02-04 | Oracle enters delay state on persistent failure, retrying every 5 minutes for 30 minutes | SATISFIED | `DELAY_RETRY_COUNT = 6`, `DELAY_RETRY_MS = 5*60_000`; Tier 2 loop (6 attempts x 5 min = 30 min) |
| ORC-08 | 02-04 | Oracle falls back to VRF resolution after 30 minutes of failure | SATISFIED | Tier 3 calls `resolveViaVrf()`; Switchboard On-Demand v3 SDK installed; polls randomness account |
| ORC-09 | 02-05 | Oracle maintains local round_history.json for prompt construction (last 5 rounds) | SATISFIED | `RoundHistory.push()` with `slice(-5)`; atomic write (tmp+rename); `reconstruct()` rebuilds from chain if missing |
| ORC-10 | 02-06 | Oracle runs as always-on Railway process with in-process scheduler (not Railway cron) | SATISFIED | `index.ts` self-executing; `startScheduler()` uses node-cron `0,30 * * * *`; SIGTERM/SIGINT handlers; devnet smoke test confirmed |
| ORC-11 | 02-03 | Oracle includes season style summary in system prompt starting from Season 2 | SATISFIED | `{season_style_summary}` placeholder in `system-prompt.txt`; `buildSystemPrompt()` replaces it; empty string default for Season 1 |

All 11 requirements (ORC-01 through ORC-11) are satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `oracle/src/round.ts:226-229` | `placeholder` in variable name | INFO | Legitimate code — SHA-256 of "placeholder-{season}-{pixelIndex+1}" is the intentional N+1 pre-open hash; not a stub |
| None | — | — | No TODO/FIXME/HACK/XXX markers found in any core oracle source file |
| None | — | — | No `return null` stubs, empty implementations, or console.log-only handlers found |

No blockers. No warnings.

---

## Human Verification Required

### 1. Full 30-minute round cycle on devnet

**Test:** Start oracle with real env vars; wait for a cron tick at minute 0 or 30; observe the full lifecycle
**Expected:** Round opens (with SHA-256 hash visible in PixelState.prompt_hash), waits 28 min, locks, Claude called, result resolved on-chain, Arweave upload attempted, txid written if successful
**Why human:** Requires live devnet, real API keys (Anthropic, Helius), and 30 minutes of wall-clock time

### 2. VRF fallback path end-to-end

**Test:** Configure oracle with an intentionally broken Anthropic API key; watch all 9 retry attempts exhaust; verify VRF resolution
**Expected:** 3 fast retries (90s), 6 delay retries (30 min), then Switchboard randomness account created and `resolve_round_vrf` called on-chain
**Why human:** Requires simulating persistent Claude failure for 30+ minutes against live Switchboard devnet endpoint

### 3. Railway deployment and process restart recovery

**Test:** Deploy to Railway; kill container; verify restart correctly resumes from chain state
**Expected:** Logs show `recovery_check`, correct `pixelStatus` branch taken, `history_reconstructed` if needed, `scheduler_started`
**Why human:** Requires Railway account and deployment; cannot simulate container restart locally

### 4. Telegram alert delivery

**Test:** Set up bot with correct group/user chat ID (not bot-to-bot); trigger a round; verify alerts arrive
**Expected:** Success alert with pixel index, color name, shade, warmth delivered to Telegram chat
**Why human:** Requires configured Telegram bot; note from smoke test: 403 errors occur if chat ID points to another bot account

---

## Gaps Summary

No gaps. All 4 success criteria are verified. All 11 ORC requirements are satisfied. All key links are wired. The oracle is a complete, substantive implementation — no stubs, no placeholder implementations, no orphaned modules.

**Devnet smoke test context:** The 02-06 summary confirms the oracle was smoke-tested: it started cleanly, logged `oracle_starting`, performed the `recovery_check` (pixel 0, status none — fresh season), triggered `recovery_no_round`, `history_reconstructed`, and `scheduler_started (0,30 * * * *)`. The Telegram 403 error (bot-to-bot messaging) was non-blocking and is a configuration concern, not a code defect.

**One open configuration item:** The Telegram chat ID used during smoke testing pointed to another bot account (produces 403). Operators must configure `TELEGRAM_CHAT_ID` to a group or user chat. The code handles this correctly (error caught and swallowed); alerts are optional and non-blocking.

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
