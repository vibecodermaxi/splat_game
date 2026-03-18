# Pixel Predict — Complete Specification

## Overview

Pixel Predict is a prediction market game on Solana where players bet on the color choices of an AI artist. The AI paints a 10×10 canvas one pixel at a time, selecting from 16 colors every 30 minutes. Players connect their Solana wallets and place bets on what color the AI will pick next. Winners split the betting pool for that round.

The canvas evolves into an abstract artwork over ~50 hours. When complete, a new season begins with a fresh canvas. The AI carries forward a memory of its artistic style, developing an evolving aesthetic across seasons.

---

## Game Loop

### Round Lifecycle

Each round follows a fixed 30-minute cycle for a single pixel:

```
[Round Opens] → [Betting Window: 28 min] → [Bet Lock: 2 min] → [AI Resolution] → [Payout Window] → [Next Round Opens]
```

1. **Round Opens (T+0:00):** The oracle service constructs the AI prompt and posts a SHA-256 hash of the full prompt on-chain. The active pixel is announced. Betting opens.
2. **Betting Window (T+0:00 to T+28:00):** Players place bets on one of 16 colors. Pool distribution updates on the frontend every 60 seconds. Players may bet on future pixels that have not yet entered their active round.
3. **Bet Lock (T+28:00):** No new bets accepted. Existing pool and odds are frozen and visible.
4. **AI Resolution (T+30:00):** The oracle sends the prompt to the AI, receives a color selection, and posts the result on-chain. The full prompt text is published for verification.
5. **Payout Window:** Winners may claim their proportional share of the pool at any time. Unclaimed winnings persist indefinitely.
6. **Next Round:** Opens immediately upon resolution of the previous round.

### Pixel Sequencing

Pixels fill sequentially across the 10×10 grid. Fill order is left-to-right, top-to-bottom:

```
(0,0) → (1,0) → (2,0) → ... → (9,0) → (0,1) → (1,1) → ... → (9,9)
```

This means Row 0 fills first (10 pixels, ~5 hours), then Row 1, and so on. The full canvas completes in 100 rounds (~50 hours).

### Season Structure

A **season** is one complete 10×10 canvas. When the final pixel (9,9) resolves:

1. **The Reveal (Hours 0–1):** Frontend displays the completed canvas full-screen. No betting UI. This is the screenshot and sharing moment.
2. **Intermission (Hours 1–12):** Countdown to next season. Season stats displayed: total volume, total bets, unique wallets, most/least popular colors, per-round volume chart.
3. **Season Completion Screen:** A share button generates a branded PNG of the completed canvas ("Pixel Predict — Season X"). This is the primary organic distribution mechanism.
4. **New Season (Hour 12):** Fresh 10×10 canvas. First pixel opens for betting. AI prompt includes a 2-sentence style summary of the previous season's artwork (see AI Oracle section).

Seasons are numbered sequentially: Season 1, Season 2, etc. Canvas state is stored on-chain permanently.

---

## Color System

### 16 Betting Colors

The AI must select from exactly 16 named colors. These are the betting outcomes — unambiguous, one-word names, visually distinguishable on all screen types:

| # | Name | Base Hex | # | Name | Base Hex |
|---|------|----------|---|------|----------|
| 0 | Red | #E53E3E | 8 | Indigo | #5C6BC0 |
| 1 | Orange | #ED8936 | 9 | Purple | #9F7AEA |
| 2 | Yellow | #ECC94B | 10 | Pink | #ED64A6 |
| 3 | Lime | #68D391 | 11 | Magenta | #D53F8C |
| 4 | Green | #38A169 | 12 | Brown | #8B6C5C |
| 5 | Teal | #38B2AC | 13 | Gray | #A0AEC0 |
| 6 | Cyan | #4FD1C5 | 14 | Black | #2D3748 |
| 7 | Blue | #4299E1 | 15 | White | #F7FAFC |

*Note: Final hex values should be validated on mobile screens at low brightness before launch. Particularly test Black vs. Indigo and Teal vs. Cyan for distinguishability.*

