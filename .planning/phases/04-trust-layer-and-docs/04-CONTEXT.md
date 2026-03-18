# Phase 4: Trust Layer and Docs - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship-ready features that complete the product: bet history with claims, commit-reveal verification display, season completion flow, error resilience, and in-app documentation. After this phase, the game is ready for mainnet launch — a player can bet, verify fairness, track their history, claim winnings, celebrate season completion, and understand how everything works.

</domain>

<decisions>
## Implementation Decisions

### My Bets & Claims
- Slide-up bottom drawer over game page — player stays in context, canvas still visible behind
- Triggered via "Bets" button in the header bar (next to wallet connect)
- Compact stats bar at top of drawer: bets placed, wins, hit rate, volume — always visible
- Bet list below stats: active bets, resolved (won/lost), claimable winnings
- Individual "Claim" button per winning bet + sticky "Claim All" button at bottom when multiple are claimable
- Claim All batches into a single transaction

### Season Completion & Share
- Full-screen takeover celebration when final pixel resolves: canvas zooms to fill screen, confetti burst, season stats overlay
- Share PNG: branded frame with dark border — "Pixel Predict — Season X" at top, 10x10 canvas centered, player stats at bottom (bets, wins, hit rate), site URL
- 12-hour intermission screen: big countdown to next season, completed canvas on display, season stats summary (rounds, total bets, total pool), Share and View Canvas buttons
- Most recent season canvas only — season gallery is v2

### Commit-Reveal & Verification Display
- Accessible via pixel detail tap (extend existing PixelTooltip) — tap resolved pixel → see color/shade/warmth + "Verified fair" badge + expandable proof section
- Default: casual language ("The AI's pick was locked before bets opened")
- Expand to see: commitment hash, prompt text excerpt, Arweave link
- VRF-resolved pixels: subtle colored dot in corner of pixel cell on canvas; tooltip explains "Resolved via random fallback"
- All copy uses "prompt commitment proof" language — never "reproducible result" (the AI output IS deterministic via temp 0, but users can't run Claude themselves, so "commitment" is more honest)

### Docs Site
- In-app pages as Next.js routes (/how-it-works, /ai-artist, /rules, /fairness, /faq)
- Accessed via [?] button in header bar
- Tone: casual gamer — short sentences, direct language, game metaphors, not a whitepaper
- Fairness & Verification page: layered depth — 3-sentence casual explanation first, expandable "nerdy version" with SHA-256 details, Arweave links, verification steps
- First-time onboarding: dismissable 3-4 step tooltip tour pointing at canvas, betting panel, timer. Shows once per device (localStorage flag), never again

### Error Handling & Edge Cases
- Jackpot balance visible with "Coming soon" label (FS-11)
- Failed transactions: clear error message with retry button (FS-12)
- Wallet disconnect mid-session: recovery state with reconnect prompt (FS-13)

### Claude's Discretion
- Drawer animation and gesture handling implementation
- PNG generation approach (canvas API vs html-to-image library)
- Onboarding tooltip positioning and step count
- Exact intermission layout and stat presentation
- Error toast vs inline error display patterns
- Docs page layout and navigation between sections

</decisions>

<specifics>
## Specific Ideas

- My Bets drawer should feel like a game inventory — quick peek, grab your winnings, back to playing
- Season completion is the "you beat the game" moment — make it feel like a reward screen
- Proof display follows same pattern as fairness page: casual by default, nerdy on demand
- Onboarding tour: "1. Watch the canvas. 2. Pick a color. 3. Place your bet. 4. Win SOL!" — four steps max
- Docs should feel like in-game help, not a separate documentation site

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PixelTooltip.tsx`: Already shows color/shade/warmth on pixel tap — extend with proof section for FS-09
- `useHeliusSocket.ts`: Live on-chain subscriptions — reuse for bet status updates and season state changes
- `useSeasonData.ts`: Fetches SeasonState — extend for season completion detection
- `useResolution.ts`: Detects round resolution — extend for season completion trigger
- `usePlaceBet.ts`: Transaction pattern (submit, confirm, error handling) — reuse for claim transactions
- `WinNotification.tsx` / `LossNotification.tsx`: Animation patterns for celebration effects
- `gameStore.ts` (Zustand): Central state — add bet history, claim state, season completion state
- `pda.ts`: PDA derivation for BetAccount, PlayerSeasonStats already defined
- `color.ts`: COLOR_NAMES, BASE_HEX — reuse for bet history display
- `canvas-confetti`: Already installed — reuse for season completion celebration

### Established Patterns
- Inline styles with CSS variables (`var(--font-family-display)`, `var(--font-family-body)`)
- Luckiest Guy display font, Nunito body font, dark Void aesthetic (#14141f)
- Motion (framer-motion) for animations: slide-in, fade, spring transitions
- 44px minimum tap targets, mobile-first at 375px
- Toast notifications for transaction feedback (existing pattern in BettingPanel)

### Integration Points
- BetAccount PDA: `"bet" + season_number + pixel_index + player_pubkey` — read for bet history
- PlayerSeasonStats PDA: `"stats" + season_number + player_pubkey` — read for season stats
- `claim_winnings` instruction: player-signed transaction to claim from resolved rounds
- SeasonState.status: `completed` triggers season completion flow
- SeasonState.intermission_ends_at: timestamp for intermission countdown
- PixelState.arweave_txid: link to prompt on Arweave for verification display
- PixelState.prompt_hash: commitment hash for proof display
- PixelState.vrf_used: boolean flag for VRF badge display

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-trust-layer-and-docs*
*Context gathered: 2026-03-18*
