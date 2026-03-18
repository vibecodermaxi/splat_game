# Feature Research

**Domain:** Crypto prediction market game / on-chain generative art betting (Solana)
**Researched:** 2026-03-16
**Confidence:** MEDIUM — Web search unavailable; analysis drawn from training knowledge of Polymarket, Drift Protocol, Solana betting dApps, and parimutuel game design through August 2025. All platform comparisons are from training data, not live verification.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Wallet connect (Phantom/Solflare/Backpack) | Every Solana dApp has this; without it there is no product | LOW | @solana/wallet-adapter-react covers all three; handle "no wallet" state gracefully |
| Live countdown timer | Betting games without visible time pressure feel dead; users won't trust timing | LOW | Sync to on-chain `opened_at` timestamp, not wall clock; drift is a trust issue |
| Color odds / pool distribution display | Without this, bets feel arbitrary — users can't make informed decisions | LOW | 16-color pool bars + multiplier label per color; update at 60s cadence (per spec) |
| Bet placement UI with amount input | Core interaction; must feel responsive with instant on-chain feedback | MEDIUM | Quick-set amounts (0.01/0.05/0.1/0.5/1 SOL); +/- buttons; min/max enforced client-side before tx |
| Transaction confirmation feedback | Crypto UX standard; users need to know their SOL actually moved | LOW | "Splatted!" toast + brief loading state; handle tx failure gracefully with retry option |
| My Bets / bet history | Users will check outcomes; without this, they can't track wins or losses | MEDIUM | Active bets, resolved bets (won/lost), claimable amounts — per spec panel |
| Claim winnings button | Money left unclaimed is a trust failure; "where are my winnings?" is a top support question | LOW | Explicit claim required per parimutuel pattern; show claimable balance prominently |
| 10×10 canvas display | The core artifact of the game; without it the product has no identity | MEDIUM | HTML Canvas or CSS Grid; filled pixels show shade/warmth-modified hex; empty pixels are dark |
| Active pixel highlight | Users need to know what round is currently being bet on | LOW | Pulsing border/glow on the current pixel; consistent visual language |
| Round resolution feedback | Users staying through a round expect to see it resolve visually | MEDIUM | Color flood animation, win/loss notification — per brand identity spec |
| How to Play / rules explainer | Prediction market games with novel mechanics lose users who don't understand the rules | LOW | In-app tab, not just external docs; short, visual, casual tone |
| Mobile-first layout | >70% of crypto game traffic is mobile; non-mobile layouts lose casual players immediately | MEDIUM | 44px touch targets, thumb-reach betting panel, canvas legible at 375px width |
| Bet lockout state | Users must see that betting has closed; placing a bet that silently fails is a trust-breaker | LOW | Disable bet button, show "Bets locked" label, display final odds snapshot |
| Season progress indicator | 100-pixel canvas is the commitment device; users need to see how far through a season they are | LOW | Pixel count (e.g., "Round 38 of 100") or progress bar alongside the canvas |
| Error handling for failed transactions | Solana transactions fail; silent failures cause users to think money was taken but nothing happened | MEDIUM | Catch failed txs, surface clear error with retry option; never auto-retry with SOL at stake |

### Differentiators (Competitive Advantage)

