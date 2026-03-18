# Project Research Summary

**Project:** Splat (Pixel Predict)
**Domain:** Solana parimutuel prediction market game with AI oracle and generative art canvas
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH (stack HIGH, pitfalls HIGH, architecture MEDIUM, features MEDIUM)

## Executive Summary

Splat is a novel class of on-chain game: a parimutuel betting game where players wager on which of 16 colors an AI (Claude, temperature 0) will choose for each cell on a 10x10 pixel canvas. The product fuses crypto game mechanics (Solana smart contracts, wallet-based identity, transparent fund custody) with an emerging narrative layer (an AI "artist" that develops aesthetic preferences across seasons). Expert builders in this space ground the trust model in commit-reveal cryptography rather than operator reputation — the oracle commits a SHA-256 hash of its prompt before bets close, then reveals the full prompt at resolution, so players can verify the input was fixed before they bet. This is the defining trust primitive of the product, and every other design decision flows from it.

The recommended approach is a three-layer architecture: an Anchor/Rust smart contract on Solana mainnet handling fund custody and round lifecycle, a Node.js oracle service on Railway handling Claude API calls and on-chain instruction signing, and a Next.js 16 App Router frontend on Vercel consuming account state via Helius WebSocket. The component dependency chain is strict — program first (all else depends on its IDL), oracle second, frontend third. The Anchor program is the most consequential piece of work: parimutuel payout arithmetic in integer Rust is non-obvious and exploitable if done wrong, and the oracle authority signer check is a known attack surface.

The two dominant risks are a financial exploit (integer overflow or division-order error in payout math) and a trust collapse (claiming temperature-0 determinism that Anthropic explicitly does not guarantee). Both risks are well-understood and preventable with specific coding patterns, but they must be addressed in the program development phase — retrofitting correct arithmetic after launch requires an on-chain program upgrade. The VRF fallback (Switchboard or Pyth Entropy) should be designed as an interface stub in v1 and activated in a follow-up deployment; it cannot be an afterthought because the on-chain instruction must accept either oracle or VRF resolution from day one.

## Key Findings

### Recommended Stack

The stack is modern and well-defined. Anchor 0.32.1 (Rust CLI + `@coral-xyz/anchor` TypeScript client, pinned to same minor version) is the unambiguous choice for Solana program development. The frontend uses Next.js 16 (App Router, Turbopack default, React 19.2) with `@solana/kit` 3.x and `@solana/react-hooks` 1.1.0 for wallet integration — the newer hooks layer auto-discovers Wallet Standard wallets (Phantom, Solflare, Backpack) without explicit adapter lists. The oracle service is a Node.js always-on Railway process using `@anthropic-ai/sdk` 0.78.0. Client-side state splits cleanly: Zustand 5 for UI state (canvas, betting panel, countdown), TanStack Query 5 for on-chain polling fallback when WebSocket drops.

**Core technologies:**
- Anchor 0.32.1 (Rust + TypeScript client): Solana program framework — de-facto standard; IDL generates typed TS client automatically
- Next.js 16 / React 19.2: Frontend — Turbopack default, App Router, Server Components for static pages
- `@solana/kit` 3.x + `@solana/react-hooks` 1.1.0: Solana JS SDK and wallet hooks — tree-shakeable, Wallet Standard auto-discovery
- `@anthropic-ai/sdk` 0.78.0: Claude API client for oracle service — temperature 0, typed responses, automatic retry
- Helius SDK 2.2.2: RPC + WebSocket (`accountSubscribe`) — rewrote internals on `@solana/kit`; do not mix with web3.js v1
- Zustand 5 + TanStack Query 5: State management split — Zustand owns UI state, TanStack Query owns on-chain/server state
- Tailwind CSS 4: Styling — CSS-first config (no `tailwind.config.js`), dark-mode via cascade layers
- `motion` 12.x: Animation — formerly Framer Motion; use `motion` package name for new projects

Critical version constraint: `@coral-xyz/anchor` TypeScript client and Anchor CLI must match at major.minor (0.32.x) or IDL serialization silently diverges. Next.js 16 requires Node 20.9+; verify Railway and Vercel runtime settings.

### Expected Features

The full feature analysis is in `.planning/research/FEATURES.md`. Summary of prioritization:

