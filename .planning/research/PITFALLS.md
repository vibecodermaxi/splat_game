# Pitfalls Research

**Domain:** Solana prediction market / crypto betting game with AI oracle
**Researched:** 2026-03-16
**Confidence:** HIGH (critical pitfalls verified against official docs and security audit literature; AI oracle non-determinism verified against Anthropic docs)

---

## Critical Pitfalls

### Pitfall 1: Temperature 0 Does Not Guarantee Determinism

**What goes wrong:**
The SPEC assumes temperature 0 produces deterministic outputs that anyone can independently verify. Anthropic's own documentation explicitly states: "Even with temperature set to 0, the results will not be fully deterministic." Players trying to verify results by re-running the published prompt will sometimes get a different color output, destroying trust in the fairness guarantee.

**Why it happens:**
GPU floating-point arithmetic is non-associative. When requests are batched with other API calls, execution order differs, producing slightly different probability calculations. Mixture-of-Experts routing varies by batch. Claude's parallel server infrastructure means no two requests are guaranteed to hit the same hardware or batching group.

**How to avoid:**
Reframe the verifiability guarantee. The commit-reveal scheme is still valuable — it proves the oracle committed to a specific prompt before seeing bets, which prevents the oracle from choosing a winner after knowing the pool distribution. But the public documentation must be honest: "Anyone with the published prompt can send it to Claude at temperature 0 and will almost always get the same result. In the rare case of a discrepancy, the on-chain prompt hash proves the prompt was committed before betting closed." Do not claim bit-for-bit reproducibility. The fairness guarantee is about prompt commitment, not deterministic AI output.

**Warning signs:**
- Docs or marketing copy saying "anyone can verify the exact result by running the same prompt" without qualification
- No distinction in player-facing copy between prompt commitment proof and result reproduction

**Phase to address:**
Smart contract and oracle foundation phase. Nail down the actual verifiability claim before it ships to docs or marketing copy.

---

### Pitfall 2: Integer Division Order Causes Exploitable Precision Loss in Payouts

**What goes wrong:**
The payout formula in the SPEC is: `payout = (player_bet / winning_color_pool) × (total_pool × 95 / 100)`. If implemented naively in Rust with integer arithmetic, the division `player_bet / winning_color_pool` executes first, truncating to zero for any bet smaller than the color pool. Winners receive 0 lamports. Or, the aggregate rounding across all winners leaves lamports permanently stranded in the PixelState PDA. This is how the SPL token-lending vulnerability enabled $27M/hour theft — small per-operation rounding errors stacked via repeated instructions.

**Why it happens:**
Solana programs compile in release mode by default, which silently wraps on overflow and silently truncates on integer division. The order of operations in proportional payout math is non-obvious. Developers write formulas that look correct in Python (which uses floats) but truncate catastrophically in u64 Rust.

**How to avoid:**
Always multiply before dividing. The correct formula: `payout = (player_bet * total_pool * 95) / (winning_color_pool * 100)`. Use u128 for intermediates (u64 * u64 overflows u64). Use `checked_mul`, `checked_div` everywhere — any None result should error, never silently produce 0. Add a dust-collection step at resolve time: any lamports remaining in the PixelState PDA after all valid payouts are claimable should route to treasury. Write a table-driven test covering the exact arithmetic with known inputs before any on-chain testing.

**Warning signs:**
- Payout formula uses division before multiplication anywhere
- Arithmetic uses `*` and `/` directly instead of `checked_mul` / `checked_div`
- No test cases with small bet amounts (1 lamport, minimum bet)
- Stranded lamports accumulate in PixelState PDAs with no recovery mechanism

**Phase to address:**
Anchor program development phase, specifically the `claim_winnings` instruction. Must be caught before devnet testing begins.

---

### Pitfall 3: Oracle Private Key Is a Single Point of Catastrophic Failure

