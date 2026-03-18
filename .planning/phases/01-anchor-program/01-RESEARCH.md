# Phase 1: Anchor Program - Research

**Researched:** 2026-03-17
**Domain:** Solana / Anchor Framework / Parimutuel Betting / VRF Randomness
**Confidence:** HIGH (core stack), MEDIUM (VRF), HIGH (payout math)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **VRF Provider:** Use Pyth Entropy (not Switchboard VRF) for randomness fallback. Full integration in Phase 1, not stubbed. On-chain Pyth Entropy proof verification in resolve_round. If Pyth Entropy is unavailable during a fallback attempt, round stays in delayed state — no unverifiable randomness enters the system.
- **Program Security:** Upgradeable program. Admin key doubles as upgrade authority. Oracle keypair stored in a Config PDA — admin can rotate oracle key without program redeployment. Treasury and jackpot wallet addresses hardcoded as program constants — not admin-redirectable.
- **Prompt Data Storage:** Full prompt text stored off-chain on Arweave. Only SHA-256 hash stored on-chain in PixelState. Arweave transaction ID stored on-chain after upload. No on-chain hash verification at resolve time. resolve_round does NOT receive prompt_data as a Vec<u8> argument.
- **Network & Testing Strategy:** Development on local validator. Deploy to devnet when tests pass — mainnet deferred. Full test suite: Rust unit tests for payout math/validation/edge cases + TypeScript integration tests for every instruction + full round lifecycle flows.

### Claude's Discretion
- Account sizing and rent allocation strategy
- PDA seed structure (spec provides suggestions but implementation may optimize)
- Error code numbering and naming
- Instruction ordering within transactions
- Whether to use Anchor events for indexing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SC-01 | Admin can initialize a new season with configurable grid dimensions | start_season instruction pattern; SeasonState PDA init; admin authority check |
| SC-02 | Oracle can open a round by posting SHA-256 prompt hash on-chain | open_round instruction; Config PDA has_one oracle check; PixelState init |
| SC-03 | Player can place a bet on one of 16 colors for an open pixel round | place_bet instruction; BetAccount init; SOL transfer to PixelState PDA |
| SC-04 | Player can increase their bet on their chosen color before lockout | init_if_needed on BetAccount; checked_add; re-initialization guard |
| SC-05 | Player cannot bet on more than one color per pixel | Constraint on BetAccount: bet.color == color; error on color mismatch |
| SC-06 | Min 0.01 SOL and max 10 SOL per color per pixel enforced on-chain | Program constants MIN_BET/MAX_BET; require! checks in place_bet |
| SC-07 | Anyone can trigger lock_round after 28-minute betting window (permissionless crank) | lock_round; Clock::get() unix_timestamp; no signer required beyond account ownership |
| SC-08 | Oracle can resolve a round by posting winning color, shade, warmth, and prompt data | resolve_round; Config PDA has_one; atomic lamport transfer to treasury/jackpot |
| SC-09 | 5% rake (3% treasury, 2% jackpot) transferred atomically at resolution | Direct lamport subtraction from PixelState PDA; checked mul/div with u128 |
| SC-10 | Player can claim proportional payout from winning pool after resolution | claim_winnings; u128 multiply-before-divide; direct lamport transfer |
| SC-11 | Unclaimed winnings persist indefinitely | claimed flag on BetAccount; no expiry logic |
| SC-12 | Payout math uses u128 intermediates and multiply-before-divide | overflow-checks = true in Cargo.toml; checked_mul/checked_div pattern |
| SC-13 | Zero-winner rounds transfer net pool to treasury wallet | Branch in resolve_round: if color_pools[winning_color] == 0 |
| SC-14 | Season completes automatically when final pixel resolves | current_pixel_index == grid_width * grid_height check in resolve_round |
| SC-15 | Player season stats tracked on-chain (updated at claim, not resolve) | PlayerSeasonStats PDA; correct_predictions incremented in claim_winnings |
| SC-16 | VRF fallback resolution supported with vrf_resolved flag on PixelState | vrf_resolved bool field; VRF provider integration (see VRF section) |
| SC-17 | Player can place bets on future pixels before their round opens | place_bet allows Open status OR PixelState not yet initialized (future pixel) |
</phase_requirements>

---

## Summary

This phase builds the complete on-chain state machine for Pixel Predict: a Solana Anchor program handling season management, parimutuel betting, round lifecycle, payout math, and VRF fallback. The program is the source of truth consumed by all downstream phases.

The technical stack is well-established: Anchor 0.32.1 is the current stable release. The project structure, account model, and instruction patterns are all mature with official documentation. Payout arithmetic requires careful attention — u128 intermediates with multiply-before-divide is the correct pattern, and `overflow-checks = true` in Cargo.toml must be set. Testing with LiteSVM (TypeScript) and Rust unit tests covers the full suite.