**Must have (table stakes for v1 launch):**
- Wallet connect (Phantom/Solflare/Backpack) — prerequisite for all betting interactions
- 10x10 canvas with active pixel highlight and shade/warmth HSL rendering — the product's visual identity
- 16-color betting panel with pool odds, multipliers, and countdown timer synced to on-chain `opened_at`
- Bet placement with min/max enforcement, transaction confirmation ("Splatted!"), and lockout state (2 min before resolution)
- Round resolution animation (color flood + win/loss notification) — the emotional payoff moment
- My Bets panel with claim winnings button — surfacing unclaimed wins is a trust issue
- Player season stats (hit rate, volume) — personal performance identity drives retention
- Season completion screen with share-as-PNG — the primary organic distribution mechanism
- Commit-reveal display (prompt hash + published prompt) — the anti-rug trust differentiator
- VRF fallback with visual pixel flag — honesty about AI failure is a feature
- How to Play in-app explainer and mobile-first layout
- Jackpot balance display (accruing teaser, mechanic deferred to v2)

**Should have (add post-launch, v1.x):**
- Multi-pixel betting UI — on-chain already supports it; build UI after baseline betting patterns are understood
- AI reasoning tooltip on resolved pixels — adds meta-game at low engineering cost after prompt publication works
- Round history feed — context for reading AI patterns

**Defer to v2+:**
- Leaderboard, NFT minting, jackpot mechanic activation, Blinks/Solana Actions, season gallery, social features, exact-shade side bets, push/email notifications, admin dashboard

**Anti-features to avoid:** Real-time pool updates (enables copycat sniping — 60s cadence is intentional), refunds on round failure (DDoS-for-refund attack), multiple colors per pixel (kills commitment mechanic), in-app chat (moderation burden).

### Architecture Approach

The architecture is a strict three-layer system: Anchor program (fund custody and state machine) → Oracle keeper (Claude API + chain writes) → Frontend (reads + user-signed writes). The Helius RPC layer sits between frontend and program, providing both HTTP JSON-RPC and `accountSubscribe` WebSocket. A polling fallback (30-second `getAccountInfo`) activates when WebSocket drops or goes silent for >10 seconds. The oracle is intentionally stateless — `round_history.json` (last 5 rounds for AI context) is the only persistent state and is treated as ephemeral, not a source of truth.

**Major components:**
1. Anchor Program — round lifecycle state machine, fund custody in PDA vaults, payout math, 8 instructions (initialize_season, open_round, lock_round, commit_prompt_hash, place_bet, resolve_round, claim_winnings, start_next_season)
2. Oracle Service (Railway, always-on) — builds Claude prompts, commits hash, calls Claude at temperature 0, resolves rounds on-chain, handles failure cascade to VRF, writes round_history.json
3. Frontend (Next.js, Vercel) — Canvas + BettingPanel + CountdownTimer + MyBets as client components; wallet provider in `app/providers.tsx`; hooks encapsulate all blockchain I/O (`useRoundState`, `usePlayerBets`, `useSeasonState`)
4. Helius RPC — WebSocket `accountSubscribe` for live account updates; polling fallback managed in `lib/helius-ws.ts`
5. PDAs — SeasonState (season-level), PixelState (per pixel, holds 16 color pools + committed hash + resolved color), BetAccount (per player per pixel), RoundVault (SOL custody), PlayerSeasonStats (per player per season)

Key architectural decision: pool odds refresh at 60-second cadence regardless of WebSocket event frequency — this is intentional to prevent last-second copycat sniping and must not be "optimized" away.

### Critical Pitfalls

Full analysis in `.planning/research/PITFALLS.md`. Top 5 ordered by severity and phase relevance:

1. **Integer division order in payout math** — `player_bet / winning_color_pool` executes first in naive implementation, truncating to zero for small bets. Prevention: always multiply before dividing (`player_bet * total_pool * 95 / (winning_color_pool * 100)`); use u128 for intermediates; use `checked_mul`/`checked_div` everywhere; add table-driven tests with 1-lamport bets before any on-chain testing.

2. **Missing signer check on oracle instructions** — `has_one` checks pubkey equality but not whether the account signed. Wormhole lost $320M this way. Prevention: declare oracle as `Signer<'info>` in Anchor accounts struct (not `AccountInfo`); also add `constraint = oracle.key() == season.oracle_pubkey`.

