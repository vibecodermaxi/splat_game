# Architecture Research

**Domain:** Solana prediction market game with off-chain AI oracle
**Researched:** 2026-03-16
**Confidence:** MEDIUM — Core patterns verified against official Solana docs and community sources; project-specific account naming inferred from spec, not a deployed reference implementation.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                         │
│                        (Vercel / Next.js)                     │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  Canvas UI   │  │ Betting Panel│  │  My Bets / Claim    │ │
│  │ 10×10 grid   │  │ 16 colors    │  │  Player stats       │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘ │
│         │                 │                      │            │
│  ┌──────┴─────────────────┴──────────────────────┴──────────┐ │
│  │           Wallet Adapter + @solana/react-hooks            │ │
│  │   (Phantom / Solflare / Backpack — Wallet Standard)       │ │
│  └──────────────────────────┬────────────────────────────────┘ │
│                             │ RPC + WebSocket                  │
└─────────────────────────────┼────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────┐
│                    RPC LAYER (Helius)                         │
│                             │                                 │
│   accountSubscribe (WS) ◄───┤───► getAccountInfo (HTTP)      │
└─────────────────────────────┼────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────┐
│                   SOLANA PROGRAM LAYER                        │
│                   (Anchor / Rust / Mainnet)                   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  SeasonState   │  │  PixelState  │  │    BetAccount     │ │
│  │  PDA           │  │  PDA per px  │  │    PDA per user   │ │
│  └────────────────┘  └──────────────┘  └───────────────────┘ │
│  ┌────────────────┐  ┌──────────────┐                        │
│  │  RoundVault    │  │ PlayerSeason │                        │
│  │  PDA (lamports)│  │ Stats PDA    │                        │
│  └────────────────┘  └──────────────┘                        │
├──────────────────────────────────────────────────────────────┤
│  Instructions: initialize_season | open_round | place_bet    │
│               lock_round | resolve_round | claim_winnings    │
│               start_next_season | commit_prompt_hash          │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ signed instructions (oracle keypair)
                              │
┌─────────────────────────────┼────────────────────────────────┐
│                  ORACLE / KEEPER LAYER                        │
│                  (Railway / Node.js / cron)                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  every 30 min:                                                │
│  1. commit_prompt_hash  ──► on-chain                          │
│  2. call Claude API (temperature 0)                           │
│  3. resolve_round (color + full prompt)  ──► on-chain         │
│  4. write round_history.json (last 5 rounds)                  │
│                                                               │
│  on failure: retry × 3 → delay → Switchboard VRF fallback    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                              │
                       ┌──────┴───────┐
                       │  Claude API  │
                       │ (Anthropic)  │
                       │  temp = 0    │
                       └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| Anchor Program | Round lifecycle state machine, fund custody, payout math | Rust + Anchor, deployed on Solana mainnet |
| SeasonState PDA | Tracks season number, round counter, canvas state (100 pixels), jackpot balance | Single PDA per season: seeds `[b"season", season_id]` |
| PixelState PDA | Tracks round status, color pools (16 buckets), committed hash, resolved color, total bets | PDA per pixel: seeds `[b"pixel", season_id, pixel_index]` |
| BetAccount PDA | Records individual bet (player, pixel, color, amount, claimed flag) | PDA per bet: seeds `[b"bet", pixel_pda, player_pubkey]` |
| RoundVault PDA | Holds SOL lamports for active round; program-owned via PDA authority | System-owned account, controlled via `invoke_signed` |
| PlayerSeasonStats PDA | Tracks bets placed, volume, correct predictions per player per season | PDA: seeds `[b"stats", season_id, player_pubkey]` |
| Oracle Service | Constructs AI prompts, commits hash, calls Claude, resolves rounds, handles failure cascade | Node.js on Railway, cron every 30 min |
| Frontend | Renders canvas, betting panel, countdown, My Bets; subscribes to account changes | Next.js (App Router), Vercel |
| Helius RPC | Serves all RPC calls; provides WebSocket `accountSubscribe` for live updates | Managed service; polling fallback if WS drops |

## Recommended Project Structure

