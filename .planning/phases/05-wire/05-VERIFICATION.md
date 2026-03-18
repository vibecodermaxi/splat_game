---
phase: 05-wire
verified: 2026-03-19T00:00:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "Connect a wallet and submit a place_bet transaction from the UI"
    expected: "Transaction lands on devnet; BetAccount visible at derived PDA on Solana Explorer"
    why_human: "Requires live devnet program, funded wallet, and active browser — cannot verify programmatically"
  - test: "Claim winnings from My Bets panel after a winning round resolves"
    expected: "SOL balance increases in the connected wallet after claim_winnings transaction confirms"
    why_human: "Requires a resolved round with a winning bet — runtime state not reproducible from static analysis"
  - test: "Watch canvas and betting panel update live when the oracle resolves a round"
    expected: "PixelState account change triggers re-render of canvas pixel colour and SeasonState triggers panel update without page refresh"
    why_human: "Requires a live WebSocket connection to devnet and an oracle-driven round transition — cannot verify from static code analysis"
---

# Phase 5: Wire — Verification Report

**Phase Goal:** All three subsystems share the same IDL and environment configuration, and every frontend hook submits real transactions and receives real data from devnet
**Verified:** 2026-03-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `anchor build` and the copy script propagates a single IDL file to both frontend and oracle with no manual steps | VERIFIED | `scripts/copy-idl.sh` exists, is executable (`-rwxr-xr-x`), copies `target/idl/pixel_predict.json` to both `app/src/lib/idl.json` and `oracle/src/idl.json`. Both copies are byte-identical. oracle/src/idl.json is gitignored as a build artifact. |
| 2 | Every subsystem reads RPC URL, program ID, and round timing from environment variables — no hardcoded values remain | VERIFIED | Oracle: `config.ts` requires `SOLANA_RPC_URL` and `PROGRAM_ID` from env; reads `ROUND_DURATION_MINUTES` with default 30; derives `cronSchedule`, `bettingWindowMinutes`, `lockWindowMinutes`. Frontend: `constants.ts` reads `NEXT_PUBLIC_ROUND_DURATION_SECONDS`; `WalletProvider.tsx` reads `NEXT_PUBLIC_SOLANA_RPC_URL` with `devnet.solana.com` fallback (not mainnet). |
| 3 | A wallet-connected player can submit a `place_bet` transaction from the UI and confirm the BetAccount exists on devnet via Solana Explorer | VERIFIED (code path) | `usePlaceBet.ts` calls `.rpc({ commitment: "confirmed" })` on the Anchor `place_bet` method with real PDAs derived from `PROGRAM_ID`. Chain: `WalletProvider` → `useAnchorProgram` (reads `NEXT_PUBLIC_SOLANA_RPC_URL` via `ConnectionProvider`) → `usePlaceBet` → `.rpc()`. No stubs, no mocks. Human test required for runtime confirmation. |
| 4 | A player whose bet won can submit a `claim_winnings` transaction from the UI and see SOL arrive in their wallet | VERIFIED (code path) | `useClaimWinnings.ts` calls `.rpc({ commitment: "confirmed" })` on the Anchor `claim_winnings` method for both `claimSingle` and inside `claimAll`. Sequential execution with `for...of` prevents account-in-use errors. No stubs. Human test required for runtime confirmation. |
| 5 | The canvas and betting panel update live on-screen when a PixelState or SeasonState account changes on devnet | VERIFIED (code path) | `useHeliusSocket.ts` subscribes to both PixelState PDA and SeasonState PDA via `connection.onAccountChange(...)`. On change: decodes the account, calls `setPixelState` / `setSeasonState` into Zustand store which triggers re-renders. Includes 60-second ping to prevent Helius timeout and 15-second polling fallback on disconnect. Human test required for runtime confirmation. |