**What goes wrong:**
The oracle keypair signs `open_round` and `resolve_round`. If this key is compromised, an attacker can resolve any round to any color immediately — draining every betting pool to themselves. There is no recourse. Real-world examples: Ronin Network lost $625M via 5 compromised validator keys; Harmony Bridge lost $100M via 2 compromised multisig keys. This project's oracle is a single key.

**Why it happens:**
For simplicity, developers store the oracle keypair as a JSON array in an environment variable (`ORACLE_KEYPAIR` in the SPEC). Railway environment variables are accessible to anyone with project access. The key lives in memory on the Railway process and in whatever CI/CD system manages deployments.

**How to avoid:**
At minimum: generate a dedicated oracle keypair with no other balances. Store it in Railway's encrypted secrets, not a plain env var on a shared account. The oracle wallet should hold only the lamports needed for transaction fees — the actual betting pools live in PixelState PDAs (good). Consider upgrading to a multisig-controlled upgrade authority separate from the oracle key. Document key rotation procedures before launch. For V1, the oracle key compromise lets an attacker steal pool contents but cannot upgrade the program if the upgrade authority is a separate cold key.

**Warning signs:**
- Oracle keypair stored alongside other secrets in the same .env file
- Oracle wallet holds significant SOL beyond transaction fee reserves
- No documented procedure for what happens if the oracle key leaks
- Single person has access to both the Railway project and the oracle keypair

**Phase to address:**
Infrastructure setup phase. Key generation and storage discipline must be established before any mainnet deployment.

---

### Pitfall 4: Railway Cron Is Not Reliable Enough for Real-Money Round Timing

**What goes wrong:**
The SPEC runs the oracle on Railway triggered by cron every 30 minutes. Railway's cron implementation is documented to: skip runs if a previous execution is still running, execute with up to 90 seconds delay, and intermittently miss scheduled triggers entirely (users report skipping hours-long stretches). For a game where rounds are time-locked and real money is committed, a missed trigger means a round that never resolves — bet funds stuck, countdown frozen, players angry.

**Why it happens:**
Railway cron is a convenience feature, not a high-reliability scheduler. It was designed for background jobs where occasional misses are acceptable. The oracle service is stateless by design (which is correct), but relying on Railway's scheduler as the triggering mechanism introduces an external reliability dependency that doesn't match the reliability requirements of financial round settlement.

**How to avoid:**
Replace Railway cron with an in-process scheduler. Use a Node.js `setInterval` or a library like `node-cron` running inside the always-on Railway process. The process stays running continuously; the scheduler ticks internally on a 30-minute cycle. Add a separate watchdog: a Helius webhook on the SeasonState account that fires an alert if `current_pixel_index` hasn't incremented in 40 minutes (already in the SPEC for monitoring — this is the right safety net). Add a manual `POST /trigger-round` endpoint on the oracle service for emergency manual triggers when the scheduler fails.

**Warning signs:**
- Using Railway cron as the sole trigger mechanism with no in-process fallback
- No alerting when a round hasn't resolved within 35-40 minutes
- No manual trigger mechanism for operators

**Phase to address:**
Oracle service development phase. Architecture decision before writing the scheduler code.

---

### Pitfall 5: `init_if_needed` on BetAccount Enables Reinitialization Attack

**What goes wrong:**
The SPEC uses `init_if_needed` for BetAccount creation in `place_bet`. The vulnerability: if an attacker can drain a BetAccount's lamports to zero (e.g., close it somehow), they can reinitialize it — resetting `color` and `amount` to whatever they choose. In the worst case: a player bets on color A, the round resolves to color B (they lose), the player reinitializes their BetAccount with color B set, and calls `claim_winnings`. They claim a win they didn't earn.

**Why it happens:**
`init_if_needed` is a convenience macro that silently allows account recreation. Anchor considers an account "uninitialized" if its balance is zero or it's owned by the system program, regardless of past history. The pattern is seductive for places where you genuinely want "create if not exists" semantics, but it creates a correctness hole if there's any mechanism to close or drain the account later.