```
splat/
├── programs/
│   └── pixel-predict/          # Anchor program (Rust)
│       ├── src/
│       │   ├── lib.rs           # Program entrypoint, instruction routing
│       │   ├── instructions/    # One file per instruction family
│       │   │   ├── season.rs    # initialize_season, start_next_season
│       │   │   ├── round.rs     # open_round, lock_round, commit_prompt_hash
│       │   │   ├── betting.rs   # place_bet (constraints enforced here)
│       │   │   ├── resolution.rs# resolve_round (oracle-signed)
│       │   │   └── claim.rs     # claim_winnings
│       │   ├── state/           # Account struct definitions
│       │   │   ├── season.rs    # SeasonState
│       │   │   ├── pixel.rs     # PixelState
│       │   │   ├── bet.rs       # BetAccount
│       │   │   └── player.rs    # PlayerSeasonStats
│       │   └── errors.rs        # Custom error codes
│       └── Cargo.toml
├── oracle/                      # Keeper service (Node.js)
│   ├── src/
│   │   ├── index.ts             # Cron entry, main loop
│   │   ├── prompt-builder.ts    # Constructs Claude prompt from history
│   │   ├── claude-client.ts     # Anthropic SDK wrapper, temp=0
│   │   ├── chain-client.ts      # Anchor/web3.js — sends instructions
│   │   ├── vrf-fallback.ts      # Switchboard VRF integration
│   │   └── commit-reveal.ts     # SHA-256 hash commitment logic
│   ├── round_history.json       # Last 5 rounds (runtime state)
│   └── package.json
├── frontend/                    # Next.js app (App Router)
│   ├── app/
│   │   ├── layout.tsx           # SolanaProvider, WalletProvider wrapping
│   │   ├── page.tsx             # Main game page
│   │   └── how-to-play/page.tsx
│   ├── components/
│   │   ├── Canvas/              # 10×10 grid, shade/warmth rendering
│   │   ├── BettingPanel/        # Color buttons, amount input, submit
│   │   ├── CountdownTimer/      # 30-min round clock
│   │   ├── MyBets/              # Open positions + claim button
│   │   ├── SeasonComplete/      # Share-as-PNG screen
│   │   └── ui/                  # Shared primitive components
│   ├── hooks/
│   │   ├── useRoundState.ts     # Subscribes to PixelState PDA via WS
│   │   ├── usePlayerBets.ts     # Fetches BetAccount PDAs for connected wallet
│   │   └── useSeasonState.ts    # Reads SeasonState PDA
│   ├── lib/
│   │   ├── anchor-client.ts     # IDL, program address, typed instructions
│   │   ├── helius-ws.ts         # WebSocket manager with reconnect + polling fallback
│   │   ├── color-utils.ts       # HSL shade/warmth modifiers for rendering
│   │   └── pda.ts               # Deterministic PDA derivation helpers
│   └── public/
└── Anchor.toml
```

### Structure Rationale