**Score:** 5/5 truths verified (code path; 3 truths additionally require human runtime verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/copy-idl.sh` | Automated IDL propagation script | VERIFIED | Exists, executable. Copies `target/idl/pixel_predict.json` to both destinations. Error exits with clear message if anchor build not run. |
| `oracle/src/idl.json` | Local IDL copy for oracle | VERIFIED | Exists. Byte-identical to `app/src/lib/idl.json`. Gitignored. |
| `.env.example` | Shared env var reference for all subsystems | VERIFIED | Exists at project root. Covers `NEXT_PUBLIC_SOLANA_RPC_URL`, `SOLANA_RPC_URL`, `PROGRAM_ID`, `ROUND_DURATION_MINUTES`, `NEXT_PUBLIC_ROUND_DURATION_SECONDS`, oracle-only vars, and frontend-only section. |
| `oracle/src/config.ts` | Env-driven round timing config | VERIFIED | `OracleConfig` interface has `roundDurationMinutes`, `bettingWindowMinutes`, `lockWindowMinutes`, `cronSchedule`. `loadConfig()` parses `ROUND_DURATION_MINUTES` with default 30 and validation (`>= 3`). |
| `oracle/src/scheduler.ts` | Dynamic cron schedule from config | VERIFIED | `cron.schedule(ctx.config.cronSchedule, ...)` — no hardcoded `"0,30 * * * *"`. Logs `schedule: ctx.config.cronSchedule` on start. |
| `oracle/src/chain.ts` | IDL loaded from local copy | VERIFIED | `import idl from "./idl.json"` — no `path.resolve("../../target/idl/...")`. Compile-time safety: missing IDL fails at build, not runtime. |
| `app/src/lib/constants.ts` | Env-driven timing constants | VERIFIED | `ROUND_DURATION_SECONDS = parseInt(process.env.NEXT_PUBLIC_ROUND_DURATION_SECONDS \|\| "1800", 10)`. `BETTING_WINDOW_SECONDS` derived from `ROUND_DURATION_SECONDS - LOCKOUT_SECONDS`. |
| `app/src/hooks/useSeasonData.ts` | Dynamic season discovery from chain | VERIFIED | Accepts `initialSeasonNumber: number = 1` parameter. No hardcoded `const seasonNumber = 1` in body. Uses `connection.getAccountInfo(seasonPDA)` and `program.account.pixelState.fetchMultiple(pixelPDAs)` — real chain queries. |
| `app/src/components/providers/WalletProvider.tsx` | Devnet-default RPC endpoint | VERIFIED | Fallback is `"https://api.devnet.solana.com"` — not `"https://api.mainnet-beta.solana.com"`. Reads `NEXT_PUBLIC_SOLANA_RPC_URL` from env. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/copy-idl.sh` | `app/src/lib/idl.json` | file copy | WIRED | `cp "$SRC_IDL" "$DEST_APP"` where `DEST_APP="$PROJECT_ROOT/app/src/lib/idl.json"` |
| `scripts/copy-idl.sh` | `oracle/src/idl.json` | file copy | WIRED | `cp "$SRC_IDL" "$DEST_ORACLE"` where `DEST_ORACLE="$PROJECT_ROOT/oracle/src/idl.json"` |
| `oracle/src/config.ts` | `oracle/src/scheduler.ts` | `cronSchedule` config field | WIRED | `cron.schedule(ctx.config.cronSchedule, ...)` confirmed in scheduler.ts line 32 |
| `oracle/src/config.ts` | `oracle/src/index.ts` | `bettingWindowMinutes`, `lockWindowMinutes` | WIRED | `const BETTING_WINDOW_MS = config.bettingWindowMinutes * 60_000` and `const LOCK_WINDOW_MS = config.lockWindowMinutes * 60_000` in `main()` |
| `app/src/lib/constants.ts` | `app/src/hooks/useCountdown.ts` | `ROUND_DURATION_SECONDS` import | WIRED | `import { ROUND_DURATION_SECONDS, LOCKOUT_SECONDS } from "@/lib/constants"` — used in countdown computation |
| `app/src/lib/constants.ts` | `app/src/hooks/usePlaceBet.ts` | `PROGRAM_ID` import | WIRED | `import { PROGRAM_ID } from "@/lib/constants"` — used for all PDA derivations |
| `app/src/components/providers/WalletProvider.tsx` | `app/src/hooks/useAnchorProgram.ts` | `ConnectionProvider` endpoint | WIRED | `WalletProvider` wraps `ConnectionProvider endpoint={endpoint}` where endpoint reads `NEXT_PUBLIC_SOLANA_RPC_URL`. `useAnchorProgram` reads `connection` via `useConnection()`. |
| `app/src/lib/idl.json` | `app/src/hooks/useAnchorProgram.ts` | static import | WIRED | `import idl from "@/lib/idl.json"` — used to create `new Program(idl as Idl, provider)` |
| `oracle/src/idl.json` | `oracle/src/chain.ts` | static import | WIRED | `import idl from "./idl.json"` — used in `new anchor.Program<anchor.Idl>(idl, provider)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INT-01 | 05-01-PLAN.md | IDL from `anchor build` automatically copied to frontend and oracle | SATISFIED | `scripts/copy-idl.sh` propagates single IDL to both `app/src/lib/idl.json` and `oracle/src/idl.json`. Both verified present and byte-identical. |
| INT-02 | 05-01-PLAN.md | Environment configuration managed via env vars across all three subsystems with shared `.env.example` | SATISFIED | Root `.env.example` covers all subsystems. Oracle reads `SOLANA_RPC_URL`, `PROGRAM_ID`, `ROUND_DURATION_MINUTES`. Frontend reads `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_ROUND_DURATION_SECONDS`. |
| INT-03 | 05-02-PLAN.md | `usePlaceBet` submits a real `place_bet` transaction to devnet | SATISFIED (code path) | `.rpc({ commitment: "confirmed" })` on `program.methods.placeBet(...)`. No stubs. Full PDA derivation from live store values. |
| INT-04 | 05-02-PLAN.md | `useClaimWinnings` submits a real `claim_winnings` transaction to devnet | SATISFIED (code path) | `.rpc({ commitment: "confirmed" })` on `program.methods.claimWinnings()` in both `claimSingle` and `claimAll`. No stubs. |
| INT-05 | 05-02-PLAN.md | Frontend Helius WebSocket receives real PixelState and SeasonState changes | SATISFIED (code path) | `connection.onAccountChange(pixelPDA, ...)` and `connection.onAccountChange(seasonPDA, ...)` with decode + store update. 60s ping + polling fallback implemented. |
| INT-06 | 05-02-PLAN.md | `useSeasonData` fetches real SeasonState and all PixelState accounts from devnet | SATISFIED | `connection.getAccountInfo(seasonPDA)` + `program.account.pixelState.fetchMultiple(pixelPDAs)` + `connection.getAccountInfo(betPDA)`. No mocked data. Parameterized with `initialSeasonNumber` (default 1), no hardcoded season in body. |
| DEP-03 | 05-01-PLAN.md | Round timing configurable via env var without code changes | SATISFIED | Oracle: `ROUND_DURATION_MINUTES` → `OracleConfig.cronSchedule` → `scheduler.ts`. Frontend: `NEXT_PUBLIC_ROUND_DURATION_SECONDS` → `constants.ts` → `useCountdown.ts`. Both read at runtime from env. |

**All 7 requirements satisfied.** No orphaned requirements found for Phase 5.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `oracle/src/chain.ts` | 504 | `throw new Error("_getCurrentSeasonNumber() must be provided by the caller")` in `_getCurrentSeasonNumber()` | Info | Intentional design — protected method exists as a hook for subclasses/tests; `openRoundForSeason` is the real API used by the lifecycle manager. Not a blocker. |

No TODO, FIXME, placeholder, or empty-return anti-patterns found in any phase-5 files.

---

### Human Verification Required

#### 1. place_bet Transaction on Devnet

**Test:** Connect Phantom or Solflare wallet (funded with devnet SOL) to the running app. Navigate to the active pixel round. Enter a bet amount and color, click Submit.
**Expected:** Transaction confirmed toast appears; BetAccount PDA (derived from season, pixelIndex, and player pubkey) is visible on Solana Explorer devnet with the correct data.
**Why human:** Requires live devnet program with an active round, funded wallet, and browser wallet extension. Static analysis confirms the code path is correct.

#### 2. claim_winnings Transaction on Devnet

**Test:** After an oracle-resolved round where the player's chosen color won, navigate to My Bets and click Claim (or Claim All).
**Expected:** `claimWinnings` transaction confirms on devnet; wallet SOL balance increases by the winning payout minus rake; bet entry shows as claimed.
**Why human:** Requires a resolved round with a matching winning bet — cannot simulate from static analysis.

#### 3. Live canvas and betting panel updates via WebSocket

**Test:** Open the app with a wallet connected. Have the oracle run `openRound` on devnet while observing the canvas. Then have the oracle run `resolveRound`.
**Expected:** The canvas pixel changes colour at resolution without a page refresh. The betting panel's countdown and pool sizes update as bets arrive. The betting panel shows "Locked" state 2 minutes before resolution.
**Why human:** Requires a live WebSocket connection to devnet and an active oracle driving round transitions. Cannot verify event-driven behaviour from static code.

---

### Gaps Summary

No gaps found. All five success criteria are satisfied:

1. `scripts/copy-idl.sh` propagates a single IDL to both frontend and oracle with one command — no manual steps required.
2. Every subsystem reads RPC URL, program ID, and round timing from environment variables. The root `.env.example` documents all variables for all three subsystems. No hardcoded mainnet URLs, no hardcoded `28 * 60_000` timing constants remain.
3. The `place_bet` transaction path is fully wired: `WalletProvider(NEXT_PUBLIC_SOLANA_RPC_URL)` → `ConnectionProvider` → `useAnchorProgram(idl.json, PROGRAM_ID)` → `usePlaceBet(.rpc())`. No mocks or stubs.
4. The `claim_winnings` transaction path is fully wired in `useClaimWinnings` with sequential `for...of` safety.
5. `useHeliusSocket` subscribes to real `onAccountChange` events for both PixelState and SeasonState PDAs, updates the Zustand store, and feeds the canvas and betting panel through the reactive render chain.

Three truths additionally require human runtime verification against live devnet to confirm end-to-end (wallet-signed transaction lands, SOL transfers, WS events render visually). These are expected for a devnet integration phase.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