### Visual Rendering: Shade & Warmth

While bets resolve against the 16 base colors, the AI also selects two modifiers per pixel:

- **Shade (0–100):** 0 = lightest tint of the color, 100 = deepest/darkest shade
- **Warmth (0–100):** 0 = coolest variant, 100 = warmest variant

These modifiers affect only the visual rendering on the canvas, not bet resolution. A pixel bet on "Blue" resolves as Blue regardless of whether the visual is a pale periwinkle (shade: 15, warmth: 70) or a deep navy (shade: 85, warmth: 10).

**Rendering formula:** The frontend computes the final displayed hex color from the base color, shade, and warmth values. Implementation:

```
1. Convert base hex to HSL
2. Adjust L (lightness): L_final = L_base + (50 - shade) * 0.4
   (shade 0 → lighter, shade 100 → darker)
3. Adjust H (hue): H_final = H_base + (warmth - 50) * 0.15
   (warmth 0 → shift toward cool, warmth 100 → shift toward warm)
4. Clamp all values to valid ranges
5. Convert back to hex for rendering
```

This produces hundreds of visual variations from 16 betting outcomes, creating rich, nuanced artwork while keeping the betting layer clean and unambiguous.

---

## Betting Mechanics

### Parimutuel Model

All bets for a given pixel round go into a single pool. Winners split the pool proportionally to their bet size. No order books, no market makers, no liquidity requirements.

**Pool structure per round:**

```
Total Pool = sum of all bets across all 16 colors
Color Pool[i] = sum of all bets on color i
```

**Payout calculation for a winner:**

```
gross_payout = (player_bet / winning_color_pool) × total_pool
net_payout = gross_payout × 0.95  (after 5% rake)
```

**Displayed odds:**

```
implied_probability[i] = color_pool[i] / total_pool  (shown as %)
payout_multiplier[i] = (total_pool × 0.95) / color_pool[i]  (shown as Nx)
```

Example: Pixel (3,7), Round #42. Total pool: 10 SOL.

```
🔴 Red      3.2 SOL  (32.0%)  →  2.97x
🔵 Blue     2.1 SOL  (21.0%)  →  4.52x
🟡 Yellow   1.5 SOL  (15.0%)  →  6.33x
🟢 Green    0.8 SOL  ( 8.0%)  → 11.88x
⚫ Black    0.4 SOL  ( 4.0%)  → 23.75x
... remaining 11 colors sharing 2.0 SOL
```

### Bet Constraints

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Minimum bet | 0.01 SOL | ~$1, accessible to casual players |
| Maximum bet per color per pixel | 10 SOL | Prevents whale distortion of odds |
| Colors per pixel per player | 1 | Forces commitment; no hedging |
| Pixels per round per player | Unlimited | Players can bet on future pixels |
| Bet lockout | 2 minutes before resolution | Prevents last-second sniping |

**One color per pixel per player:** A player may only bet on a single color for any given pixel. They cannot hedge by betting on multiple colors for the same pixel. They may increase their bet on their chosen color up until the lockout. This constraint creates meaningful decisions — you commit to a read.

**Multi-pixel betting:** Players may place bets on future pixels before those pixels become the active round. These bets enter an "open" state and activate when the pixel's round begins. This allows strategic players to bet across a region of the canvas if they believe the AI will continue a pattern.

### Rake Distribution

```
Total rake: 5% of every pool
├── Treasury wallet: 3%
└── Jackpot wallet: 2% (mechanic TBD, accrues from Season 1)
```

Rake is deducted from the total pool before winner payouts are calculated. The 3% treasury and 2% jackpot transfers execute atomically as part of the `resolve_round` instruction.

### Claiming Winnings

Winners must explicitly claim their payouts by calling the `claim_winnings` instruction. Unclaimed winnings do not expire. The frontend displays a "Claim" button next to any resolved winning bet with an unclaimed balance.

---

## AI Oracle