Features that set Splat apart from generic betting dApps. These are what create organic sharing and retention.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Commit-reveal verifiability (SHA-256 prompt hash) | Most AI betting products are "trust us"; public prompt hash + temperature-0 determinism lets anyone verify the AI wasn't rigged — this is genuine trustlessness | HIGH | Oracle posts hash on `open_round`, full prompt on `resolve_round`; docs explain how to verify; this is the anti-rug narrative |
| AI reasoning transparency (published prompt + REASONING field) | Watching the AI explain its own choices creates meta-game — players start reading aesthetic patterns and theorizing | MEDIUM | Prompt published post-round; reasoning shown on resolved pixel tooltip or in round history |
| VRF fallback with visual flag | Competitors either cancel rounds or silently resolve with randomness; Splat marks VRF pixels openly — honesty as a feature | MEDIUM | `vrf_resolved` flag in PixelState; subtle visual distinction on canvas (border or icon); shown in pixel tooltip |
| Shade/warmth visual richness (hundreds of visual variations from 16 bets) | Other prediction markets resolve to boring binary outcomes; Splat produces a genuine artwork — the canvas itself is a reward beyond winnings | HIGH | HSL rendering formula per spec; each pixel is visually unique even for the same color bet; makes the season completion screenshot genuinely beautiful |
| Season completion share image (PNG) | Most crypto games have no natural sharing moment; the completed canvas is a physical artifact players want to brag about | MEDIUM | server-side or client-side canvas-to-PNG; 1200×630 Twitter card size; branded with season number |
| Multi-pixel betting (bet on future rounds) | Adds strategy layer — players who predict AI patterns can position ahead of time; distinguishes thoughtful players from pure gamblers | HIGH | Bets enter "open" state, activate when pixel's round starts; UI must clearly distinguish active vs pending bets |
| Season style memory (AI develops aesthetic across seasons) | The AI is not a random number generator — it's a developing artist; this narrative creates long-term engagement and return visits | MEDIUM | 2-sentence human-written summary appended to next season's system prompt; editorial by operator; marketed as "the AI remembers" |
| Player season stats (bets, volume, correct predictions, hit rate) | Gives players a personal performance identity — "I'm 23/38 this season" creates investment beyond current round | LOW | PlayerSeasonStats PDA per spec; displayed in My Bets panel; hit rate is the vanity metric that drives retention |
| Jackpot pool accumulation (visible, building toward v2) | Visible accruing jackpot creates anticipation even before mechanic activates; "203 SOL in the jackpot" is compelling copy | LOW | 2% rake to jackpot wallet per spec; display current balance prominently; "Coming soon" teaser per brand identity |
| Parimutuel model with visible pool dynamics | Unlike fixed-odds books, odds shift in real-time as bets come in; watching the pool shift creates genuine suspense and strategic timing decisions | LOW | Pool bars update at 60s cadence (not real-time to prevent copycat sniping) — the delay itself is a design choice that favors independent thinking |
| One color per pixel constraint | Forces genuine commitment decisions unlike most betting platforms that allow hedging; creates stronger emotional engagement with outcomes | LOW | Enforced on-chain; UI should communicate this constraint before first bet rather than letting users discover it as an error |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create problems for this specific product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time pool updates (sub-second) | Players want live odds as bets come in | Enables last-second copycat sniping — a whale watches for a dominant color trend, bets at T-1s, collects from the crowd's collective read; kills independent thinking | 60-second update cadence per spec; intentional delay preserves strategic parity |
| Refunds on round failure | "What if the AI goes down while my money is in the pool?" | DDoS-for-refund attack vector: malicious actors flood oracle to force failures, claim refunds on bets they're losing; also requires complex refund logic across all BetAccounts | VRF fallback guarantees resolution; rounds always resolve; no-refunds policy is explained upfront in docs and How to Play |
| Order book / limit orders | Power users want to set odds and wait for fills | Requires liquidity providers, market makers, and complex matching engine; kills casual accessibility; minimum technical effort 10x a parimutuel model | Parimutuel pool is the right model — no liquidity requirements, accessible to any bet size |
| Multiple colors per pixel per player | "Let me diversify my risk across 3 colors" | Eliminates commitment mechanic that makes Splat emotionally engaging; turns prediction into risk-hedging; reduces tension at resolution | One color per pixel is the design decision; communicate it as a feature ("You're all-in on Blue") not a limitation |
| In-app chat / social feed | Adds community feel | High moderation burden; crypto chat = spam, scam links, coordinated price manipulation attempts; development cost is high for low core-value contribution | Social sharing via Twitter/X is the mechanism; season completion PNG drives organic discussion outside the app |
| Notifications (push/email) | Players want to know when their pixel resolves | Building notification infrastructure (push tokens, email provider, preferences management) is a significant platform addition with negligible impact on core game engagement | Round resolves every 30 min on a clock; players learn the cadence; v2 if retention data shows this is a drop-off point |
| Admin dashboard in-app | Operators want to manage seasons from UI | Admin UI expands attack surface, requires auth system, out of scope for v1; a single malicious admin action (e.g., early season completion) could compromise player funds | CLI/script-based season management for v1; on-chain constraints enforce correctness regardless |
| Leaderboard in v1 | "Who's winning?" adds competitive meta-game | Leaderboards before sufficient player count look barren (showing 5 players doesn't create aspiration); whale dominance of leaderboard by volume discourages casual players | Player's own stats (hit rate, volume) are more personal and actionable than rankings; leaderboard is a v2 feature once sufficient player pool exists |
| NFT minting of canvas in v1 | Canvas is art; NFTs seem natural | Adds smart contract complexity (separate NFT program), legal considerations (IP of AI output), and UX overhead for little v1 value; minting ceremony distracts from betting | Season completion share PNG provides social capital without NFT complexity; NFT is a natural v2 monetization layer once canvas value is established |
| Exact-shade side bets | Adds depth for sophisticated players | Betting on shade/warmth ranges requires separate betting pools, separate oracle logic, and substantially more UI complexity; dilutes the clean 16-color mental model | v2 feature after 16-color betting is validated; also requires AI output to be more constrained for verifiability |
| Persistent wallet sessions (auto-reconnect) | QoL feature | Solana wallet adapters handle this; building custom session management creates security surface; users expect wallet to prompt, not auto-connect silently | Use wallet adapter's built-in auto-connect behavior; don't reinvent |

---

## Feature Dependencies

```
Wallet Connect
    └──requires──> Bet Placement
                       └──requires──> Place Bet Instruction (on-chain)
                                          └──requires──> PixelState (Open round)
                                                             └──requires──> Oracle open_round
                                                                                └──requires──> SeasonState (Active)

Commit-Reveal
    └──requires──> Oracle hash at open_round
    └──requires──> Prompt publication at resolve_round
    └──requires──> Docs explaining how to verify

VRF Fallback
    └──requires──> Switchboard VRF integration
    └──requires──> Oracle failure cascade logic
    └──enhances──> Commit-Reveal (fallback is itself verifiable)

My Bets Panel
    └──requires──> BetAccount indexing by player pubkey
    └──requires──> PlayerSeasonStats PDA

Claim Winnings
    └──requires──> Resolved PixelState
    └──requires──> BetAccount (won color)
    └──requires──> My Bets Panel (surface the button)

Season Completion Screen
    └──requires──> All 100 pixels resolved
    └──requires──> SeasonState.status == Completed
    └──requires──> Share-as-PNG generation

Share-as-PNG
    └──requires──> Season Completion Screen
    └──requires──> Canvas render at full resolution

Multi-pixel Betting
    └──requires──> Bet Placement (same instruction, different pixel_index)
    └──requires──> UI to browse future pixels and show pending bet state

Shade/Warmth Visual Rendering
    └──requires──> PixelState.shade and PixelState.warmth values
    └──requires──> HSL rendering formula in frontend
    └──enhances──> Season Completion Screen (makes canvas beautiful)
    └──conflicts──> Exact-shade side bets (v2 only — keeps v1 clean)

Jackpot Display (teaser)
    └──requires──> Jackpot wallet balance read
    └──independent──> Jackpot mechanic activation (v2)

Player Season Stats
    └──requires──> PlayerSeasonStats PDA
    └──enhances──> My Bets Panel
    └──enhances──> Season Completion Screen (personal summary)

AI Reasoning Display
    └──requires──> Prompt publication (already in resolve_round)
    └──requires──> REASONING field parsed from AI response
    └──enhances──> Commit-Reveal (makes verifiability human-readable)

Season Style Memory
    └──requires──> Operator writes 2-sentence summary after Season N completes
    └──requires──> Oracle to include summary in Season N+1 system prompt
    └──independent──> All in-game features (editorial process only)
```

### Dependency Notes

- **Bet Placement requires Wallet Connect:** No wallet, no signing, no bets. Wallet state gates the entire betting UI.
- **Claim Winnings requires My Bets Panel:** Claim buttons are only surfaced through the My Bets view; a standalone claim flow without context is confusing.
- **Multi-pixel Betting requires clear UI differentiation:** Without clear visual distinction between "active round bet" and "pending future round bet," users will be confused about which pixel their money is on. This complexity makes multi-pixel betting a Phase 2 UI concern even though the on-chain instruction supports it from day one.
- **Shade/Warmth conflicts with Exact-shade side bets:** Building shade/warmth visual rendering is straightforward. Building exact-shade side bets requires a completely separate betting pool structure. Doing both in v1 would require maintaining two parallel betting models. Defer entirely.
- **Season Completion Screen depends on Share-as-PNG:** The completion screen without sharing is a dead end. These must ship together. The PNG is the primary organic distribution mechanism.
- **Commit-Reveal verifiability requires Docs:** Publishing a prompt hash on-chain without explaining what it means or how to verify it has zero value. The verifiability feature is only as strong as its documentation.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate that players will bet on AI color choices.

- [ ] Wallet connect (Phantom, Solflare, Backpack) — prerequisite for everything
- [ ] Live 10×10 canvas with active pixel highlight — the product identity
- [ ] 16-color betting panel with pool odds + multipliers — core betting interaction
- [ ] Countdown timer synced to on-chain timestamp — trust and urgency
- [ ] Bet placement with min/max enforcement and confirmation feedback — money moves, trust is built
- [ ] Bet lockout state (2 min before resolution) — fairness guarantee
- [ ] Round resolution animation (color flood + win/loss notification) — the emotional payoff
- [ ] My Bets panel with claim button — users need to retrieve their winnings
- [ ] Player season stats (bets, hit rate, volume) — personal performance identity
- [ ] Season completion screen with share-as-PNG — the organic distribution mechanism
- [ ] Commit-reveal verifiability display (prompt hash + published prompt) — the trust differentiator
- [ ] VRF fallback with visual pixel flag — honesty by design
- [ ] How to Play explainer (in-app) — onboarding for non-crypto-native users
- [ ] Docs site (rules, AI artist, fairness/verification) — depth for users who want it
- [ ] Jackpot balance display (accruing, "coming soon") — future anticipation from day one
- [ ] Mobile-first layout — primary use case

### Add After Validation (v1.x)

Features to add once core betting loop is working and player behavior is observed.

- [ ] Multi-pixel betting UI — on-chain already supports it; build UI once baseline betting patterns are understood; adds strategic depth for return players
- [ ] AI reasoning display on resolved pixels — tooltip or expandable on canvas; adds meta-game without changing betting mechanics; low engineering cost after prompt publication is working
- [ ] Improved session persistence / bet status recovery — if users report losing track of pending bets after reconnecting, add graceful state recovery
- [ ] Round history feed — list of recent resolutions with color + reasoning snippet; gives players context for reading AI patterns

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Leaderboard (per-season + all-time) — wait until player pool is large enough for rankings to feel aspirational rather than empty
- [ ] NFT minting (completed canvases) — natural once canvas value is proven; requires separate NFT program and legal clarity on AI-generated IP
- [ ] Jackpot mechanic activation — fund is accruing; design and activate once significant SOL is accumulated and the mechanic adds to, not distracts from, core game
- [ ] Blinks/Solana Actions — shareable betting links for X/Twitter; high distribution value but requires Solana Actions integration work
- [ ] Season gallery (historical canvases) — valuable for returning players; low priority until multiple seasons completed
- [ ] Exact-shade side bets — adds depth but requires parallel betting infrastructure
- [ ] Social features (chat, reactions) — moderation burden; not core to betting
- [ ] Push/email notifications — build only if retention data shows 30-min cadence causes drop-off
- [ ] Grid scaling beyond 10×10 — v2 seasons could feature 15×15 for longer engagement arcs
- [ ] Referral system — growth mechanic; build after organic sharing via PNG is measured
- [ ] Admin dashboard — replace CLI tools after operator team grows beyond single developer

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Wallet connect | HIGH | LOW | P1 |
| Canvas + active pixel display | HIGH | MEDIUM | P1 |
| Betting panel (16 colors, odds) | HIGH | MEDIUM | P1 |
| Countdown timer | HIGH | LOW | P1 |
| Bet placement + confirmation | HIGH | MEDIUM | P1 |
| Round resolution animation | HIGH | MEDIUM | P1 |
| My Bets + claim | HIGH | MEDIUM | P1 |
| Season completion + share PNG | HIGH | MEDIUM | P1 |
| Commit-reveal display | HIGH | LOW | P1 |
| Mobile-first layout | HIGH | MEDIUM | P1 |
| How to Play (in-app) | MEDIUM | LOW | P1 |
| VRF flag on canvas | MEDIUM | LOW | P1 |
| Player season stats | MEDIUM | LOW | P1 |
| Jackpot balance display (teaser) | MEDIUM | LOW | P1 |
| Shade/warmth visual rendering | HIGH | MEDIUM | P1 |
| Bet lockout state | HIGH | LOW | P1 |
| Multi-pixel betting UI | MEDIUM | HIGH | P2 |
| AI reasoning tooltip | MEDIUM | LOW | P2 |
| Round history feed | MEDIUM | LOW | P2 |
| Leaderboard | MEDIUM | MEDIUM | P3 |
| NFT minting | HIGH | HIGH | P3 |
| Jackpot mechanic | HIGH | HIGH | P3 |
| Blinks/Solana Actions | MEDIUM | MEDIUM | P3 |
| Season gallery | LOW | MEDIUM | P3 |
| Exact-shade side bets | LOW | HIGH | P3 |
| Social features | LOW | HIGH | P3 |
| Admin dashboard | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Polymarket | Drift Bet (Solana) | Generic parimutuel dApps | Splat Approach |
|---------|------------|--------------------|--------------------------|----------------|
| Verifiability | Market resolution via UMA oracle (third-party) | On-chain oracle, centralized operator key | Varies; often opaque | Commit-reveal with temperature-0 determinism; anyone can independently reproduce the AI decision |
| Betting model | Binary / multi-outcome CLOB | Parimutuel / sports book style | Parimutuel | Parimutuel; 16 outcomes; no liquidity requirements |
| UX target | Sophisticated traders; trading terminal feel | Crypto-native sports bettors | Crypto-native | Casual gamers; mobile-first; non-crypto-native language |
| Retention mechanism | News cycle (new markets constantly) | Sports schedule | Game schedule | Narrative season arc; evolving AI artist identity; collection of completed canvases |
| Social / shareable moment | Position screenshot | Win screenshot | None notable | Branded completed canvas PNG; the artwork IS the share asset |
| Wallet support | MetaMask / EVM | Phantom, Solflare | Phantom typically | Phantom, Solflare, Backpack |
| Mobile | Functional but not primary | Functional | Varies | Mobile-first by design; thumb-reach targets |
| Minimum bet | Typically $1 equivalent | Varies | Varies | 0.01 SOL (~$1); accessible to casual players |
| Outcome clarity | Market question text | Sports result | Varies | 16 named colors; unambiguous; visually distinct |
| Session length | Minutes (check, bet, leave) | Minutes | Minutes | 30-minute rounds create natural return cadence; multi-pixel betting rewards strategic sessions |

---

## Sources

- Project context: `/Users/puranjaysingh/Documents/Claude2026/splat/.planning/PROJECT.md`
- Detailed specification: `/Users/puranjaysingh/Documents/Claude2026/splat/SPEC.md`
- Brand identity: `/Users/puranjaysingh/Documents/Claude2026/splat/SPLAT_BRAND_IDENTITY.md`
- Prediction market platform knowledge: Training data through August 2025 (Polymarket, Drift Protocol, Augur, general parimutuel game design patterns) — MEDIUM confidence, not live-verified
- Solana dApp UX patterns: Training data through August 2025 (@solana/wallet-adapter, Helius WebSocket patterns, Anchor parimutuel examples) — MEDIUM confidence
- Web search: Unavailable at research time (Brave API key not set; WebSearch tool returned errors)

**Confidence note:** All feature categorizations are grounded in the detailed spec and brand identity documents (HIGH confidence for project-specific claims). Competitor comparisons and ecosystem claims are from training data (MEDIUM confidence). No live competitor verification was possible — recommend spot-checking Polymarket and any Solana-native betting games that launched in 2025-2026 before finalizing roadmap.

---
*Feature research for: Splat (Pixel Predict) — Solana prediction market game with AI oracle*
*Researched: 2026-03-16*