3. **Temperature 0 is not deterministic** — Anthropic explicitly documents this. Players trying to reproduce results will sometimes get different outputs, triggering fraud accusations. Prevention: reframe the guarantee as "commit-reveal proves the prompt was fixed before betting closed" — not "you can reproduce the exact result." Nail this language before any copy goes live.

4. **Oracle private key is a single catastrophic failure point** — if compromised, all active pools can be drained. Prevention: dedicated keypair with minimal SOL balance, Railway encrypted secrets (not plain env var), separate upgrade authority (cold key), documented rotation procedure.

5. **Zero-winner rounds strand funds permanently** — if no player bets the winning color, the 95% net pool has nowhere to go with no on-chain instruction to sweep it. Prevention: in `resolve_round`, check `winning_color_pool == 0` and transfer net pool to treasury in the same instruction.

Honorable mention: Railway cron is unreliable for financial round timing (up to 90s delay, intermittent misses). Use in-process `setInterval`/`node-cron` inside an always-on Railway process; Railway native cron is an optional backup, not the primary trigger.

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and the pitfall-to-phase mapping from PITFALLS.md, the build order must follow component dependencies strictly: program before oracle before frontend.

### Phase 1: Anchor Program Foundation

**Rationale:** Everything else depends on the deployed program and its IDL. The oracle needs the program address and instruction signatures to function; the frontend needs IDL types to interact safely. The program's security properties — payout math, signer checks, zero-winner handling — must be correct before any money touches it. This is the highest-risk phase with the longest blast radius for errors.

**Delivers:** Deployed Anchor program on devnet (and eventually mainnet) with all 8 instructions, 5 PDA types, and full test coverage for financial arithmetic and security constraints.

**Addresses features:** Bet placement (on-chain), round lifecycle (open/lock/resolve), claim winnings, season management, parimutuel math, commit-reveal infrastructure, VRF fallback interface stub.

**Must avoid:**
- Pitfall 2: Integer division order in payout math (test before devnet)
- Pitfall 5 (PITFALLS.md numbering): Missing signer check on oracle instructions
- Pitfall 5 (zero-winner stranded funds): Add sweep branch in `resolve_round`
- Pitfall 5 (`init_if_needed` reinitialization): Add `initialized` flag on BetAccount

**Research flag:** NEEDS research-phase — Switchboard VRF CPI integration with Anchor 0.32 requires verified API docs before implementation.

### Phase 2: Oracle Service

**Rationale:** Oracle depends on deployed program IDL. Can be developed in parallel with late-stage program work once the IDL is stable, but cannot be fully tested until the program is on devnet. Key decisions (Railway in-process scheduler, key management, Claude prompt structure) can be made earlier.

**Delivers:** Running Node.js service on Railway that completes the full round lifecycle: lock → commit hash → call Claude → resolve on-chain → write round_history.json. Includes failure cascade to VRF fallback, manual trigger endpoint, and Helius webhook alerting.

**Uses:** `@anthropic-ai/sdk` 0.78.0 (temperature 0), `@coral-xyz/anchor` TypeScript client, Helius SDK 2.2.2, `node-cron` (in-process, not Railway cron), SHA-256 commit-reveal logic.

**Must avoid:**
- Pitfall 4: Railway cron unreliability — use always-on process with internal scheduler
- Pitfall 3: Oracle key stored in plain env var — use Railway encrypted secrets
- Pitfall 1: Temperature-0 non-determinism claims — fairness language must match actual guarantee

**Research flag:** STANDARD PATTERNS — Node.js cron services and Anthropic SDK integration are well-documented. Skip research-phase for core oracle logic. Needs VRF fallback research from Phase 1.

### Phase 3: Frontend Core (Game Loop)

**Rationale:** Frontend depends on IDL (from Phase 1) and benefits from a live oracle (Phase 2) for integration testing, though UI can be developed against mocked oracle state. This phase delivers the complete betting loop that players experience: canvas, betting panel, countdown, resolution animation, my bets, claim.

**Delivers:** Playable game loop: connect wallet → view live 10x10 canvas → place bet on active color → watch countdown → see round resolve with animation → claim winnings from My Bets panel. Mobile-first at 375px.