**Critical finding on VRF:** Pyth Entropy is EVM-only as of March 2026. It has no Solana SDK. The locked decision to use Pyth Entropy is technically infeasible. This is an open question that requires user resolution. The leading alternative for Solana VRF is **Switchboard Randomness v3** (SGX-based, single-transaction commit-reveal, Program ID `RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh`) or **ORAO VRF** (multi-node, Anchor-native SDK, sub-second fulfillment). This must be resolved before planning the resolve_round instruction.

**Primary recommendation:** Use Anchor 0.32.1 with LiteSVM + Mocha/Chai for testing. Resolve the VRF provider before Wave 1 kickoff. Structure the program as specified in SPEC.md — the account layouts are well-designed and match Anchor patterns exactly.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| anchor-lang | 0.32.1 | Solana program framework | Industry standard; auto-generates IDL, account validation, CPI helpers |
| anchor-cli | 0.32.1 | Build/test/deploy toolchain | Required companion to anchor-lang |
| solana-program | ~1.18 (bundled) | Runtime primitives | Included transitively via anchor-lang |
| @coral-xyz/anchor | 0.32.1 | TypeScript client for tests | Auto-generated from IDL; official Anchor TS package |

### Supporting (Testing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| litesvm | latest | In-process Solana VM for TypeScript tests | All TypeScript integration tests (replaces bankrun) |
| anchor-litesvm | latest | Bridges Anchor provider with LiteSVM | TypeScript tests needing Anchor.setProvider |
| mocha + chai | latest | Test runner + assertions (default in anchor init) | TypeScript integration tests |
| ts-mocha | latest | TypeScript runner for mocha | Required by anchor test default config |

### Supporting (Optional — Discretion)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| anchor-events | built-in | Emit indexed events from instructions | If indexing is needed for Phase 3/oracle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| litesvm | solana-test-validator | Slower (full validator spin-up); needed only for RPC-dependent tests |
| litesvm | bankrun | Bankrun deprecated as of March 2025 — do not use |
| anchor-lang 0.32.1 | Anchor 1.0.0-rc.2 | RC2 released January 2026 but not stable; 0.32.1 is recommended for production |

**Installation:**
```bash
# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.32.1

# New project
anchor init pixel-predict
cd pixel-predict

# TypeScript test dependencies (in package.json)
npm install --save-dev litesvm anchor-litesvm @types/mocha @types/chai ts-mocha
```

---

## Architecture Patterns

### Recommended Project Structure
```
programs/
└── pixel-predict/
    └── src/
        ├── lib.rs              # Program entry point, declare_id!, instruction dispatch
        ├── instructions/
        │   ├── mod.rs
        │   ├── start_season.rs
        │   ├── open_round.rs
        │   ├── place_bet.rs
        │   ├── lock_round.rs
        │   ├── resolve_round.rs
        │   └── claim_winnings.rs
        ├── state/
        │   ├── mod.rs
        │   ├── season_state.rs
        │   ├── pixel_state.rs
        │   ├── bet_account.rs
        │   └── player_season_stats.rs
        ├── constants.rs
        └── errors.rs
tests/
└── pixel-predict.ts            # TypeScript integration tests (mocha/litesvm)
Cargo.toml                      # Workspace root
programs/pixel-predict/
└── Cargo.toml                  # Program crate
```

### Pattern 1: Account Declaration with InitSpace
**What:** Use `#[derive(InitSpace)]` to auto-calculate account sizes — eliminates manual size errors.
**When to use:** All account structs. Fixed-size fields only (no Vec, no String). BetAccount, SeasonState, PixelState all qualify.

```rust
// Source: https://www.helius.dev/blog/an-introduction-to-anchor-a-beginners-guide-to-building-solana-programs
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BetAccount {
    pub player: Pubkey,          // 32
    pub season_number: u16,      // 2
    pub pixel_index: u16,        // 2
    pub color: u8,               // 1
    pub amount: u64,             // 8
    pub claimed: bool,           // 1
    pub bump: u8,                // 1
}
// Init space: 8 (discriminator) + BetAccount::INIT_SPACE
```

### Pattern 2: PDA Seeds — Compound Keys
**What:** Encode all discriminating fields into seeds for collision-free addresses.
**When to use:** Every account that is unique per (season, pixel, player) tuple.

```rust
// BetAccount PDA: unique per player-pixel combination
#[account(
    init_if_needed,
    payer = player,
    space = 8 + BetAccount::INIT_SPACE,
    seeds = [b"bet", season_number.to_le_bytes().as_ref(), pixel_index.to_le_bytes().as_ref(), player.key().as_ref()],
    bump,
    constraint = !bet_account.claimed @ PixelPredictError::AlreadyClaimed,
)]
pub bet_account: Account<'info, BetAccount>,
```