**How to avoid:**
Use a separate `init_bet` instruction (or keep `init_if_needed` but add an `initialized: bool` field to BetAccount that is checked on every subsequent write). The safest pattern: `init_if_needed` is acceptable here because the SPEC never provides a mechanism to drain BetAccount lamports — the BetAccount is only written to by the player. But validate this assumption explicitly. Add a `#[account(constraint = bet.initialized == false @ Error::AlreadyInitialized)]` check in any instruction that initializes, and set `initialized = true` on creation. Do not add a "withdraw bet" instruction that reduces BetAccount balance.

**Warning signs:**
- `init_if_needed` used on accounts that hold financial state without an `initialized` flag
- Any instruction that can zero out or reassign a BetAccount
- No explicit test case: "player reinitializes a closed bet account"

**Phase to address:**
Anchor program development phase, `place_bet` instruction design.

---

### Pitfall 6: Solana RPC WebSocket Events Are Unreliable Under Load

**What goes wrong:**
The frontend subscribes to PixelState account changes via Helius WebSocket for live pool updates. Under congestion, WebSocket subscriptions on Solana exhibit documented 15+ second delays and silent data loss (events delivered late or not at all). The frontend shows stale odds; a player's bet confirmation doesn't appear; the countdown timer drifts from actual chain time. The game feels broken. At 75% transaction failure rates seen on Solana during April 2024 peak congestion, any interactive betting UI dependent purely on WebSocket events will visibly malfunction.

**Why it happens:**
Solana's WebSocket infrastructure reflects node synchronization state, not finalized chain state. Rapid slot production (400ms) combined with occasional multi-slot catch-up syncs overwhelms subscriber throughput. Free-tier RPC nodes deprioritize WebSocket traffic under load.

**How to avoid:**
The SPEC already documents a polling fallback (every 15 seconds) and exponential backoff WebSocket reconnect — both are correct. Add one more layer: treat the countdown timer as client-side-only, initialized from the `opened_at` on-chain timestamp. Never update the timer from WebSocket events (use only the initial timestamp). Poll the active PixelState every 30 seconds in parallel with WebSocket, taking whichever data is fresher. For the round resolution moment specifically, add a 5-second polling burst (every 1 second for 5 seconds) triggered when countdown reaches zero, ensuring resolution is detected quickly even if the WebSocket event was missed.

**Warning signs:**
- Countdown timer derived from WebSocket events rather than `opened_at` + clientside elapsed time
- No polling fallback for round resolution detection
- Frontend tested only on local devnet (no WebSocket congestion simulation)

**Phase to address:**
Frontend development phase, real-time data layer.

---

### Pitfall 7: Missing Signer Verification on Oracle Instructions

**What goes wrong:**
If `open_round` or `resolve_round` fail to properly validate the oracle's signature, any account that supplies the oracle's public key as an argument can call these instructions — without actually holding the oracle's private key. The Wormhole exploit ($320M loss) occurred because the program verified a pubkey without checking `is_signer`. An attacker passes the oracle pubkey as an account but signs with their own key, posting a fraudulent resolution.

**Why it happens:**
In Anchor, account constraint syntax can be ambiguous. `has_one = oracle` checks that a stored pubkey matches, but doesn't check that the account signed the transaction unless the account type is `Signer<'info>`. New Anchor developers confuse key-equality checks with signature checks.

**How to avoid:**
Declare oracle accounts as `Signer<'info>` in the Anchor accounts struct, not as `AccountInfo` or `UncheckedAccount`. The Anchor `Signer` type automatically validates `is_signer = true`. Additionally, add a stored `oracle_pubkey` in SeasonState and verify the signer's key matches. Use Anchor's `constraint` macro: `#[account(constraint = oracle.key() == season.oracle_pubkey @ Error::UnauthorizedOracle)]`.

**Warning signs:**
- Oracle account declared as `AccountInfo<'info>` instead of `Signer<'info>`
- `has_one` check on oracle keypair without Signer type
- No explicit test: "attacker calls resolve_round with oracle pubkey but wrong signing key"