- **programs/pixel-predict/src/instructions/**: One file per instruction family keeps the Rust codebase navigable; state validation constraints live next to the instruction, not scattered.
- **programs/pixel-predict/src/state/**: Separate state module means account struct changes don't force touching instruction files. Anchor's `#[account]` macro lives here.
- **oracle/src/**: Each concern is isolated — prompt building, Claude calls, and chain writes are independently testable. `round_history.json` is the only persistent state; the service is otherwise stateless.
- **frontend/hooks/**: Hooks encapsulate all blockchain I/O; components receive plain data and fire callbacks. This separates Solana complexity from React rendering.
- **frontend/lib/helius-ws.ts**: WebSocket lifecycle (connect, subscribe, reconnect, polling fallback) in one place so all hooks share the same connection.

## Architectural Patterns

### Pattern 1: Oracle-Signed Authority

**What:** The oracle keypair holds a designated `oracle_authority` role stored in `SeasonState`. Only transactions signed by this keypair can call `commit_prompt_hash` and `resolve_round`. All other accounts (admin, treasury) are separate.

**When to use:** Any off-chain service that needs privileged write access to an on-chain program without being the program upgrade authority.

**Trade-offs:** Simpler than a multisig for v1; single point of failure if oracle key is compromised; rotate key via admin instruction if needed.

**Example:**
```rust
#[account(
    constraint = season.oracle_authority == oracle.key() @ ErrorCode::UnauthorizedOracle
)]
pub oracle: Signer<'info>,
```

### Pattern 2: Commit-Reveal for Verifiability

**What:** Oracle pre-commits `SHA-256(prompt_text + nonce)` on-chain in `lock_round`. After Claude returns its answer, oracle posts the full prompt + nonce in `resolve_round`. Anyone can re-hash and verify.

**When to use:** Any system where an off-chain actor provides an outcome that must be verifiable after the fact without revealing the input before resolution.

**Trade-offs:** Requires two transactions per round (commit + reveal); adds ~60 seconds of latency. The on-chain program verifies the hash at resolution time — the commitment is binding.

**Example:**
```typescript
// Oracle: commit phase
const nonce = crypto.randomBytes(32).toString('hex');
const commitment = crypto.createHash('sha256')
  .update(promptText + nonce)
  .digest('hex');
await program.methods.commitPromptHash(commitment).rpc();

// Oracle: reveal phase (after Claude responds)
await program.methods.resolveRound(color, promptText, nonce).rpc();
// On-chain: verifies sha256(promptText + nonce) == commitment
```

### Pattern 3: PDA Vault with invoke_signed

**What:** SOL bets are sent to a `RoundVault` PDA. The program controls this address via `invoke_signed` with known seeds — no external keypair can withdraw. Payouts are issued via the same mechanism.

**When to use:** Any Solana program that needs to hold and distribute native SOL. SPL tokens use token accounts instead.

**Trade-offs:** Straightforward and gas-efficient for SOL. Cannot hold SPL tokens natively — would need a separate Associated Token Account if SOL is swapped for an SPL token later.

**Example:**
```rust
// Payout from vault to winner
let vault_seeds = &[b"vault", &season_id.to_le_bytes(), &pixel_index.to_le_bytes(), &[vault_bump]];
system_program::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer { from: vault.to_account_info(), to: winner.to_account_info() },
        &[vault_seeds],
    ),
    payout_amount,
)?;
```

### Pattern 4: Polling Fallback for WebSocket

**What:** Frontend maintains a Helius WebSocket subscription to the active `PixelState` PDA. On disconnect or no message for >10 seconds, it falls back to polling `getAccountInfo` every 30 seconds. Pool odds are refreshed on a 60-second cadence regardless.

**When to use:** Any Solana frontend where live data matters but stale data is tolerable for short periods.

**Trade-offs:** WebSocket provides sub-200ms updates; polling is coarser. The 60-second pool update cadence from the spec aligns with polling fallback behavior, so users see consistent behavior whether connected or polling.

## Data Flow

### Bet Placement Flow

```
Player taps color button
    │
    ▼
BettingPanel validates input (0.01–10 SOL, not already bet this pixel)
    │
    ▼
useWallet() signs transaction
    │
    ▼
place_bet instruction ──► Anchor Program
    │                          │
    │                          ├── Validates: round = Open, pixel = active
    │                          ├── Validates: one color per pixel per player
    │                          ├── Validates: min/max SOL constraints
    │                          ├── CPI: player ──► RoundVault (transfer SOL)
    │                          ├── Update PixelState.pools[color] += amount
    │                          └── Create/update BetAccount PDA
    │
    ▼
Transaction confirmed
    │
    ▼
Helius WS fires accountSubscribe notification for PixelState
    │
    ▼
useRoundState hook updates → Canvas + BettingPanel re-render with new pool %
```

### Oracle Round Resolution Flow

```
Cron fires at T+28min (lock window)
    │
    ▼
Oracle reads SeasonState → determines active pixel_index
    │
    ▼
Oracle calls lock_round instruction ──► Program
    │                                       │
    │                                       └── PixelState.status = Locked
    │
    ▼
Oracle builds prompt from round_history.json (last 5 rounds) + current canvas
    │
    ▼
Oracle hashes prompt+nonce → commit_prompt_hash ──► Program (stores hash)
    │
    ▼
Claude API called (temperature = 0) → returns color token
    │
    ├── SUCCESS PATH:
    │       Oracle calls resolve_round(color, prompt, nonce) ──► Program
    │           │
    │           ├── Verifies sha256(prompt+nonce) == committed_hash
    │           ├── Sets PixelState.resolved_color = color
    │           ├── Sets PixelState.status = Resolved
    │           ├── Calculates payout ratios (parimutuel math)
    │           ├── Transfers 5% rake: 3% → treasury, 2% → jackpot
    │           ├── Stores payout_per_winning_unit in PixelState
    │           └── Increments SeasonState.round_counter
    │
    └── FAILURE PATH (retries exhausted):
            Oracle calls resolve_round_vrf() ──► Switchboard VRF
                │
                └── VRF posts random bytes on-chain → Program maps to color → resolves
    │
    ▼
Oracle appends round to round_history.json (keep last 5)
    │
    ▼
Helius WS notifies frontend → celebration animation plays
```

### Claim Flow

```
Player opens My Bets panel
    │
    ▼
usePlayerBets fetches all BetAccount PDAs for connected wallet + active season
    │
    ▼
Player taps Claim on a resolved pixel
    │
    ▼
claim_winnings instruction ──► Program
    │                               │
    │                               ├── Verifies PixelState.status = Resolved
    │                               ├── Verifies BetAccount.color == resolved_color
    │                               ├── Verifies BetAccount.claimed = false
    │                               ├── Calculates player_share = bet_amount * payout_per_unit
    │                               ├── CPI: RoundVault ──► player (transfer SOL)
    │                               └── Sets BetAccount.claimed = true
    │
    ▼
Transaction confirmed → My Bets panel updates
```

### State Update Flow (Frontend Real-Time)

```
Helius LaserStream WebSocket
    │
    ├── accountSubscribe(active_pixel_state_pda)
    │       │
    │       └── Fires on any account data change
    │               │
    │               └── useRoundState hook → deserializes → updates React state
    │                       │
    │                       ├── Canvas re-renders resolved pixel
    │                       ├── BettingPanel shows updated pool odds
    │                       └── CountdownTimer reads round status
    │
    └── FALLBACK: if WS disconnects or silent > 10s
            │
            └── setInterval(getAccountInfo, 30_000) polling
                    │
                    └── Same deserialization path as WS updates
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 concurrent users | Single oracle process on Railway; Helius Starter plan; Vercel hobby. No changes needed. |
| 500–5,000 users | Add Helius Business plan for higher WS connection limits; add Redis to oracle for idempotency on retry; consider read replicas of account data via Helius Enhanced API. |
| 5,000+ users | Oracle is stateless by design — horizontal scaling is feasible; frontend pool-odds polling architecture prevents on-chain read pressure; program logic unchanged. |

### Scaling Priorities

1. **First bottleneck: Helius WebSocket connection limits.** At high concurrency, each browser tab holds a WS connection. Helius plans cap concurrent subscriptions. Mitigation: move WS subscription server-side (Next.js route handler or edge function) and broadcast to clients via SSE or shared WebSocket.
2. **Second bottleneck: claim transaction volume.** 100 resolved pixels × N winners = N claim transactions. Program logic is correct but RPC submission could bottleneck. Mitigation: batched claim endpoint or client-side retry with exponential backoff.

## Anti-Patterns

### Anti-Pattern 1: Storing Round History On-Chain

**What people do:** Put the full 5-round history in a large `SeasonState` account to make it available to the program.

**Why it's wrong:** Solana accounts pay rent proportional to size. Growing season history balloons account size and rent cost. The program doesn't need history — only the oracle does.

**Do this instead:** Store `round_history.json` off-chain in the oracle service. The oracle uses it to construct prompts; the on-chain program only needs the current pixel's committed hash and resolved color.

### Anti-Pattern 2: Resolving Rounds Without Commit

**What people do:** Skip the commit phase to simplify the oracle — just call `resolve_round(color)` directly.

**Why it's wrong:** Players have no way to verify the AI genuinely chose the color rather than the oracle cherry-picking post-bet. Eliminates the trust guarantee that makes the product viable.

**Do this instead:** Always commit the prompt hash before calling Claude. The two-transaction overhead is negligible on Solana (~400ms per tx).

### Anti-Pattern 3: Using Refund Logic as Fallback

**What people do:** If the oracle fails, cancel the round and refund all bets.

**Why it's wrong:** Creates a DDoS-for-refund attack vector — a well-capitalized player can spam API failures to recover losing bets. Also adds significant contract complexity.

**Do this instead:** Always resolve. Use Switchboard VRF as the fallback oracle when Claude calls fail after retries. Round always concludes with a result.

### Anti-Pattern 4: Fetching All BetAccounts on Frontend Load

**What people do:** `getProgramAccounts` with a memcmp filter to load all bets for a player, on every page load.

**Why it's wrong:** `getProgramAccounts` is expensive — many RPC providers rate-limit or disable it on mainnet. Blocking page load on this call creates poor UX.

**Do this instead:** Derive BetAccount PDAs deterministically from the player's pubkey + pixel index. Fetch only the PDAs for open/recently resolved pixels. No `getProgramAccounts` needed.

### Anti-Pattern 5: Updating Pool Odds Every Block

**What people do:** Subscribe to every account change on the PixelState PDA and re-render odds on every lamport change.

**Why it's wrong:** Enables last-second copycat sniping — players can see live pool shifts in the final seconds and exploit the information. Also creates render churn.

**Do this instead:** The spec's decision to display odds on a 60-second cadence is architecturally correct. Throttle the pool display refresh client-side regardless of how often WS fires.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Helius RPC | HTTP JSON-RPC + WebSocket `accountSubscribe` | Use `commitment: 'confirmed'` for UI; `'finalized'` not needed for display |
| Helius LaserStream | Enhanced WebSocket (JSON, gRPC-reliability) | Preferred over standard WS; falls back to polling on disconnect |
| Claude API (Anthropic) | REST POST from oracle Node.js process | temperature=0 mandatory; use `max_tokens` limit to prevent runaway responses |
| Switchboard VRF | On-chain CPI: oracle requests randomness, Switchboard callback resolves round | Only invoked in failure cascade; pre-initialize VRF account during season setup |
| Solana System Program | CPI for SOL transfers from vault PDAs | `invoke_signed` with vault seeds; no external dependency |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Oracle ↔ Anchor Program | Signed Anchor instructions via @coral-xyz/anchor TypeScript client | Oracle holds dedicated keypair; pubkey stored in SeasonState |
| Frontend ↔ Anchor Program | Read via RPC; write via wallet-signed instructions | Frontend never needs the oracle keypair |
| Frontend ↔ Helius | WebSocket subscription + HTTP RPC | All in lib/helius-ws.ts; hooks import from there |
| Oracle ↔ Claude API | HTTPS REST; Anthropic SDK | Response parsed for color token; no streaming needed |
| Oracle ↔ Switchboard | On-chain callback pattern; oracle initiates VRF request transaction | Switchboard oracle posts result in a separate transaction; program must handle async callback |

## Build Order Implications

The component dependency graph dictates this sequence:

1. **Anchor program** — all other components depend on the deployed program and its IDL. Must come first. Ship to devnet, then mainnet.
2. **Oracle service** — depends on deployed program (needs IDL + program address). Can be developed in parallel after IDL is drafted.
3. **Frontend** — depends on IDL for typed instructions and on oracle being present for live rounds. Can mock oracle state during UI development.

Interdependency note: the `SeasonState.oracle_authority` field means the oracle keypair must be generated before `initialize_season` is called, even if the oracle service isn't fully running yet.

## Sources

- [Building a Prediction Market on Solana with Anchor](https://dev.to/sivarampg/building-a-prediction-market-on-solana-with-anchor-complete-rust-smart-contract-guide-3pbo) — MEDIUM confidence
- [Program Derived Addresses — Official Solana Docs](https://solana.com/docs/core/pda) — HIGH confidence
- [Helius WebSocket / LaserStream Docs](https://www.helius.dev/docs/rpc/websocket) — HIGH confidence
- [Helius Enhanced WebSockets](https://docs.helius.dev/webhooks-and-websockets/enhanced-websockets) — HIGH confidence
- [Next.js + Solana @solana/react-hooks — Official Docs](https://solana.com/docs/frontend/nextjs-solana) — HIGH confidence
- [Storing SOL in a PDA — Official Solana Guide](https://solana.com/developers/guides/games/store-sol-in-pda) — HIGH confidence
- [Switchboard VRF on Solana](https://switchboardxyz.medium.com/verifiable-randomness-on-solana-46f72a46d9cf) — MEDIUM confidence
- [OpenTote Parimutuel Protocol on Solana](https://opentote.org) — LOW confidence (marketing page only)
- [Solana Connecting to Off-Chain Data course](https://solana.com/developers/courses/connecting-to-offchain-data/oracles) — HIGH confidence

---
*Architecture research for: Solana prediction market game with AI oracle (Pixel Predict)*
*Researched: 2026-03-16*