### Pattern 3: Config PDA for Oracle Key Rotation
**What:** Store mutable oracle pubkey in a Config PDA — admin can rotate it, but treasury/jackpot are hardcoded constants.
**When to use:** Any key that may need operational rotation without redeployment.

```rust
#[account]
#[derive(InitSpace)]
pub struct ConfigAccount {
    pub oracle_pubkey: Pubkey,  // 32 — rotatable by admin
    pub admin: Pubkey,          // 32 — set at init, immutable operationally
    pub bump: u8,               // 1
}

// Seeds: ["config"] — singleton per program
// Authorization check in oracle instructions:
#[account(
    seeds = [b"config"],
    bump = config.bump,
    has_one = oracle_pubkey @ PixelPredictError::UnauthorizedOracle,
)]
pub config: Account<'info, ConfigAccount>,
pub oracle_pubkey: Signer<'info>,
```

### Pattern 4: SOL Custody in PixelState PDA
**What:** PixelState PDA holds all bet lamports. Payouts transfer directly from PixelState lamports to player.
**When to use:** Escrow pattern — no SPL tokens, pure SOL.

```rust
// Depositing: player -> PixelState PDA (CPI to System Program)
let cpi_ctx = CpiContext::new(
    ctx.accounts.system_program.to_account_info(),
    system_program::Transfer {
        from: ctx.accounts.player.to_account_info(),
        to: ctx.accounts.pixel_state.to_account_info(),
    },
);
system_program::transfer(cpi_ctx, amount)?;

// Withdrawing from PDA (direct lamport mutation — no CPI needed for program-owned accounts)
**ctx.accounts.pixel_state.to_account_info().try_borrow_mut_lamports()? -= payout;
**ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += payout;
```

**Critical:** When withdrawing, ensure PixelState retains enough lamports to remain rent-exempt. Calculate minimum rent with `Rent::get()?.minimum_balance(space)` and subtract from available pool.

### Pattern 5: Time-Based Lockout Check
**What:** Use `Clock::get()?.unix_timestamp` (returns `i64`) for betting window enforcement.
**When to use:** place_bet lockout check, lock_round eligibility.

```rust
// In place_bet validation
let clock = Clock::get()?;
let lockout_at = pixel_state.opened_at + BETTING_WINDOW_SECONDS; // i64 + i64
require!(clock.unix_timestamp < lockout_at, PixelPredictError::BettingLocked);
```

### Pattern 6: U128 Parimutuel Payout Math
**What:** Cast to u128 before any multiplication to prevent overflow; multiply before divide.
**When to use:** All payout calculations in claim_winnings and resolve_round rake math.

```rust
// Source: https://www.helius.dev/blog/solana-arithmetic
// SC-12: u128 intermediates, multiply-before-divide

pub fn calculate_payout(
    bet_amount: u64,
    color_pool: u64,
    total_pool: u64,
) -> Result<u64> {
    // gross_payout = (bet_amount / color_pool) * total_pool
    // Rewritten as multiply-before-divide:
    // gross_payout = (bet_amount * total_pool) / color_pool
    // net_payout = gross_payout * 95 / 100

    let net_pool = (total_pool as u128)
        .checked_mul(95)
        .ok_or(PixelPredictError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;

    let payout = (bet_amount as u128)
        .checked_mul(net_pool)
        .ok_or(PixelPredictError::ArithmeticOverflow)?
        .checked_div(color_pool as u128)
        .ok_or(PixelPredictError::ArithmeticOverflow)?;

    // Safe narrowing — payout cannot exceed total_pool (u64 range)
    u64::try_from(payout).map_err(|_| error!(PixelPredictError::ArithmeticOverflow))
}
```

### Pattern 7: Rake Transfer in resolve_round
**What:** Atomically transfer treasury (3%) and jackpot (2%) shares from PixelState PDA.
**When to use:** resolve_round, immediately before updating status to Resolved.

```rust
// Treasury and jackpot are program constants (hardcoded pubkeys, not admin-settable)
pub const TREASURY_WALLET: Pubkey = pubkey!("...");
pub const JACKPOT_WALLET: Pubkey = pubkey!("...");

// In resolve_round:
let rake = (total_pool as u128)
    .checked_mul(RAKE_BPS as u128).ok_or(err)?
    .checked_div(10_000).ok_or(err)? as u64;

let treasury_cut = (total_pool as u128)
    .checked_mul(TREASURY_BPS as u128).ok_or(err)?
    .checked_div(10_000).ok_or(err)? as u64;

let jackpot_cut = rake - treasury_cut; // Remainder avoids rounding divergence

**ctx.accounts.pixel_state.to_account_info().try_borrow_mut_lamports()? -= rake;
**ctx.accounts.treasury_wallet.to_account_info().try_borrow_mut_lamports()? += treasury_cut;
**ctx.accounts.jackpot_wallet.to_account_info().try_borrow_mut_lamports()? += jackpot_cut;
```