**Phase to address:**
Anchor program development phase. This is the first security check to write before anything else in oracle-gated instructions.

---

### Pitfall 8: Zero-Winner Rounds Leave Funds Permanently Stranded

**What goes wrong:**
If no player bets on the winning color, `color_pools[winning_color] == 0`. The claim_winnings instruction is never callable (no winners). But the total_pool lamports — minus rake already transferred — sit in the PixelState PDA forever. There is no expiry, no sweep mechanism, no admin recovery. Over 100 rounds per season, this can accumulate to significant stranded SOL.

**Why it happens:**
The SPEC's FAQ acknowledges the edge case ("What happens if nobody bets on the winning color?") but defers the answer — "No winners, full pool rolls to treasury/jackpot minus nothing to distribute." The phrase "rolls to treasury" implies an action, but the contract has no instruction to execute that transfer.

**How to avoid:**
In `resolve_round`, check if `color_pools[winning_color] == 0`. If so, transfer the full net pool (total_pool * 95 / 100) to the treasury wallet as part of the same instruction. This makes the FAQ statement actually true and removes the stranded funds risk. The rake has already been transferred (3% treasury + 2% jackpot), so the remaining 95% goes to treasury in the zero-winner case.

**Warning signs:**
- No branch in `resolve_round` for `winning_color_pool == 0`
- Test suite has no zero-winner test case
- FAQ says funds "roll to" somewhere without a corresponding on-chain instruction