### System Prompt

The AI system prompt is public and identical for every round within a season. It is published in the docs and on the frontend.

```
You are an abstract artist creating a {grid_width}×{grid_height} canvas, one pixel at a time.

You work with 16 colors: Red, Orange, Yellow, Lime, Green, Teal, Cyan, Blue, Indigo, Purple, Pink, Magenta, Brown, Gray, Black, White.

For each pixel, you select:
1. A color (one of the 16 above)
2. A shade value (integer, 0–100): 0 is the lightest tint, 100 is the deepest shade
3. A warmth value (integer, 0–100): 0 is the coolest variant, 100 is the warmest

You care about color relationships — harmony, contrast, tension, and rhythm. You respond to what is already on the canvas. You do not have a predetermined plan. You may develop themes as you work, or abandon them. You may create clusters, gradients, boundaries, or isolated accents. Trust your instincts.

{season_style_summary}

Respond in exactly this format and nothing else:
COLOR: [color name]
SHADE: [0-100]
WARMTH: [0-100]
REASONING: [1-2 sentences about your choice]
```

### Per-Round Prompt Construction

Each round, the oracle service constructs a user message containing:

```
Current canvas state (filled pixels with color, shade, warmth):
(0,0): Red, shade 45, warmth 62
(1,0): Blue, shade 78, warmth 23
... [all filled pixels]

Current pixel to paint: ({x}, {y})
Neighboring pixels: [list of adjacent filled pixels with their colors, or "empty"]

Your last 5 selections:
1. (x,y): Color, shade N, warmth N — "[reasoning]"
2. ...
3. ...
4. ...
5. ...

Select the color, shade, and warmth for pixel ({x}, {y}).
```

### Context Window

The AI receives:
- The full current canvas state (all filled pixels with color, shade, warmth)
- The coordinates and filled neighbors of the current pixel
- Its own last 5 selections with reasoning

It does NOT receive:
- Any player behavior data (bet volumes, popular colors, win rates)
- Selections older than the last 5 (no full-season memory beyond the canvas itself)
- Any information about the betting pool or odds

This gives the AI enough local coherence for interesting art without enough history to be easily modeled by players.

### Season Style Summary

Starting from Season 2, the system prompt includes a `{season_style_summary}` — a 2-sentence human-written description of the previous season's artwork. This is appended to the system prompt for the new season.

Example:
```
Your previous work (Season 1) featured predominantly cool tones with tight clusters in the upper-left quadrant and sharp warm accents along the bottom row. The overall feeling was oceanic with volcanic interruptions.
```

For Season 1, this field is empty. The summary is written manually by the operator after reviewing the completed canvas. It is subjective and editorial by design — the operator's interpretation of the AI's work becomes part of the next season's creative input.

### Temperature & Determinism

The AI runs at **temperature 0**. This makes outputs deterministic given identical inputs, which is critical for verifiability. Anyone can take the published prompt, send it to the same model at temperature 0, and confirm they get the same result.

Model: Claude (Sonnet or Haiku — to be determined based on output quality testing during development. Haiku is preferred for cost/speed if quality is sufficient.)

### Commit-Reveal Verifiability

1. **Commit (at round open):** Oracle constructs the full prompt (system + user message). Computes `SHA-256(prompt_text)`. Posts the hash on-chain as part of the `open_round` transaction.
2. **Resolve (at round close):** Oracle sends the prompt to the AI. Parses the response. Posts on-chain: winning color, shade, warmth, and the full prompt text (stored in a separate account or transaction memo).
3. **Verify (anytime):** Anyone can hash the published prompt and confirm it matches the pre-committed hash. Anyone can send the same prompt to the same model at temperature 0 and confirm the output matches.

### Failure Handling

Real money is at stake. Rounds must always resolve. The failure cascade:

```
Primary:        AI API call succeeds within 30 seconds → resolve normally
                ↓ (failure)
Retry:          3 retries at 30-second intervals, same prompt → resolve normally
                ↓ (all retries fail)
Delay:          Round enters "delayed" state. Betting stays locked.
                Oracle retries every 5 minutes for up to 30 minutes.
                ↓ (still failing after 30 min)
Fallback:       Resolve via Switchboard VRF (verifiable on-chain randomness).
                Color is random, shade 50, warmth 50.
                Pixel is flagged as "VRF-resolved" in canvas state.
```

**Refunds never happen.** Refund logic is complex, creates perverse incentives (DDoS oracle to force refund on a losing bet), and undermines trust. Rounds always resolve.

VRF-resolved pixels are visually distinguished on the canvas (e.g., a subtle border or indicator) so the completed artwork honestly reflects where the AI was vs. where randomness filled in.

---

## Smart Contract (Anchor Program)

### Program Architecture

A single Anchor program deployed on Solana mainnet. Four primary instructions, two admin instructions.

### Accounts

**SeasonState (PDA: `["season", season_number]`)**

```rust
pub struct SeasonState {
    pub season_number: u16,
    pub grid_width: u8,          // 10
    pub grid_height: u8,         // 10
    pub current_pixel_index: u16, // 0–99, sequential
    pub status: SeasonStatus,    // Active, Completed, Intermission
    pub total_volume: u64,       // lamports
    pub total_bets: u32,
    pub unique_wallets: u32,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub bump: u8,
}
```

**PixelState (PDA: `["pixel", season_number, pixel_index]`)**

```rust
pub struct PixelState {
    pub season_number: u16,
    pub pixel_index: u16,        // 0–99
    pub x: u8,
    pub y: u8,
    pub status: RoundStatus,     // Open, Locked, Resolved
    pub color_pools: [u64; 16],  // lamports per color
    pub total_pool: u64,
    pub winning_color: Option<u8>, // 0–15
    pub shade: Option<u8>,       // 0–100
    pub warmth: Option<u8>,      // 0–100
    pub prompt_hash: [u8; 32],   // SHA-256 of pre-committed prompt
    pub vrf_resolved: bool,      // true if fallback was used
    pub opened_at: i64,
    pub locked_at: Option<i64>,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}
```

**BetAccount (PDA: `["bet", season_number, pixel_index, player_pubkey]`)**

```rust
pub struct BetAccount {
    pub player: Pubkey,
    pub season_number: u16,
    pub pixel_index: u16,
    pub color: u8,               // 0–15
    pub amount: u64,             // lamports
    pub claimed: bool,
    pub bump: u8,
}
```

**PlayerSeasonStats (PDA: `["stats", season_number, player_pubkey]`)**

```rust
pub struct PlayerSeasonStats {
    pub player: Pubkey,
    pub season_number: u16,
    pub total_bets: u32,
    pub total_volume: u64,       // lamports
    pub correct_predictions: u16,
    pub colors_bet: [u16; 16],   // count per color
    pub bump: u8,
}
```

### Instructions

**1. `open_round`** (Oracle only)

Opens the next pixel's round for betting. Can only be called by the designated oracle keypair. Posts the prompt hash on-chain.

```
Accounts: SeasonState, PixelState (init), Oracle (signer), SystemProgram
Args: prompt_hash: [u8; 32]
Validation:
  - Oracle signature matches designated oracle pubkey
  - pixel_index == season.current_pixel_index
  - Previous pixel is resolved (or this is pixel 0)
Effects:
  - Initializes PixelState with status: Open
  - Sets opened_at to current timestamp
```

**2. `place_bet`** (Player)

Places or increases a bet on a color for a specific pixel.

```
Accounts: PixelState, BetAccount (init_if_needed), PlayerSeasonStats (init_if_needed), Player (signer), SystemProgram
Args: color: u8, amount: u64
Validation:
  - PixelState.status == Open (not Locked or Resolved)
  - Current timestamp < opened_at + 28 minutes (lockout check)
  - color < 16
  - amount >= 10_000_000 (0.01 SOL in lamports)
  - If BetAccount exists: bet.color == color (no changing colors)
  - Total bet by this player on this color on this pixel <= 10 SOL
Effects:
  - Transfers SOL from player to PixelState PDA
  - Creates or updates BetAccount (adds amount)
  - Updates PixelState.color_pools[color] and total_pool
  - Updates PlayerSeasonStats (total_bets++, total_volume += amount)
  - Updates SeasonState.total_volume, total_bets, unique_wallets
```