### Pattern 8: SC-17 Future Pixel Betting
**What:** SC-17 requires betting on future pixels before their round is open. The PixelState for a future pixel does not yet exist. This requires `init_if_needed` on PixelState OR a separate "future bet" account that activates when the round opens.
**Recommended approach:** Allow `place_bet` on a PixelState that is in `Open` status (current round) OR allow creation of a BetAccount for any pixel_index >= current_pixel_index even if PixelState doesn't exist yet. The BetAccount is the canonical bet record; PixelState pool totals are updated when the round opens (lazy initialization) or the PixelState is created at open_round time with zero pools, allowing pre-existing BetAccounts to contribute.
**Simpler alternative:** Require PixelState to exist (created by open_round) before betting. Future pixel betting requires the oracle to open future rounds in advance. This matches the SPEC description: oracle opens one round at a time, sequential. Future pixels = oracle hasn't opened them yet. Clarification: SPEC says "Players may place bets on future pixels before those pixels become the active round" — this implies the PixelState must be openable or betting must work without it.
**Resolution:** See Open Questions.

### Anti-Patterns to Avoid
- **Using `u64` for intermediate payout calculations:** Integer overflow for large pools multiplied by bet amounts. Always cast to `u128` first.
- **Dividing before multiplying in payout:** `(bet / pool) * total` loses precision. Always `(bet * total) / pool`.
- **Accepting user-provided bump seeds:** Allows PDA spoofing. Always use Anchor's canonical `bump` constraint.
- **Using `require_eq!` for pubkey comparison:** Expensive. Use `require_keys_eq!` instead.
- **Storing treasury/jackpot addresses in a config PDA:** Makes funds admin-redirectable. Hardcode as constants.
- **Updating `correct_predictions` at resolve time:** Would require iterating all BetAccounts — unbounded compute. Update at `claim_winnings` time instead (SC-15 confirms this).
- **Using `saturating_sub`/`saturating_add` on financial values:** Silently masks overflow. Use `checked_*` with explicit error returns.
- **Using bankrun for tests:** Deprecated as of March 2025. Use LiteSVM.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Account ownership validation | Manual owner field checks | `Account<'info, T>` constraint | Anchor auto-validates owner == program_id |
| Signer verification | Manual `is_signer` field check | `Signer<'info>` type | Anchor enforces at constraint level |
| Account space calculation | Manual byte counting | `#[derive(InitSpace)]` | Eliminates off-by-one rent errors |
| PDA derivation in constraints | Manual `find_program_address` | `seeds = [...], bump` | Anchor validates canonical bump automatically |
| SOL transfer from user to PDA | Manual invoke | `system_program::transfer` CPI | Standard, handles edge cases |
| Test time manipulation | Sleep/wait in tests | `svm.setClock(...)` in LiteSVM | Instant, deterministic, reproducible |
| Overflow protection (Cargo) | Manual checked everywhere | `overflow-checks = true` in Cargo.toml | Compiler enforces; still use checked_* for u128 |

**Key insight:** Anchor's type system and constraint macros eliminate entire classes of authorization bugs that are common in native Solana programs. Trust the framework constraints — they generate secure validation code automatically.

---

## Common Pitfalls

### Pitfall 1: Pyth Entropy is EVM-Only
**What goes wrong:** You attempt to integrate Pyth Entropy on Solana. There is no Solana SDK. The integration cannot be completed.
**Why it happens:** The locked decision in CONTEXT.md specifies Pyth Entropy, but as of March 2026, Pyth Entropy only supports EVM chains. All documentation describes EVM-based smart contracts. No Solana Anchor SDK exists for Pyth Entropy.
**How to avoid:** Resolve VRF provider choice before implementing resolve_round. Options: Switchboard Randomness v3 (SGX enclaves, single-transaction, Program ID `RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh`) or ORAO VRF (multi-node, Anchor SDK, crate: `orao-solana-vrf`).
**Warning signs:** No `entropy` package found on crates.io for Solana; no Pyth Entropy program ID on Solana devnet.

### Pitfall 2: Rent Exemption Violation on Lamport Drain
**What goes wrong:** `claim_winnings` or rake transfer drains PixelState below rent-exempt minimum, causing the account to be garbage collected and breaking state.
**Why it happens:** Direct lamport subtraction bypasses the System Program's rent checks.
**How to avoid:** Before any lamport drain from PixelState, verify `remaining_lamports >= Rent::get()?.minimum_balance(pixel_state_space)`. The PixelState can safely drop to rent-minimum after all claims are complete (not zero).
**Warning signs:** Accounts disappearing after claim; test failures on final claim of a pixel.