**Implements:** Canvas (CSS Grid with HSL shade/warmth rendering), BettingPanel (16 colors, pool odds at 60s cadence, amount input), CountdownTimer (client-side from `opened_at`, not from WebSocket events), MyBets/Claim, round resolution animation via `motion` 12.x. Real-time layer via Helius WebSocket + polling fallback in `lib/helius-ws.ts`.

**Must avoid:**
- Pitfall 6: WebSocket unreliability — polling fallback must be implemented from day one, not as a follow-up
- Pool odds updated at 60s cadence intentionally; do not add sub-second refresh
- Countdown derived from `opened_at` chain timestamp, never from WebSocket events
- Wallet connection prompt only at bet placement, not on page load (show canvas/odds freely)

**Research flag:** STANDARD PATTERNS — Next.js 16 App Router + @solana/react-hooks is well-documented; Helius WebSocket patterns are in official docs. Skip research-phase.

### Phase 4: Trust Layer and Season Completion

**Rationale:** The commit-reveal display, VRF visual flag, player season stats, and season completion share-as-PNG are differentiated features that build trust and drive organic distribution. They depend on the core game loop (Phase 3) being working and require the season to run for at least one complete cycle.

**Delivers:** Verifiability UI (prompt hash + published prompt display), VRF pixel visual distinction on canvas, player season stats in My Bets panel, season completion screen with share-as-PNG export (1200x630 Twitter card), jackpot balance teaser, How to Play in-app explainer, docs site.

**Uses:** `dom-to-image-more` for PNG export, `html2canvas` fallback, player season stats PDA reads, VRF resolved flag from PixelState.

**Must avoid:**
- Pitfall 1 (Temperature 0): All commit-reveal copy must use "prompt commitment proof" language, not "reproducible result" language — review all docs before publish
- PNG export only uses Canvas API (not CSS Grid DOM export) for correct cross-browser rendering

**Research flag:** STANDARD PATTERNS for PNG export. May need brief spike on `dom-to-image-more` + Next.js 16 compatibility (SSR boundary for canvas operations).

### Phase 5: Post-Launch v1.x Enhancements

**Rationale:** Features that add strategic depth but require player behavior data to design correctly. Multi-pixel betting UI is the highest-value addition once baseline betting patterns are observed. AI reasoning tooltips are low-cost and add meta-game engagement.

**Delivers:** Multi-pixel betting UI (browse future pixels, manage pending bets, distinguish active vs pending), AI reasoning display on resolved pixel tooltips, round history feed, session persistence improvements.

**Must avoid:** Building multi-pixel betting UI before core loop is validated — the UI complexity is high and on-chain support already exists, so this is purely a UI design problem that's easier to solve with real player data.

**Research flag:** Multi-pixel betting UI needs design research (player mental models for "pending" vs "active" bets). Other items are standard patterns.

### Phase Ordering Rationale

