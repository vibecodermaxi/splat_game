# Phase 3: Frontend Core - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Playable, mobile-first game loop where a player with a connected wallet can view the live 10×10 canvas, place a bet on one of 16 colors, watch the countdown, see the round resolve with animation, and claim winnings. This is the core interactive experience — everything a player needs to bet and win.

</domain>

<decisions>
## Implementation Decisions

### Canvas Rendering
- CSS Grid (not HTML Canvas) — each pixel is a div with inline background-color computed from shade/warmth HSL formula
- Active pixel: animated marching/rotating dashed border (bouncing outline style) — playful, game-like
- Empty pixel style: Claude's discretion
- Tapping a filled pixel shows a tooltip popup (small floating card with color name, shade, warmth, round number) — dismisses on tap-away
- Tapping the active pixel scrolls to the betting panel

### Betting Panel UX
- 16 colors displayed as a 4×4 grid of swatches
- Each swatch shows the payout multiplier (e.g., "4.5x") overlaid on the color — pool % shown when selected
- Bet amount input: text input field with +/- buttons AND quick-set preset buttons (0.01, 0.05, 0.1, 0.5, 1 SOL)
- "Place Bet" button: large, rounded, takes the selected color as its background — pulses gently when ready, satisfying tap feel
- After betting: shows "Your bet: [color] [amount]" with option to add more
- Lockout state (final 2 min): dramatic shift — panel color shifts (red tint), timer pulses urgently, bet button grays with countdown to resolution

### Resolution Animation
- Color flood: radial burst — color explodes outward from center of pixel with brief glow halo
- Win: payout amount floats up from pixel with confetti particles
- Loss: panel briefly dims, quick transition to next round — no lingering on failure
- Final 10-second countdown: full drama — large pulsing numbers, screen edges glow, subtle screen shake on last 3 seconds, casino energy

### Typography & Brand
- Display font: Fredoka One (headings, timer, bet amounts)
- Body font: clean sans-serif for data/numbers (Claude's discretion — something that pairs with Fredoka)
- Background: near-black (#0a0a0f or similar) for maximum canvas contrast
- UI chrome: neutral/dark, accent colors pulled from the 16 game colors for interactive elements
- Buttons: big, rounded, colorful (selected color as background)
- Overall vibe: polished hyper-casual mobile game, not crypto trading terminal

### Already Decided (from prior phases / spec)
- 60-second pool update cadence (prevents copycat sniping — do NOT optimize to real-time)
- Helius WebSocket for live state updates, polling fallback every 15 seconds on disconnect
- Wallet connect: Phantom, Solflare, Backpack via @solana/react-hooks (new Wallet Standard)
- Mobile-first: all interactions work with thumb-reach tap targets, canvas legible at 375px width
- Countdown timer synced to on-chain opened_at timestamp (not wall clock)
- Season progress indicator: round N of 100

### Claude's Discretion
- Empty pixel visual style
- Body/data font pairing with Fredoka One
- Exact animation timing and easing curves
- Confetti particle implementation (CSS vs canvas overlay vs library)
- Loading skeleton design
- Error state handling patterns
- Component structure and state management approach
- How wallet connect button looks (standard adapter UI vs custom)

</decisions>

<specifics>
## Specific Ideas

- The spec has a detailed wireframe layout: header (logo, season, wallet) → canvas → timer + round info → color panel → bet input → bottom tabs
- Shade/warmth rendering formula defined in spec: base hex → HSL, adjust L by (50-shade)*0.4, adjust H by (warmth-50)*0.15, clamp, convert back
- Pool distribution bars should update at 60-second cadence, NOT real-time — this is an intentional anti-sniping design decision
- "Bets locked" during lockout must be unambiguous — the spec emphasizes this is a trust signal
- The app should feel like a game, not a DeFi dashboard — Fredoka One + dark background + chunky buttons + micro-animations on every interaction

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- IDL at `target/idl/pixel_predict.json` — generate TypeScript client for frontend
- Program ID: `FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG`
- `oracle/src/types.ts` — COLOR_NAMES array, type definitions that frontend may share
- `oracle/src/chain.ts` — PDA derivation functions (deriveConfigPDA, deriveSeasonPDA, derivePixelPDA) can be reused or replicated

### Established Patterns
- PDA seeds: "config", "season"+u16LE, "pixel"+u16LE+u16LE, "bet"+u16LE+u16LE+pubkey, "stats"+u16LE+pubkey
- On-chain status enums: SeasonStatus (active/completed/intermission), RoundStatus (open/locked/resolved)
- Oracle reads SeasonState.currentPixelIndex to know the active round

### Integration Points
- Frontend reads: SeasonState, PixelState (active + all resolved), BetAccount (player's bets), PlayerSeasonStats
- Frontend writes: place_bet, claim_winnings (player-signed)
- Helius WebSocket subscription: PixelState account changes for active pixel, SeasonState for round transitions
- Helius RPC: SOLANA_RPC_URL env var (same Helius endpoint as oracle)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-frontend-core*
*Context gathered: 2026-03-18*