### Pitfall 3: Re-initialization Attack via init_if_needed
**What goes wrong:** Malicious user calls `place_bet` on an already-claimed BetAccount with different arguments, resetting the `claimed` flag to false and double-claiming.
**Why it happens:** `init_if_needed` only skips initialization if the account exists — but it still validates constraints. The `claimed` flag must be checked in a `constraint = !bet_account.claimed` on the bet account.
**How to avoid:** Add explicit re-initialization guard: `constraint = !bet_account.claimed @ PixelPredictError::AlreadyClaimed`. Also verify bet_account.color == color on second calls.
**Warning signs:** Double-claim test fails to reject; `init_if_needed` without claimed check.

### Pitfall 4: Integer Truncation to Zero for Small Bets
**What goes wrong:** A 1-lamport bet against a 10 SOL pool calculates payout = (1 * total_net_pool) / color_pool. With u64, this likely truncates to 0 payout even though the bet is a winner. SC-12 explicitly requires this NOT truncate to zero.
**Why it happens:** (1 * 9_500_000_000) / 10_000_000_000 = 0 in integer math.
**How to avoid:** Use u128 intermediates — (1u128 * 9_500_000_000u128) / 10_000_000_000u128 = 0 still. The minimum payout can be 0 lamports for extremely small bets against large pools — this is mathematically correct, not a bug. SC-12 requires the math to be correct (no additional truncation beyond integer floor). A 1-lamport bet in a 10 SOL pool legitimately rounds to 0. The requirement means: do not truncate BEFORE division, ensure the calculation uses full precision.
**Warning signs:** Test: bet_amount = 10_000_000 (0.01 SOL), color_pool = 10_000_000 (only 1 better), total_pool = 10_000_000 → payout should be 9_500_000 (not 0).

### Pitfall 5: unique_wallets Counter Race Condition
**What goes wrong:** SeasonState.unique_wallets is incremented for every new PlayerSeasonStats account, but if a player places multiple bets in rapid succession, parallel transactions could both init PlayerSeasonStats and both increment unique_wallets.
**Why it happens:** Solana processes transactions sequentially per account (sealevel), but the counter increment and account init are not atomic across different accounts.
**How to avoid:** Increment unique_wallets only when PlayerSeasonStats is freshly initialized (not on `init_if_needed` calls where account already exists). Check `player_stats.total_bets == 0` before incrementing. Or accept eventual inconsistency — the counter is informational, not financial.
**Warning signs:** unique_wallets count exceeds actual unique player count in tests.

### Pitfall 6: SC-17 Future Pixel Betting Complexity
**What goes wrong:** SC-17 requires betting on future pixels, but PixelState PDAs are initialized by open_round (oracle-only). If a player tries to place a bet on pixel 5 while pixel 3 is active, PixelState for pixel 5 does not exist.
**Why it happens:** BetAccount seeds include pixel_index, but PixelState is the escrow account holding funds. If PixelState doesn't exist, the SOL has nowhere to go.
**How to avoid:** Two implementation options: (a) Oracle opens PixelState accounts in advance (sequential, oracle opens pixel N+1 when pixel N opens), (b) BetAccount acts as a "pending bet" with funds held in BetAccount PDA, and funds transfer to PixelState at open_round time. Option (b) is more complex but user-friendly. Option (a) is simpler. See Open Questions.
**Warning signs:** Transaction fails with "account not initialized" on future pixel bet.

### Pitfall 7: Overflow-Checks Not Set in Release Profile
**What goes wrong:** In release builds (what Solana executes), Rust's default is to wrap on overflow silently. Without `overflow-checks = true`, a pool overflow creates incorrect payouts.
**Why it happens:** `anchor init` sets this, but it can be accidentally removed.
**How to avoid:** Verify workspace `Cargo.toml` contains:
```toml
[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
```
**Warning signs:** Debug tests pass, release deploy has incorrect arithmetic.

### Pitfall 8: Zero-Winner Round Missing Branch
**What goes wrong:** resolve_round resolves with a color that has color_pools[winning_color] == 0 (no one bet on it). Without a zero-winner branch, the 95% net pool has no one to distribute to and stays in PixelState forever.
**Why it happens:** SC-13 requires transferring net pool to treasury in this case, but it is easy to omit this branch.
**How to avoid:** In resolve_round, after setting winning_color: `if pixel_state.color_pools[winning_color as usize] == 0 { transfer net_pool to treasury }`.
**Warning signs:** Integration test for zero-winner round fails; funds locked in PixelState after resolve.

---

## Code Examples

Verified patterns from official sources and architecture research:

### Cargo.toml — Overflow Protection
```toml
# Source: https://www.anchor-lang.com/docs/updates/release-notes/0-32-0
[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
```

### Account Struct with InitSpace
```rust
// Source: https://www.helius.dev/blog/an-introduction-to-anchor-a-beginners-guide-to-building-solana-programs
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PixelState {
    pub season_number: u16,
    pub pixel_index: u16,
    pub x: u8,
    pub y: u8,
    pub status: RoundStatus,      // u8 via repr
    pub color_pools: [u64; 16],   // 128 bytes
    pub total_pool: u64,
    pub winning_color: Option<u8>,
    pub shade: Option<u8>,
    pub warmth: Option<u8>,
    pub prompt_hash: [u8; 32],
    pub vrf_resolved: bool,
    pub opened_at: i64,
    pub locked_at: Option<i64>,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}

// Space: 8 (disc) + PixelState::INIT_SPACE
```

### Payout Calculation — Correct Pattern
```rust
// SC-12: multiply-before-divide, u128 intermediates
// Source: https://www.helius.dev/blog/solana-arithmetic
pub fn calculate_winner_payout(
    bet_amount: u64,
    winning_color_pool: u64,
    total_pool: u64,
) -> Result<u64> {
    // net_pool = total_pool * 95 / 100 (5% rake already transferred)
    // payout = bet_amount * net_pool / winning_color_pool
    let net_pool = (total_pool as u128)
        .checked_mul(95)
        .ok_or(error!(PixelPredictError::Overflow))?
        .checked_div(100)
        .ok_or(error!(PixelPredictError::Overflow))?;

    let payout = (bet_amount as u128)
        .checked_mul(net_pool)
        .ok_or(error!(PixelPredictError::Overflow))?
        .checked_div(winning_color_pool as u128)
        .ok_or(error!(PixelPredictError::Overflow))?;

    u64::try_from(payout).map_err(|_| error!(PixelPredictError::Overflow))
}
```

### LiteSVM TypeScript Test — Time Warp
```typescript
// Source: https://rareskills.io/post/litesvm
// https://www.anchor-lang.com/docs/testing/litesvm
import { LiteSVM, Clock } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import * as anchor from "@coral-xyz/anchor";

describe("lock_round after 28 minutes", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;

  before(async () => {
    svm = fromWorkspace("./").withSplPrograms().withBuiltins().withSysvars();
    provider = new LiteSVMProvider(svm);
    anchor.setProvider(provider);
  });

  it("rejects lock_round before 28 minutes", async () => {
    // ... open round, place bets ...
  });

  it("accepts lock_round after 28 minutes", async () => {
    const c = svm.getClock();
    // Advance 28 minutes + 1 second
    svm.setClock(
      new Clock(c.slot, c.epochStartTimestamp, c.epoch,
        c.leaderScheduleEpoch, c.unixTimestamp + BigInt(1681))
    );
    await program.methods.lockRound().accounts({ ... }).rpc();
  });
});
```

### Oracle Authorization with Config PDA
```rust
// Pattern: Config PDA stores rotatable oracle key
// Admin can update oracle_pubkey without redeployment

#[account]
#[derive(InitSpace)]
pub struct ConfigAccount {
    pub admin: Pubkey,
    pub oracle_pubkey: Pubkey,
    pub bump: u8,
}

// In open_round / resolve_round accounts:
#[derive(Accounts)]
pub struct OpenRound<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = oracle @ PixelPredictError::UnauthorizedOracle,
    )]
    pub config: Account<'info, ConfigAccount>,
    pub oracle: Signer<'info>,
    // ...
}

// Admin instruction to rotate oracle key:
pub fn update_oracle(ctx: Context<UpdateOracle>, new_oracle: Pubkey) -> Result<()> {
    ctx.accounts.config.oracle_pubkey = new_oracle;
    Ok(())
}
```

### Zero-Winner Branch in resolve_round
```rust
// SC-13: If nobody bet on the winning color, send net pool to treasury
let winning_pool = pixel_state.color_pools[winning_color as usize];
if winning_pool == 0 {
    // Transfer net pool (95%) directly to treasury
    let net_pool = (total_pool as u128)
        .checked_mul(95).ok_or(err)?
        .checked_div(100).ok_or(err)? as u64;
    let full_rake = total_pool - net_pool; // Remaining 5% already sent above

    **pixel_state.to_account_info().try_borrow_mut_lamports()? -= net_pool;
    **ctx.accounts.treasury_wallet.to_account_info().try_borrow_mut_lamports()? += net_pool;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bankrun for TypeScript tests | LiteSVM | March 2025 | Bankrun deprecated; LiteSVM is 10x faster and actively maintained |
| Switchboard VRF v2 | Switchboard Randomness v3 (SGX) | 2024-2025 | v2 repos are marked `-deprecated`; v3 is single-transaction |
| Manual space calculation | `#[derive(InitSpace)]` | Anchor 0.28+ | Eliminates off-by-one rent errors |
| `@project-serum/anchor` | `@coral-xyz/anchor` | Anchor 0.26+ | Package renamed; old package abandoned |
| Mocha-only testing | LiteSVM + Mocha OR Rust unit tests | 2025 | Hybrid approach now standard |