**3. `resolve_round`** (Oracle only)

Posts the AI's color selection and resolves the round.

```
Accounts: SeasonState, PixelState, Oracle (signer), TreasuryWallet, JackpotWallet
Args: winning_color: u8, shade: u8, warmth: u8, vrf_resolved: bool, prompt_data: Vec<u8>
Validation:
  - Oracle signature
  - PixelState.status == Open or Locked
  - winning_color < 16
  - shade <= 100, warmth <= 100
Effects:
  - Sets PixelState.winning_color, shade, warmth, vrf_resolved
  - Sets status to Resolved, resolved_at to current timestamp
  - Calculates rake: total_pool * 5 / 100
  - Transfers 3% to treasury, 2% to jackpot wallet
  - Increments season.current_pixel_index
  - If current_pixel_index == grid_width * grid_height: set season.status = Completed
  - Updates PlayerSeasonStats.correct_predictions for all winning bettors (requires iteration or deferred to claim)
```

*Note on correct_predictions tracking: Iterating all bettors at resolve time is expensive. Better approach: update `correct_predictions` in the `claim_winnings` instruction instead. The stat is slightly delayed but avoids unbounded compute at resolution.*

**4. `claim_winnings`** (Player)

Claims payout for a winning bet.

```
Accounts: PixelState, BetAccount, PlayerSeasonStats, Player (signer)
Args: none
Validation:
  - PixelState.status == Resolved
  - BetAccount.color == PixelState.winning_color
  - BetAccount.claimed == false
Effects:
  - Calculates: payout = (bet.amount / pixel.color_pools[winning_color]) × (pixel.total_pool × 95 / 100)
  - Transfers payout from PixelState PDA to player
  - Sets BetAccount.claimed = true
  - Increments PlayerSeasonStats.correct_predictions
```

**5. `start_season`** (Admin)

Initializes a new season. Called once by the operator.

```
Accounts: SeasonState (init), Admin (signer), SystemProgram
Args: season_number: u16, grid_width: u8, grid_height: u8
Validation:
  - Admin signature matches program authority
  - Previous season (if any) has status Completed
Effects:
  - Initializes SeasonState
```

**6. `lock_round`** (Oracle or Crank)

Transitions a round from Open to Locked when the 28-minute betting window expires. This can be called by anyone (permissionless crank) since it only checks timestamps.

```
Accounts: PixelState
Args: none
Validation:
  - PixelState.status == Open
  - Current timestamp >= opened_at + 28 minutes
Effects:
  - Sets status to Locked
  - Sets locked_at to current timestamp
```

### Program Constants

```rust
pub const MIN_BET: u64 = 10_000_000;           // 0.01 SOL
pub const MAX_BET_PER_COLOR: u64 = 10_000_000_000; // 10 SOL
pub const NUM_COLORS: u8 = 16;
pub const RAKE_BPS: u16 = 500;                 // 5%
pub const TREASURY_BPS: u16 = 300;             // 3%
pub const JACKPOT_BPS: u16 = 200;              // 2%
pub const BETTING_WINDOW_SECONDS: i64 = 1680;  // 28 minutes
pub const ROUND_DURATION_SECONDS: i64 = 1800;  // 30 minutes
```

---

## Oracle Service

### Architecture

A single Node.js process running on Railway. Triggered by cron every 30 minutes. Stateless — all game state is read from chain.

### Round Lifecycle Flow