**Phase to address:**
Anchor program development phase, `resolve_round` instruction.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using Railway cron as oracle trigger | Simple setup, no extra code | Missed rounds, stuck funds, player trust damage | Never for production |
| Storing oracle keypair in plain Railway env var | Easy local dev | Leaked key = protocol drain, no recourse | Dev/devnet only |
| Using floats in payout calculation | Readable formula | Solana programs can't use floats; borsh serialization will panic | Never |
| Claiming temperature 0 = deterministic in docs | Simpler fairness story | Players discover discrepancies; community accuses fraud | Never |
| Skipping `checked_*` arithmetic for "simple" additions | Cleaner code | Silent overflow in release builds; lamport theft vector | Never in financial code |
| `init_if_needed` without initialized flag | Less code | Reinitialization attack surface | Acceptable only if no drain/close mechanism exists |
| Pooling oracle and treasury keypairs | Fewer keys to manage | Oracle compromise = treasury drained | Never |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Treating temperature 0 output as guaranteed identical | Document as "near-deterministic"; fairness guarantee is prompt-commitment not output-reproduction |
| Claude API | Not validating response format before on-chain post | Parse COLOR/SHADE/WARMTH from response; if parsing fails, do not post malformed data; enter retry cascade |
| Helius WebSocket | Treating account-change events as the authoritative source of truth | Use events to trigger UI refreshes; poll for confirmation; derive countdown from chain timestamp not events |
| Switchboard VRF | Calling VRF synchronously expecting instant result | VRF is async; design fallback as a two-transaction flow: request VRF, then fulfill on callback |
| Solana RPC | Using public RPC `api.mainnet-beta.solana.com` in production | Always use Helius or equivalent dedicated provider; public endpoint rate-limits and lags under load |
| Solana wallet-adapter | Showing "sign transaction" language in UI | Hide transaction mechanics; show action-result copy instead ("Splatted!" not "Transaction submitted") |
| Railway | Using cron trigger as sole scheduling mechanism | In-process scheduler (`node-cron` or `setInterval`) with cron as optional backup |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Subscribing to all PixelState accounts via WebSocket | Connection overload, missed events, memory leaks | Subscribe to only the active pixel account; re-subscribe on round transitions | At Season 3+ with concurrent viewers |
| Reading all resolved pixels in a single RPC call to build canvas state | Slow canvas load, RPC timeout on full season | Use `getProgramAccounts` with filters; cache canvas state in frontend; only fetch delta on each round resolve | At 50+ filled pixels |
| Iterating all BetAccounts at `resolve_round` to update `correct_predictions` | Transaction exceeds compute unit limit | Defer `correct_predictions` update to `claim_winnings` (the SPEC already notes this; must actually implement it) | With 10+ bettors on a single pixel |
| Re-fetching all season stats from chain on every page visit | Slow initial load, unnecessary RPC load | Cache in browser localStorage; invalidate on round resolution only | At 1000+ page views per day |
| No priority fee on oracle transactions during congestion | Oracle transactions dropped; rounds stuck | Dynamically set `setComputeUnitPrice` based on recent fee percentiles; increase during congestion detection | During any Solana congestion event |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Oracle keypair compromise | Attacker resolves rounds to any color; drains all active pools | Dedicated keypair, minimal balance, documented rotation, separate upgrade authority |
| Missing `is_signer` check on oracle instructions | Anyone can forge a resolution by passing oracle pubkey | Declare oracle as `Signer<'info>` in Anchor accounts struct |
| `place_bet` accepts color index >= 16 | Bets on nonexistent color; undefined behavior in color_pools array access | Explicit bounds check: `require!(color < 16, Error::InvalidColor)` |
| No maximum total bet enforcement in aggregate | Whale bets above 10 SOL cap by splitting across multiple addresses | The cap is per-player per-pixel by design; document this; ensure the validation is per BetAccount not per wallet |
| Bet allowed after round enters Locked status | Late bets after odds are frozen; unfair information advantage | Double-check: both `PixelState.status == Open` AND `timestamp < opened_at + 1680 seconds`; both conditions required |
| Claiming on behalf of another player | Front-run claims, stealing winner's payout | `claim_winnings` must require the player's signature; payout must go to the BetAccount's stored `player` pubkey, not the signer's address |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "transaction failed" with no explanation | User doesn't know if bet was placed; re-places bet; double-spends | Show specific error: insufficient funds, slippage, round locked, etc. Splat brand voice: "Splat failed. Check your SOL balance." |
| Spinner with no timeout | User waits indefinitely; assumes app is broken | 15-second timeout on any transaction; if no confirmation by then, show "Still processing — check My Bets to confirm" |
| Requiring wallet connection before showing game state | Drop-off before engagement | Show live canvas and current odds without a wallet; prompt connection only at bet placement |
| Showing crypto-native error messages | "Error 0x1770: custom program error" is unreadable to casual players | Map all Anchor error codes to human-readable Splat-voice messages before displaying |
| Pool percentages updating in real-time (sub-second) | Enables copycat-sniping; users copy whoever bets just before lockout | The SPEC intentionally uses 60-second refresh intervals for this reason; do not "fix" this with live updates |
| Mobile viewport cuts off betting panel | Player can't see bet confirmation without scrolling | Canvas + betting panel must fit in viewport on iPhone SE (375px width); test at 375px before shipping |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Payout math:** Formula looks correct in isolation — verify with small-number test cases (1 lamport, minimum bet vs. large pool) to catch truncation
- [ ] **Zero-winner case:** Betting UI works and resolve fires — verify what happens to pool lamports when zero bets on winning color
- [ ] **VRF fallback:** Oracle failure handling is coded — verify Switchboard VRF integration actually works end-to-end on devnet (it requires separate program account setup)
- [ ] **Claim All:** "Claim All" button appears functional — verify it batches instructions correctly and doesn't exceed transaction size limits with many unclaimed wins
- [ ] **Season transitions:** Season N ends and Season N+1 starts — verify SeasonState PDA seeds don't collide between seasons; test the 12-hour intermission window
- [ ] **Oracle key rotation:** New keypair generated — verify program's stored oracle_pubkey can be updated via an admin instruction without redeploying
- [ ] **Mobile wallet deep-link:** Bet places on desktop — verify the entire flow (connect wallet → approve transaction → see confirmation) on iOS Safari + Phantom, not just Chrome desktop
- [ ] **Prompt hash verification:** Hash is posted on-chain — verify the hash matches what you get by SHA-256-ing the exact bytes sent to the API (encoding matters: UTF-8, no BOM)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Oracle key compromised | HIGH | Immediately pause oracle (stop Railway process); contact players; deploy program upgrade to rotate oracle pubkey to new key; compensate affected rounds from treasury |
| Payout math bug discovered post-launch | HIGH | Program upgrade to fix arithmetic; manually calculate correct payouts for affected rounds; distribute corrections from treasury; full public post-mortem |
| Round stuck (oracle failure for 30+ min) | LOW | VRF fallback automatically triggers per spec; if VRF also fails, manual `resolve_round` via admin instruction with VRF flag; communicate delay transparently |
| Railway scheduler misses a cron trigger | LOW | Manual POST to oracle `/trigger-round` endpoint; add in-process scheduler to prevent recurrence |
| Stranded lamports in zero-winner PixelState | MEDIUM | Deploy program upgrade with admin sweep instruction; transfer to treasury in batch; document fix publicly |
| WebSocket subscription drops | LOW | Polling fallback auto-activates; users experience slightly stale data for ~15 seconds; no funds at risk |
| Reinitialization attack exploited | HIGH | Freeze program (set upgrade authority to freeze); calculate total fraudulent claims; compensate from treasury; audit all BetAccounts; redeploy with fix |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Temperature 0 non-determinism | Docs/oracle foundation phase | Review all fairness claims in docs; confirm language is "commit-reveal" not "bit-reproducible" |
| Payout precision / integer overflow | Anchor program development | Table-driven arithmetic tests; fuzz small bet amounts |
| Oracle key single point of failure | Infrastructure setup | Dedicated keypair with documented rotation; upgrade authority separated |
| Railway cron unreliability | Oracle service development | In-process scheduler implemented; manual trigger endpoint exists |
| init_if_needed reinitialization | Anchor program development | `initialized` flag on BetAccount; test reinitialization path |
| WebSocket unreliability | Frontend development | Polling fallback tested under simulated disconnection |
| Missing signer check | Anchor program development | Anchor accounts struct uses `Signer<'info>`; test with wrong-key call |
| Zero-winner stranded funds | Anchor program development | Zero-winner test case in test suite |

