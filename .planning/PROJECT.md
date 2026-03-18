# Pixel Predict

## What This Is

A prediction market game on Solana where players bet on the color choices of an AI artist. The AI paints a 10x10 canvas one pixel at a time, choosing from 16 colors every 30 minutes. Players connect Solana wallets and wager on the next color pick — winners split the betting pool for that round. A complete canvas (~50 hours, 100 rounds) constitutes one season, after which a new canvas begins and the AI carries forward a style memory.

## Core Value

Players can place real-money bets on AI color choices with immediate, verifiable, on-chain resolution — the intersection of gambling, art, and prediction that makes each 30-minute round genuinely exciting.

## Requirements

### Validated

- ✓ Anchor smart contract with round lifecycle (open, bet, lock, resolve, claim) — v1.0
- ✓ Parimutuel betting on 16 colors with 5% rake (3% treasury, 2% jackpot) — v1.0
- ✓ Oracle service that constructs AI prompts, commits hashes, calls Claude API, and resolves rounds — v1.0
- ✓ Commit-reveal verifiability (SHA-256 prompt hash pre-committed, full prompt published post-resolution) — v1.0
- ✓ Failure cascade (retries → delay → VRF fallback, no refunds) — v1.0
- ✓ Season lifecycle (start, 100 rounds, completion, 12-hour intermission, new season) — v1.0
- ✓ Next.js frontend with real-time 10x10 canvas, betting panel, countdown timer — v1.0
- ✓ Wallet integration (Phantom, Solflare, Backpack) — v1.0
- ✓ Color shade/warmth rendering system for visual richness — v1.0
- ✓ Resolution animations and celebration effects — v1.0
- ✓ My Bets panel with claim functionality — v1.0
- ✓ Season completion screen with share-as-PNG — v1.0
- ✓ How to Play in-app explainer — v1.0
- ✓ Docs site (rules, AI artist explanation, fairness/verification) — v1.0
- ✓ Mobile-first, video-game-casual aesthetic (dark background, chunky UI, micro-animations) — v1.0
- ✓ Helius WebSocket subscriptions for live pool updates with polling fallback — v1.0
- ✓ Bet constraints enforced on-chain (min 0.01 SOL, max 10 SOL/color/pixel, one color per pixel per player) — v1.0
- ✓ Player season stats tracking (bets, volume, correct predictions) — v1.0
- ✓ Multi-pixel betting (bet on future pixels before their round opens) — v1.0

### Active

(None yet — define for next milestone)

### Out of Scope

- Jackpot mechanic activation — accrues from day one but trigger TBD for v2
- NFT minting (common, signed, original tiers) — v2
- Leaderboard (per-season and all-time) — v2
- Blinks/Solana Actions for shareable betting links — v2
- Season gallery (historical canvases) — v2
- Advanced analytics (AI pattern analysis, heatmaps) — v2
- Social features (chat, bet sharing, reactions) — v2
- Exact-shade side bets — v2
- Grid scaling beyond 10x10 — v2
- Referral system — v2
- Push/email notifications — v2
- Admin dashboard — v2

## Context

Shipped v1.0 with ~13,000 LOC across three subsystems:
- **Anchor program** (1.4K Rust): On-chain state machine with SeasonState, PixelState, BetAccount, PlayerSeasonStats accounts. Parimutuel math, commit-reveal, VRF fallback via Switchboard On-Demand v3.
- **Oracle service** (3.2K TypeScript): Node.js keeper on Railway, cron-triggered every 30 minutes. Claude API at temperature 0, Arweave prompt archival via Irys, failure cascade with retry/delay/VRF.
- **Frontend** (8.5K TypeScript/React): Next.js 16 App Router on Vercel. Helius WebSocket subscriptions, Zustand state, motion animations, html-to-image for PNG share.

Infrastructure: Vercel (frontend), Railway (oracle), Helius (RPC + WebSockets), Solana devnet (program). Estimated monthly cost at launch: ~$30-100.

Display font: Luckiest Guy. Body font: Nunito. Dark Void aesthetic (#14141f).

## Constraints

- **Tech stack**: Anchor (Rust) for Solana program, Node.js for oracle, Next.js (App Router) for frontend
- **Hosting**: Vercel (frontend), Railway (oracle), Helius (RPC)
- **AI model**: Claude at temperature 0 — deterministic output is non-negotiable for verifiability
- **Round timing**: Fixed 30-minute cycle (28 min betting + 2 min lockout)
- **Grid size**: 10x10 for v1 (100 pixels per season)
- **No refunds**: By design — refund logic creates perverse incentives (DDoS-for-refund)
- **Mobile-first**: Primary usage on phones; all interactions must work with thumb-reach tap targets

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Parimutuel over order book | No liquidity requirements, simple pool math, accessible to casual players | ✓ Good |
| One color per pixel per player | Forces commitment, creates meaningful decisions, prevents hedging | ✓ Good |
| Temperature 0 (deterministic AI) | Enables full verifiability — anyone can reproduce the result | ✓ Good |
| No refunds, ever | Prevents DDoS-for-refund attacks, simplifies contract logic | ✓ Good |
| VRF fallback over round cancellation | Rounds must always resolve; real money at stake | ✓ Good |
| Shade/warmth visual-only modifiers | Rich artwork from 16 betting outcomes without complicating bet resolution | ✓ Good |
| Season style memory (2-sentence summary) | AI develops evolving aesthetic without full history; human-curated editorial input | ✓ Good |
| 60-second pool update cadence | Prevents last-second copycat sniping while keeping odds reasonably fresh | ✓ Good |
| Luckiest Guy display font | Playful, game-like feel that matches the hyper-casual aesthetic | ✓ Good |
| Sequential claim transactions | All claims write same PlayerSeasonStats PDA — parallel would cause account-in-use errors | ✓ Good |
| "Prompt commitment proof" language | More honest than "reproducible result" — users can't run Claude themselves | ✓ Good |
| html-to-image over html2canvas | Better CSS variable and font handling for branded PNG share | ✓ Good |

---
*Last updated: 2026-03-18 after v1.0 milestone*
