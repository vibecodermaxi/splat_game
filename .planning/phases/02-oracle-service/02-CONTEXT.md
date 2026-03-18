# Phase 2: Oracle Service - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Autonomous Node.js process on Railway that drives the 30-minute round lifecycle: constructs AI prompts from canvas state, commits SHA-256 hashes on-chain, calls Claude API at temperature 0, resolves rounds on-chain, uploads prompts to Arweave, and fails over to Switchboard VRF when Claude is unavailable. Maintains local round history for prompt construction.

</domain>

<decisions>
## Implementation Decisions

### Scheduling Model
- In-process node-cron for round timing (not Railway native cron — 5-min minimum is too slow for the 2-min lockout phase)
- Always-on Railway process
- Recovery strategy: Claude's discretion (chain state vs local checkpoint — implementation picks the best approach)
- N+1 pixel pre-opening: Claude's discretion on exact implementation

### Claude API Configuration
- Model: Claude Sonnet (not Haiku) — better art quality justifies ~$48/month over ~$15/month
- Temperature: 0 (non-negotiable — deterministic for verifiability)
- System prompt loaded from a config/template file (not hardcoded) — operator can tweak artistic direction between seasons without redeploying
- Season style summary provided via `SEASON_STYLE_SUMMARY` env var — operator sets it before starting a new season
- Response parsing must validate: color is one of 16, shade 0-100, warmth 0-100
- REASONING field captured and stored in round_history.json for next prompt construction

### Arweave Integration
- Upload timing: after resolve (resolve on-chain first, then upload prompt to Arweave, then write arweave_txid back on-chain in a separate transaction)
- Upload method: Irys (formerly Bundlr) — instant uploads, pay with SOL, ~$0.001/upload
- Arweave failure handling: Claude's discretion (retry-then-skip vs block — implementation decides gracefully)

### Monitoring & Alerts
- Telegram bot for push notifications
- Alert events (all four):
  1. Round resolution failure (Claude API failed, entering retry cascade)
  2. VRF fallback triggered (AI completely unavailable)
  3. Round resolved successfully (every round posts color + stats)
  4. Process restart (crash recovery, Railway redeploy)
- Structured JSON logging for Railway log search
- Each round = one JSON log entry with all fields (pixel, color, shade, warmth, timing, pool size)

### Claude's Discretion
- Recovery strategy on process restart (chain state vs local checkpoint)
- N+1 pixel pre-opening logic (always vs skip-on-last-pixel)
- Arweave failure handling approach
- How arweave_txid is written back on-chain (separate instruction or update to PixelState)
- Node.js project structure and module organization
- Error handling patterns and retry backoff curves

</decisions>

<specifics>
## Specific Ideas

- The spec defines the exact system prompt and per-round user message format — use these as the template, loaded from a config file
- Prompt includes: full canvas state, current pixel coordinates, neighbors, last 5 selections with reasoning
- AI does NOT receive: bet volumes, popular colors, win rates, odds info
- Failure cascade is strict: 3 retries at 30s → delay state retrying every 5 min for 30 min → Switchboard VRF fallback
- round_history.json is the only local state — if lost, reconstructable from chain (minus reasoning text)
- The oracle keypair is stored in `ORACLE_KEYPAIR` env var (JSON array format per spec)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- IDL at `target/idl/pixel_predict.json` — TypeScript client can be generated from this
- Program ID: `FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG`
- Test helpers in `tests/helpers.ts` — PDA derivation functions, keypair utilities

### Established Patterns
- Oracle authorization via `has_one = oracle` on ConfigAccount — oracle must sign with the key stored in config PDA
- `open_round` accepts pixel_index N or N+1 (pre-opening for future betting)
- `resolve_round` expects: winning_color (u8), shade (u8), warmth (u8), vrf_resolved (bool)
- `resolve_round_vrf` is a separate instruction for VRF fallback path
- Arweave txid stored as `[u8; 43]` + `has_arweave_txid: bool` on PixelState

### Integration Points
- Oracle calls: open_round, lock_round, resolve_round, resolve_round_vrf
- Oracle reads: SeasonState (current_pixel_index), PixelState (all resolved pixels for canvas state)
- Switchboard VRF: program ID `RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh`
- Helius RPC for chain reads (env: SOLANA_RPC_URL)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-oracle-service*
*Context gathered: 2026-03-17*