---

## Sources

- Anthropic official glossary on temperature determinism: https://platform.claude.ai/docs/en/about-claude/glossary
- Helius: Hitchhiker's Guide to Solana Program Security: https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security
- Helius: Solana Arithmetic Best Practices: https://www.helius.dev/blog/solana-arithmetic
- Helius: Web3 UX Onboarding: https://www.helius.dev/blog/web3-ux
- QuillAudits: Solana Prediction Market Security Tradeoffs: https://www.quillaudits.com/blog/prediction-market/solana-prediction-market
- RareSkills: init_if_needed Reinitialization Attack: https://rareskills.io/post/init-if-needed-anchor
- Railway: Cron Job Reliability (community reports): https://station.railway.com/questions/cron-schedule-not-working-44f7e974
- Michael Brenndoerfer: Why LLMs Are Not Deterministic: https://mbrenndoerfer.com/writing/why-llms-are-not-deterministic
- ImmuneBytes: Compromised Private Key Crypto Hacks: https://immunebytes.com/blog/list-of-compromised-private-key-crypto-hacks/
- DLNews: Solana Transaction Failure Rates (April 2024): https://www.dlnews.com/articles/defi/solana-transactions-fail-often-but-not-a-problem-for-users/
- Solana GitHub issue: WebSocket 15s delay and missing data: https://github.com/solana-labs/solana/issues/35489
- Zealynx: Solana Security Checklist: https://www.zealynx.io/blogs/solana-security-checklist

---
*Pitfalls research for: Splat — Solana parimutuel prediction market with AI oracle*
*Researched: 2026-03-16*