```
Every 30 minutes:
│
├─ 1. Read current SeasonState from chain
│     → Get current_pixel_index
│
├─ 2. Read canvas state from chain
│     → All resolved PixelState accounts for this season
│     → Extract colors, shades, warmth values
│
├─ 3. Construct AI prompt
│     → System prompt (static per season)
│     → Canvas state, current pixel coordinates, neighbors
│     → Last 5 picks with reasoning
│
├─ 4. Hash prompt → SHA-256
│
├─ 5. Call open_round instruction
│     → Posts prompt_hash on-chain
│     → Round is now open for betting
│
├─ 6. Wait 28 minutes (betting window)
│
├─ 7. Call lock_round instruction
│     → No new bets accepted
│
├─ 8. Wait 2 minutes
│
├─ 9. Call Claude API
│     → Temperature 0
│     → Parse response: COLOR, SHADE, WARMTH, REASONING
│     → Validate: color is one of 16, shade/warmth are 0–100
│     │
│     ├─ Success → proceed to step 10
│     └─ Failure → retry up to 3 times (30s intervals)
│         └─ All retries fail → delay state (retry every 5 min for 30 min)
│             └─ Still failing → Switchboard VRF fallback
│
├─ 10. Call resolve_round instruction
│      → Posts winning color, shade, warmth, full prompt data
│
└─ 11. Log round result, store reasoning for next prompt's history
```

### Environment Variables

```
SOLANA_RPC_URL=          # Helius RPC endpoint
ORACLE_KEYPAIR=          # Oracle wallet private key (JSON array)
ANTHROPIC_API_KEY=       # Claude API key
PROGRAM_ID=              # Deployed Anchor program ID
TREASURY_WALLET=         # Treasury public key
JACKPOT_WALLET=          # Jackpot public key
CURRENT_SEASON=          # Active season number
```

### Prompt History Storage

The oracle maintains a local JSON file (`round_history.json`) storing the last 5 rounds' data for prompt construction:

```json
[
  {
    "pixel_index": 42,
    "x": 2,
    "y": 4,
    "color": "Blue",
    "shade": 72,
    "warmth": 23,
    "reasoning": "The upper region has been cool-dominant. Continuing the blue cluster feels right."
  }
]
```

This file is the only local state. If it's lost, the oracle can reconstruct it from on-chain data (color, shade, warmth are stored on-chain; reasoning can be recovered from published prompt data or omitted for the next few rounds).

---

## Frontend

### Tech Stack

- **Framework:** Next.js (App Router)
- **Hosting:** Vercel
- **Wallet:** @solana/wallet-adapter-react (Phantom, Solflare, Backpack)
- **RPC:** Helius (WebSocket subscriptions for real-time updates)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion

### Visual Design Direction

**Video game casual.** The overall aesthetic should feel like a polished hyper-casual mobile game, not a crypto trading terminal.

- **Background:** Dark (near-black or very dark blue) so the canvas pops
- **UI Elements:** Rounded corners, chunky buttons, large tap targets for mobile
- **Typography:** A playful rounded sans-serif (Fredoka One, Rubik, or similar). One display font for headings, one clean sans for data/numbers
- **Color:** The 16 game colors are the palette. UI chrome is neutral/dark. Accent colors pulled from the game palette for interactive elements
- **Motion:** Micro-animations on every interaction. Bet placed → satisfying pulse/ripple. Countdown ticking → subtle shake in final 30 seconds. Round resolved → color floods the pixel with a brief glow. Season complete → confetti or particle burst
- **Mobile-first:** Primary usage will be on phones. All interactions must work with thumb-reach tap targets. Canvas must be legible at phone width

### Screens & Components

**1. Main Game Screen**

The primary (and nearly only) screen. Layout:

```
┌──────────────────────────────────┐
│  PIXEL PREDICT    Season 3   🔗  │  ← Header: logo, season #, wallet
├──────────────────────────────────┤
│                                  │
│       ┌──────────────────┐       │
│       │                  │       │
│       │   10×10 Canvas   │       │
│       │                  │       │
│       │  (active pixel   │       │
│       │   highlighted)   │       │
│       │                  │       │
│       └──────────────────┘       │
│                                  │
│   ⏱ 14:23 remaining             │  ← Countdown timer
│   Pixel (3, 7) · Round #38      │
│                                  │
├──────────────────────────────────┤
│                                  │
│  [Color Betting Panel]           │  ← 16 colors with odds + multipliers
│                                  │
│  🔴 Red    32%   2.97x          │
│  🔵 Blue   21%   4.52x          │
│  🟡 Yellow 15%   6.33x          │
│  ...                             │
│                                  │
│  Your bet: 🔵 Blue  0.05 SOL    │
│  [    Bet Amount Input     ]     │
│  [    PLACE BET button     ]     │
│                                  │
├──────────────────────────────────┤
│  My Bets  │  How to Play  │     │  ← Bottom tabs
└──────────────────────────────────┘
```

**Canvas Component:**
- 10×10 grid rendered on HTML Canvas or CSS Grid
- Filled pixels show their shade/warmth-modified color
- Unfilled pixels are dark/translucent
- Active pixel has a pulsing highlight/border animation
- Tapping a filled pixel shows its result (color, shade, warmth, round #)
- Tapping the active pixel scrolls to the betting panel

**Color Betting Panel:**
- Shows all 16 colors in a 4×4 grid or scrollable list
- Each color shows: color swatch, name, pool % (bar width), payout multiplier
- Tapping a color selects it
- Bet amount input with +/- buttons and quick-set amounts (0.01, 0.05, 0.1, 0.5, 1)
- "Place Bet" button — large, colorful, satisfying to tap
- After betting: shows "Your bet: [color] [amount]" with option to add more
- During lockout (last 2 min): panel shows odds but bet button is disabled with "Bets locked" label

**Countdown Timer:**
- Large, prominent display showing time remaining
- Color/animation shift in final 2 minutes (lockout period)
- Final 10 seconds: dramatic countdown animation

**2. Resolution Animation**

When a round resolves:
- Active pixel fills with the winning color (animated flood/burst)
- Winning color flashes in the betting panel
- If player won: payout amount animates up from the pixel with a celebration effect
- If player lost: subtle dimming, quick transition to next round
- Canvas briefly pulses to show the overall artwork emerging

**3. My Bets Panel**

Accessible via bottom tab. Shows:
- Active bets (pixel, color, amount, current odds)
- Resolved bets (won/lost, payout amount)
- Claimable winnings with "Claim" button (individual or "Claim All")
- Season summary: total bet, total won, correct predictions, hit rate

**4. Season Completion Screen**

Triggered when pixel (9,9) resolves:
- Full-screen canvas display, no UI chrome
- "Season X Complete" overlay with season stats
- "Share" button → generates PNG with branding
- Countdown to next season
- After intermission: transitions to fresh canvas

**5. How to Play**

In-app explainer. Short, visual, matching the game aesthetic:
- What is Pixel Predict (2 sentences)
- How to bet (3 steps with illustrations)
- How odds work (simple example)
- How the AI picks colors (1 paragraph)
- Fairness guarantee (commit-reveal explanation, 2 sentences)

### Real-Time Data

**Helius WebSocket subscriptions:**
- Subscribe to PixelState account changes for the active pixel → live pool updates
- Subscribe to SeasonState → detect round transitions and season completion

**Polling fallback:**
- If WebSocket disconnects, fall back to polling active PixelState every 15 seconds
- Reconnect WebSocket with exponential backoff

**Frontend update cadence:**
- Pool distribution: recalculates from on-chain data every 60 seconds (not real-time, to prevent copycat sniping)
- Countdown timer: client-side, synced to on-chain `opened_at` timestamp
- Canvas state: updates on each round resolution

---

## Docs Site

A simple, separate page (or section of the main site) explaining the game. Matches the game's visual identity. Not a whitepaper — written like a board game rulebook.

### Pages

**1. How It Works**
- The AI paints a canvas, one pixel every 30 minutes
- You bet on what color it picks next
- If you're right, you split the pot with other winners
- The bigger the pot on your color, the lower the payout (odds shift in real time)
- When the canvas is done, a new season starts

**2. The AI Artist**
- The AI sees the current canvas and its last few choices
- It picks colors based on artistic instinct — harmony, contrast, pattern
- It doesn't know what players are betting
- Every prompt is published after each round so you can verify fairness
- The AI develops a style over seasons

**3. Betting Rules**
- Minimum bet: 0.01 SOL
- Maximum bet: 10 SOL per color per pixel
- One color per pixel — pick your color and commit
- Betting locks 2 minutes before the AI picks
- 5% fee on each pool (goes to the house and a future jackpot fund)

**4. Fairness & Verification**
- Before each round, we publish a hash of the exact prompt sent to the AI
- After the round, we publish the full prompt
- The AI runs at temperature 0 (deterministic) — anyone can verify the result
- If the AI goes down, we fall back to provable on-chain randomness

**5. FAQ**
- What wallet do I need? (Any Solana wallet — Phantom, Solflare, Backpack)
- How do I claim winnings? (My Bets → Claim button)
- What happens if nobody bets on the winning color? (No winners, full pool rolls to treasury/jackpot minus nothing to distribute)
- Can I bet on future pixels? (Yes, before their round opens)
- How long is a season? (~50 hours for a 10×10 canvas, then a 12-hour break)

---

## Infrastructure

### Deployment Topology

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel     │     │   Railway     │     │   Solana      │
│   (Frontend) │────▶│   (Oracle)    │────▶│   (Program)   │
│   Next.js    │     │   Node.js     │     │   Anchor      │
└──────┬──────┘     └──────┬───────┘     └──────────────┘
       │                   │                      ▲
       │                   ▼                      │
       │            ┌──────────────┐              │
       └───────────▶│   Helius      │──────────────┘
                    │   (RPC +      │
                    │   Webhooks)   │
                    └──────────────┘
```

### Cost Estimates (Monthly, at Launch Scale)

| Service | Estimated Cost | Notes |
|---------|---------------|-------|
| Railway (Oracle) | $5–10 | Single process, cron-triggered |
| Helius (RPC) | Free tier or $49 | Developer plan handles early traffic |
| Vercel (Frontend) | Free tier | Hobby plan sufficient at launch |
| Claude API | ~$15–30 | ~4,800 rounds/month × ~500 tokens/round |
| Solana transactions | ~$5–10 | Oracle transactions (open + resolve per round) |
| **Total** | **~$30–100/month** | Scales with usage |

### Monitoring

- **Oracle health:** Railway health check on the process. Alert (email or Telegram bot) if the process crashes or a round fails to resolve within 35 minutes.
- **On-chain monitoring:** Helius webhook on SeasonState — alert if `current_pixel_index` hasn't incremented in 40 minutes (indicates stuck round).
- **Frontend:** Vercel analytics for basic traffic. No custom analytics in v1.

---

## V2 Roadmap (Not in V1)

For reference, features explicitly deferred:

- **Jackpot mechanic:** Design and activate trigger conditions using accrued 2% fund
- **NFT minting:** Tiered model — Common (all participants), Signed (top 10), Original (1/1 auction)
- **Leaderboard:** Per-season and all-time rankings by correct predictions, volume, ROI
- **Blinks/Solana Actions:** Shareable betting links for individual pixels on X/Twitter
- **Season gallery:** Historical view of all completed canvases
- **Advanced analytics:** AI pattern analysis tools, color frequency charts, heatmaps
- **Social features:** In-app chat, bet sharing, reactions
- **Exact-shade side bets:** Bet on shade/warmth ranges for higher risk/reward
- **Grid scaling:** 15×15, 20×20, and larger canvases for later seasons
- **Referral system:** Bonus for inviting new players
- **Notifications:** Push/email alerts for round resolution, win notifications
- **Admin dashboard:** Season management, oracle monitoring, treasury analytics