**Deprecated/outdated:**
- `@project-serum/anchor`: Use `@coral-xyz/anchor` only
- Bankrun: Deprecated March 2025. Use LiteSVM.
- Switchboard VRF v2: Marked `-deprecated` on GitHub. Use v3 (randomness-on-demand) or ORAO.
- `anchor-lang` feature `idl-build` omission: Required since 0.30. Without it, IDL generation fails.

---

## Open Questions

1. **VRF Provider (CRITICAL — BLOCKER)**
   - What we know: Pyth Entropy is EVM-only as of March 2026. No Solana SDK exists.
   - What's unclear: User's intent — did they mean a different provider, or is this a new decision to be made?
   - Viable alternatives on Solana:
     - **Switchboard Randomness v3**: SGX enclaves, single-transaction (no async callback), Program ID `RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh`, crate `solana-randomness-service` v1.0.2. Anchor 0.31.1 compatible per docs (0.32 CPI compatibility unconfirmed but likely).
     - **ORAO VRF**: Multi-node oracle, Anchor-native SDK, crate `orao-solana-vrf`, sub-second fulfillment, 0.001 SOL per request. Production-proven in casino games on Solana.
   - Recommendation: Choose **ORAO VRF** if the two-party async callback pattern is acceptable, or **Switchboard v3** for single-transaction simplicity. Both are production-ready on Solana. The CONTEXT.md fallback model (retry every 5 min, fallback after 30 min) is compatible with either.
   - Action needed: User must unlock this decision before Wave 1 can include resolve_round VRF path.

2. **SC-17 Future Pixel Betting — Implementation Approach**
   - What we know: Players can bet on future pixels (pixels not yet active). PixelState is created by oracle at open_round time, one pixel at a time.
   - What's unclear: Does the oracle pre-open PixelState for future pixels? Or does the BetAccount hold funds without a PixelState?
   - Option A (Simpler): Oracle opens PixelState for pixel N and pixel N+1 simultaneously at each round open. BetAccount SOL flows to PixelState on placement.
   - Option B (Complex): BetAccount exists without PixelState; funds held in BetAccount PDA. At open_round, a settlement step sweeps pending BetAccounts into PixelState pool.
   - Recommendation: Option A — pre-opening one round ahead. It keeps the SOL custody model simple (always in PixelState) and avoids a sweep instruction. Planner should design open_round to accept a `next_pixel_index` argument to pre-initialize the next round.

3. **Prompt Data in resolve_round**
   - What we know: CONTEXT.md says resolve_round does NOT receive prompt_data as Vec<u8>. SPEC.md says "Posts on-chain: winning color, shade, warmth, and the full prompt text." There is a contradiction.
   - What's unclear: Where is the Arweave txId stored? Is it a field in PixelState? Is it emitted as an event?
   - Recommendation: Add `arweave_txid: [u8; 43]` (Arweave txIds are base58, 43 chars) to PixelState. Oracle posts the Arweave txId after uploading prompt data. This field is optional/None until resolution. Alternatively use Anchor events.

---

## Validation Architecture

