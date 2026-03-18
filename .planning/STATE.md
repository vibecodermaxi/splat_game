---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Completed 04-trust-layer-and-docs-05-PLAN.md (checkpoint: human verify Task 3)"
last_updated: "2026-03-18T13:25:25.888Z"
last_activity: 2026-03-17 — Roadmap created; 62 requirements mapped to 4 phases
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 21
  completed_plans: 21
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Players can place real-money bets on AI color choices with immediate, verifiable, on-chain resolution
**Current focus:** v1.0 complete — planning next milestone

## Current Position

Milestone v1.0 shipped 2026-03-18
All 4 phases, 21 plans complete
Status: Between milestones
Last activity: 2026-03-17 — Roadmap created; 62 requirements mapped to 4 phases

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-anchor-program P01 | 13 | 4 tasks | 17 files |
| Phase 01-anchor-program P02 | 4 | 2 tasks | 6 files |
| Phase 01-anchor-program P03 | 18 | 2 tasks | 6 files |
| Phase 01-anchor-program P04 | 6 | 2 tasks | 7 files |
| Phase 01-anchor-program P05 | 45 | 2 tasks | 7 files |
| Phase 01-anchor-program P06 | 30 | 2 tasks | 4 files |
| Phase 02-oracle-service P01 | 15 | 1 tasks | 4 files |
| Phase 02-oracle-service P01 | 30 | 2 tasks | 5 files |
| Phase 02-oracle-service P02 | 7 | 2 tasks | 10 files |
| Phase 02-oracle-service P03 | 525672 | 2 tasks | 4 files |
| Phase 02-oracle-service P05 | 4 | 2 tasks | 5 files |
| Phase 02-oracle-service P04 | 6 | 2 tasks | 3 files |
| Phase 02-oracle-service P06 | 45 | 2 tasks | 3 files |
| Phase 03-frontend-core P01 | 763 | 2 tasks | 16 files |
| Phase 03-frontend-core P02 | 7 | 2 tasks | 11 files |
| Phase 03-frontend-core P03 | 7 | 2 tasks | 15 files |
| Phase 03-frontend-core P04 | 3 | 2 tasks | 11 files |
| Phase 04-trust-layer-and-docs P01 | 20 | 2 tasks | 7 files |
| Phase 04-trust-layer-and-docs P04 | 32 | 2 tasks | 8 files |
| Phase 04-trust-layer-and-docs P02 | 4 | 2 tasks | 7 files |
| Phase 04-trust-layer-and-docs P03 | 35 | 2 tasks | 8 files |
| Phase 04-trust-layer-and-docs P05 | 8 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: Parimutuel over order book — simpler pool math, no liquidity requirements
- [Phase 1]: One color per pixel per player — forces commitment, no hedging
- [Phase 1]: No refunds, ever — prevents DDoS-for-refund attacks
- [Phase 1]: VRF fallback (not round cancellation) — rounds must always resolve; money at stake
- [Phase 2]: Temperature 0 (deterministic AI) — enables commit-reveal verifiability
- [Phase 3]: 60-second pool update cadence — prevents last-second copycat sniping (intentional, do not optimize away)
- [Phase 01-anchor-program]: anchor_lang::pubkey!() used for const Pubkeys in Anchor 0.32 (solana_program::pubkey! path removed)
- [Phase 01-anchor-program]: arweave_txid stored as [u8; 43] + has_arweave_txid: bool because InitSpace cannot handle Option<[u8; 43]>
- [Phase 01-anchor-program]: open_round accepts pixel_index N or N+1 (not CPI or separate instruction) — simplest approach for SC-17 future pixel betting
- [Phase 01-anchor-program]: start_season trusts admin for sequential ordering (no previous season check) — v1 simplicity, avoids optional account complexity
- [Phase 01-anchor-program]: oracle authorization via has_one = oracle on ConfigAccount (not a separate signer check)
- [Phase 01-anchor-program]: lock_round uses instruction args for seeds (season_number, pixel_index) to avoid self-referential PDA validation failure in Anchor 0.32
- [Phase 01-anchor-program]: advanceTime() calls svm.expireBlockhash() to prevent AlreadyProcessed errors in LiteSVM when same instruction is retried after time advance
- [Phase 01-anchor-program]: Direct lamport mutation (try_borrow_mut_lamports) for resolve_round rake transfer — PixelState is program-owned PDA, system_program::transfer requires system-owned sender
- [Phase 01-anchor-program]: correct_predictions incremented at claim time (not resolve time) — avoids unbounded compute at resolution when many winners
- [Phase 01-anchor-program]: Season completion tested with 2x1 grid (not 10x10) — validates completion logic without resolving 100 rounds
- [Phase 01-anchor-program]: Switchboard On-Demand v3 used for VRF instead of ORAO — manual account verification avoids SDK build issues with Anchor 0.32.1
- [Phase 01-anchor-program]: Switchboard RandomnessAccountData layout: discriminator[8]+queue[32]+seed[32]+expiration_slot[8]+value[64]; value all-zero=pending, non-zero=fulfilled
- [Phase 01-anchor-program]: LiteSVM AlreadyProcessed prevention: identical instruction bytes produce same tx sig; use distinct bet amounts for repeated same-player placeBet calls
- [Phase 01-anchor-program]: keys/ directory gitignored; operator must back up devnet treasury and jackpot keypairs out-of-band
- [Phase 01-anchor-program]: Anchor.toml [provider] cluster left as localnet; deployment uses --provider.cluster devnet flag to preserve local dev workflow
- [Phase 02-oracle-service]: set_arweave_txid uses instruction args for PDA seeds (same as lock_round) to avoid Anchor 0.32 self-referential PDA validation failure
- [Phase 02-oracle-service]: set_arweave_txid uses instruction args for PDA seeds (same as lock_round) to avoid Anchor 0.32 self-referential PDA validation failure
- [Phase 02-oracle-service]: Program<anchor.Idl> used instead of Program<PixelPredict> — PixelPredict type is outside oracle/src/ rootDir causing TS6059 and TS2589
- [Phase 02-oracle-service]: openRoundForSeason(seasonNumber, pixelIndex, promptHash) is the primary ChainClient API for the lifecycle manager (explicit season number, no hidden state)
- [Phase 02-oracle-service]: Template path is ../config/system-prompt.txt relative to oracle/src/ (__dirname in prompt.ts resolves to oracle/src/)
- [Phase 02-oracle-service]: @irys/upload-solana uses Builder(Solana).withWallet().withRpc().mainnet().build() — not new Irys({}) constructor
- [Phase 02-oracle-service]: sendRetryWarning takes pixelIndex param — message format requires it for meaningful alerts
- [Phase 02-oracle-service]: OracleContext._testHooks injection pattern: test mocks injected via optional field on context, not module-level override
- [Phase 02-oracle-service]: Switchboard SDK any cast: @switchboard-xyz/on-demand bundles anchor-31 with incompatible Program types; any cast bridges type mismatch at oracle boundary
- [Phase 02-oracle-service]: VRF duck-typed internals: resolveViaVrf accesses ChainClient.connection and oracleWallet via bracket notation to reuse established connection
- [Phase 02-oracle-service]: node-cron v4 schedule '0,30 * * * *' used for 30-minute round windows; recovery on startup reads pixelState.status and branches across null/Open/Locked/Resolved; Arweave upload wired into runRound as non-blocking catch-returns-null step
- [Phase 03-frontend-core]: Next.js 16 Turbopack by default: replaced webpack config with turbopack: {} block
- [Phase 03-frontend-core]: vitest @vitest-environment node annotation for @solana/web3.js tests (jsdom lacks Node crypto)
- [Phase 03-frontend-core]: Backpack wallet via Wallet Standard auto-discovery (no explicit adapter import needed)
- [Phase 03-frontend-core]: useAnchorWallet (not useWallet) required for Anchor Program instantiation
- [Phase 03-frontend-core]: CSS keyframe for tooltip animation instead of motion animate(): motion ObjectTarget type excludes opacity/scale on DOM elements
- [Phase 03-frontend-core]: Anchor AccountNamespace<Idl> requires (program.account as any) bracket cast for camelCase account names in fetchMultiple
- [Phase 03-frontend-core]: useHeliusSocket receives explicit pixelPDA/seasonPDA/seasonNumber props instead of reading store internally
- [Phase 03-frontend-core]: @testing-library/jest-dom added for toBeDisabled/toHaveClass matchers in vitest
- [Phase 03-frontend-core]: BettingPanel selectedColor-as-button-background: selected color IS the Place Bet button background (FE-05 user decision)
- [Phase 03-frontend-core]: useResolution uses prevStatusRef to detect one-shot status->resolved transition — avoids infinite re-trigger if resolved state persists
- [Phase 03-frontend-core]: clearForNewRound fires after 2.5s delay — allows full animation stack (burst 200ms + glow 500ms + notification 2.6s) to complete
- [Phase 03-frontend-core]: ResolutionAnimation overlay positioned via CSS calc() ratio math without DOM measurements — SSR-safe, no layout-thrashing getBoundingClientRect
- [Phase 04-trust-layer-and-docs]: PixelTooltip width increased from 160 to 200 to accommodate proof data without overflow
- [Phase 04-trust-layer-and-docs]: Prompt commitment proof language: use 'prompt commitment proof' language, never 'reproducible result'
- [Phase 04-trust-layer-and-docs]: Arweave txid decoded client-side via String.fromCharCode from [u8; 43] byte array (matches oracle encode logic)
- [Phase 04-trust-layer-and-docs]: All fairness copy uses prompt commitment proof language — never reproducible result (per user decision)
- [Phase 04-trust-layer-and-docs]: DocsLayout uses usePathname() for active nav highlight — avoids prop drilling current page through all pages
- [Phase 04-trust-layer-and-docs]: drag=y on handle div only in MyBetsDrawer to prevent scroll-drag conflict
- [Phase 04-trust-layer-and-docs]: claimAll uses sequential for...of (not Promise.all) — all claims write same PlayerSeasonStats PDA
- [Phase 04-trust-layer-and-docs]: ShareCanvas uses inline hex styles not CSS variables — html-to-image may not resolve CSS custom properties in offscreen elements
- [Phase 04-trust-layer-and-docs]: navigator.canShare guard with files arg before navigator.share — desktop Chrome supports text/url sharing but not file sharing
- [Phase 04-trust-layer-and-docs]: WalletDisconnectBanner uses prevConnectedRef to detect only true->false transitions — banner does not appear on initial page load when not connected
- [Phase 04-trust-layer-and-docs]: OnboardingTour targets id='game-canvas', id='betting-panel', id='splat-header' elements via getBoundingClientRect for tooltip positioning
- [Phase 04-trust-layer-and-docs]: WalletContextState mock requires autoConnect field — use as any cast in tests to avoid maintenance burden as wallet adapter types evolve

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: VRF provider selection unresolved — Switchboard vs Pyth Entropy; Anchor 0.32 CPI compatibility must be verified before Phase 1 kickoff. Run /gsd:research-phase on this.
- [Phase 3]: @solana/kit version pinning ambiguous — 3.0.3 on npm vs 5.0.0 in Solana tested reference. Verify before Phase 3 kickoff.

## Session Continuity

Last session: 2026-03-18T12:07:20.794Z
Stopped at: Completed 04-trust-layer-and-docs-05-PLAN.md (checkpoint: human verify Task 3)
Resume file: None