- **Program before oracle:** Oracle needs IDL + deployed program address. No shortcuts.
- **Oracle before full frontend:** Frontend integration tests need a real oracle. UI can be mocked during development but must test against live oracle before launch.
- **Trust layer after game loop:** Players need to experience the betting loop before verifiability display has meaning. The features reinforce the core, they don't enable it.
- **VRF fallback interface stubbed in Phase 1, activated in Phase 2:** The on-chain program must accept VRF resolution from day one to avoid redeployment. The oracle-side VRF integration is Phase 2 work.
- **Season completion after one full season:** The PNG export feature is only testable and meaningful after a season completes. Phase 4 timing should align with first season completion milestone.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 1 (Switchboard VRF CPI):** VRF CPI integration with Anchor 0.32 requires verified API surface and account setup documentation before implementation. Pyth Entropy is the alternative — verify which has better Anchor 0.32 compatibility.
- **Phase 5 (Multi-pixel betting UX):** No standard pattern for "pending future round bets" in a parimutuel betting UI — needs user flow design research.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Oracle service core):** Node.js + Anthropic SDK + node-cron is well-documented.
- **Phase 3 (Frontend core):** Next.js 16 App Router + @solana/react-hooks is official Solana docs; Helius WebSocket patterns are documented.
- **Phase 4 (Trust layer + PNG export):** Commit-reveal display is straightforward. `dom-to-image-more` is a known library — brief compatibility spike only.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major versions verified against official docs, npm registry, and official announcements. One medium-confidence caveat: `@solana/kit` version number in Solana's official nextjs-solana doc shows two version numbers (3.0.3 on npm vs 5.0.0 in tested set reference); verify before pinning. |
| Features | MEDIUM | Project-specific features derived from SPEC.md and SPLAT_BRAND_IDENTITY.md (HIGH confidence). Competitor comparisons are from training data through August 2025, not live-verified. |
| Architecture | MEDIUM | Core patterns (PDA design, commit-reveal, invoke_signed vault) verified against official Solana docs (HIGH). Oracle + frontend integration patterns are well-established. VRF fallback architecture is MEDIUM confidence — Switchboard VRF async callback pattern needs verified docs during Phase 1. |
| Pitfalls | HIGH | Critical pitfalls verified against official docs, security audit literature, and documented exploits. Temperature-0 non-determinism sourced from Anthropic's own documentation. Payout arithmetic pattern sourced from Solana arithmetic best practices. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **`@solana/kit` version pinning:** Two version numbers appear in circulation (3.0.3 on npm vs 5.0.0 in Solana's tested reference set). Verify exact version from Solana's official nextjs-solana documentation before Phase 3 kickoff.
- **VRF provider selection (Switchboard vs Pyth Entropy):** Both are viable. The choice matters because Anchor CPI integration details differ. Validate Anchor 0.32 CPI compatibility with whichever provider is selected before starting Phase 1 VRF stub implementation.
- **Railway always-on process billing:** Switching from Railway cron (container start/stop per execution) to an always-on process affects billing. Verify Railway's current pricing for always-on vs cron services before infrastructure setup.
- **`dom-to-image-more` + Next.js 16 compatibility:** The library uses DOM APIs incompatible with SSR. Confirm it works correctly as a client-side-only import behind a `'use client'` boundary in Next.js 16's Turbopack build before committing to it in Phase 4.
- **Competitor landscape (March 2026):** Feature research was based on training data through August 2025. Recommend spot-checking any Solana-native betting or generative art games that launched between August 2025 and now before finalizing the differentiation narrative.

## Sources

### Primary (HIGH confidence)
- Anchor Releases GitHub — confirmed 0.32.1 as latest stable
- anchor-lang.com TypeScript Client docs — IDL generation and `@coral-xyz/anchor` usage
- Solana Next.js Integration Guide (solana.com/docs/frontend/nextjs-solana) — @solana/react-hooks, @solana/client, @solana/kit tested set
- Next.js 16 Blog Post (nextjs.org/blog/next-16) — release date, Turbopack, React 19.2, Node 20.9+ requirement
- Helius SDK GitHub — v2.2.2 published; v2 rewrote to use `@solana/kit`
- Helius WebSocket Docs — subscription method names confirmed
- Program Derived Addresses — Official Solana Docs
- Helius: A Hitchhiker's Guide to Solana Program Security
- Helius: Solana Arithmetic Best Practices
- Anthropic official glossary on temperature determinism
- RareSkills: init_if_needed Reinitialization Attack
- ImmuneBytes: Compromised Private Key Crypto Hacks
- Solana: Storing SOL in a PDA — Official Guide
- Solana: Connecting to Off-Chain Data course (oracles)

### Secondary (MEDIUM confidence)
- Building a Prediction Market on Solana with Anchor (dev.to) — architecture patterns
- Switchboard VRF on Solana (Medium) — VRF async callback pattern
- QuillAudits: Solana Prediction Market Security Tradeoffs
- @anthropic-ai/sdk npm — 0.78.0 latest
- Tailwind CSS v4 Blog — stable Jan 2025, CSS-first config
- Zustand GitHub Releases — 5.0.12 latest
- @tanstack/react-query npm — 5.90.21 latest
- motion.dev — Motion 12.x, React 19 support confirmed
- Railway Cron Docs — 5-minute minimum, reliability caveats
- Pyth Entropy Docs — commit-reveal VRF fallback option
- Project spec files: `/Users/puranjaysingh/Documents/Claude2026/splat/SPEC.md`, `SPLAT_BRAND_IDENTITY.md`, `.planning/PROJECT.md`

### Tertiary (LOW confidence)
- OpenTote Parimutuel Protocol on Solana — architecture reference (marketing page only)
- Prediction market platform comparisons (Polymarket, Drift) — training data through August 2025, not live-verified; validate before finalizing differentiation narrative

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