> nyquist_validation is enabled (config.json confirms true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha + Chai (TypeScript integration) + Rust `#[cfg(test)]` (unit) |
| Config file | `Anchor.toml` (test.scripts.test) + `tsconfig.json` |
| Quick run command | `anchor test -- --grep "payout math"` |
| Full suite command | `anchor test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | Admin initializes season with 10x10 grid | Integration | `anchor test -- --grep "SC-01"` | ❌ Wave 0 |
| SC-02 | Oracle opens round with prompt hash | Integration | `anchor test -- --grep "SC-02"` | ❌ Wave 0 |
| SC-03 | Player places bet on open pixel | Integration | `anchor test -- --grep "SC-03"` | ❌ Wave 0 |
| SC-04 | Player increases bet before lockout | Integration | `anchor test -- --grep "SC-04"` | ❌ Wave 0 |
| SC-05 | Second color bet rejected on same pixel | Integration | `anchor test -- --grep "SC-05"` | ❌ Wave 0 |
| SC-06 | Min/max bet enforced | Unit + Integration | `cargo test test_bet_constraints` + `anchor test -- --grep "SC-06"` | ❌ Wave 0 |
| SC-07 | lock_round permissionless, time-gated | Integration (LiteSVM setClock) | `anchor test -- --grep "SC-07"` | ❌ Wave 0 |
| SC-08 | Oracle resolves with winning color | Integration | `anchor test -- --grep "SC-08"` | ❌ Wave 0 |
| SC-09 | 3%/2% rake transferred atomically | Integration | `anchor test -- --grep "SC-09"` | ❌ Wave 0 |
| SC-10 | Proportional payout claim | Unit + Integration | `cargo test test_payout_math` + `anchor test -- --grep "SC-10"` | ❌ Wave 0 |
| SC-11 | Unclaimed winnings persist | Integration | `anchor test -- --grep "SC-11"` | ❌ Wave 0 |
| SC-12 | u128 math, multiply-before-divide | Unit | `cargo test test_u128_payout` | ❌ Wave 0 |
| SC-13 | Zero-winner round → treasury | Unit + Integration | `cargo test test_zero_winner` + `anchor test -- --grep "SC-13"` | ❌ Wave 0 |
| SC-14 | Season auto-completes at pixel 100 | Integration | `anchor test -- --grep "SC-14"` | ❌ Wave 0 |
| SC-15 | Player stats updated at claim time | Integration | `anchor test -- --grep "SC-15"` | ❌ Wave 0 |
| SC-16 | VRF fallback sets vrf_resolved flag | Integration (pending VRF decision) | `anchor test -- --grep "SC-16"` | ❌ Wave 0 |
| SC-17 | Bet on future pixel accepted | Integration | `anchor test -- --grep "SC-17"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test` (Rust unit tests for math)
- **Per wave merge:** `anchor test` (full integration suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/pixel-predict.ts` — covers all SC-* integration tests
- [ ] `programs/pixel-predict/src/tests/payout.rs` — SC-12, SC-13 unit tests
- [ ] `programs/pixel-predict/src/tests/constraints.rs` — SC-05, SC-06 unit tests
- [ ] Framework install: `npm install --save-dev litesvm anchor-litesvm @types/mocha ts-mocha`
- [ ] `tsconfig.json` — TypeScript config for test compilation
- [ ] LiteSVM time-warp setup in test `before()` hook

---

## Sources

### Primary (HIGH confidence)
- `anchor-lang 0.32.1` — https://docs.rs/crate/anchor-lang/latest — version, features, InitSpace, constraints
- Anchor Account Constraints — https://www.anchor-lang.com/docs/references/account-constraints — init_if_needed, seeds, has_one, constraint, close
- Anchor Local Development — https://www.anchor-lang.com/docs/quickstart/local — project structure, build/test/deploy workflow
- Helius Solana Arithmetic — https://www.helius.dev/blog/solana-arithmetic — u128 multiply-before-divide, checked arithmetic patterns
- Solana Store SOL in PDA — https://solana.com/developers/guides/games/store-sol-in-pda — direct lamport mutation pattern
- Anchor LiteSVM docs — https://www.anchor-lang.com/docs/testing/litesvm — LiteSVM integration with Anchor
- RareSkills LiteSVM — https://rareskills.io/post/litesvm — setClock time-warp pattern
- Pyth Entropy docs — https://docs.pyth.network/entropy — confirmed EVM-only, no Solana support

### Secondary (MEDIUM confidence)
- Zealynx Security Checklist — https://www.zealynx.io/blogs/solana-security-checklist — 45 security checks verified against official Anchor docs
- Helius Guide to Testing — https://www.helius.dev/blog/a-guide-to-testing-solana-programs — testing frameworks, Bankrun deprecation
- Switchboard Randomness Tutorial — https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial — v3 SGX pattern, Program ID
- ORAO VRF — https://github.com/orao-network/solana-vrf — Anchor SDK, crate orao-solana-vrf
- Helius Anchor Beginner Guide — https://www.helius.dev/blog/an-introduction-to-anchor-a-beginners-guide-to-building-solana-programs — InitSpace, CPI, error patterns

### Tertiary (LOW confidence — flag for validation)
- Switchboard v3 Anchor 0.32 CPI compatibility — only v0.31.1 confirmed in docs; 0.32 assumed compatible but unverified
- ORAO VRF production stability — production use in casino apps observed but no formal SLA docs found

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Anchor 0.32.1 confirmed via official GitHub releases; LiteSVM confirmed via official Anchor docs
- Architecture: HIGH — Account structures match SPEC.md; patterns verified via official docs and Helius guides
- Payout math: HIGH — multiply-before-divide and u128 verified via official Helius arithmetic guide
- VRF: LOW — Pyth Entropy confirmed unavailable on Solana; alternatives researched but Anchor 0.32 compatibility for Switchboard v3 not formally confirmed
- Testing: HIGH — LiteSVM + Mocha pattern confirmed via Anchor official docs

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack, 30 days); VRF section needs re-check if Pyth adds Solana support
