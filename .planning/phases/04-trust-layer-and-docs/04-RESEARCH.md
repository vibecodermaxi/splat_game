# Phase 04: Trust Layer and Docs - Research

**Researched:** 2026-03-18
**Domain:** Next.js 16 / React 19 / Solana Anchor — UI completions, on-chain bet history, PNG sharing, commit-reveal display, in-app docs, error resilience
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### My Bets & Claims
- Slide-up bottom drawer over game page — player stays in context, canvas still visible behind
- Triggered via "Bets" button in the header bar (next to wallet connect)
- Compact stats bar at top of drawer: bets placed, wins, hit rate, volume — always visible
- Bet list below stats: active bets, resolved (won/lost), claimable winnings
- Individual "Claim" button per winning bet + sticky "Claim All" button at bottom when multiple are claimable
- Claim All batches into a single transaction

#### Season Completion & Share
- Full-screen takeover celebration when final pixel resolves: canvas zooms to fill screen, confetti burst, season stats overlay
- Share PNG: branded frame with dark border — "Pixel Predict — Season X" at top, 10x10 canvas centered, player stats at bottom (bets, wins, hit rate), site URL
- 12-hour intermission screen: big countdown to next season, completed canvas on display, season stats summary (rounds, total bets, total pool), Share and View Canvas buttons
- Most recent season canvas only — season gallery is v2

#### Commit-Reveal & Verification Display
- Accessible via pixel detail tap (extend existing PixelTooltip) — tap resolved pixel → see color/shade/warmth + "Verified fair" badge + expandable proof section
- Default: casual language ("The AI's pick was locked before bets opened")
- Expand to see: commitment hash, prompt text excerpt, Arweave link
- VRF-resolved pixels: subtle colored dot in corner of pixel cell on canvas; tooltip explains "Resolved via random fallback"
- All copy uses "prompt commitment proof" language — never "reproducible result"

#### Docs Site
- In-app pages as Next.js routes (/how-it-works, /ai-artist, /rules, /fairness, /faq)
- Accessed via [?] button in header bar
- Tone: casual gamer — short sentences, direct language, game metaphors, not a whitepaper
- Fairness & Verification page: layered depth — 3-sentence casual explanation first, expandable "nerdy version" with SHA-256 details, Arweave links, verification steps
- First-time onboarding: dismissable 3-4 step tooltip tour pointing at canvas, betting panel, timer. Shows once per device (localStorage flag), never again

#### Error Handling & Edge Cases
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FS-01 | User can view active bets, resolved bets (won/lost), and claimable winnings in My Bets panel | On-chain BetAccount fetching via getProgramAccounts with memcmp filter on player pubkey; PlayerSeasonStats PDA for stats bar |
| FS-02 | User can claim individual winnings or claim all from My Bets panel | `claim_winnings` Anchor instruction pattern; same `usePlaceBet` transaction pattern; batch via sequential await or Promise.all |
| FS-03 | User sees personal season stats (total bet, total won, correct predictions, hit rate) | PlayerSeasonStats PDA fields: total_bets (u32), total_volume (u64), correct_predictions (u16) |
| FS-04 | User sees season completion screen with full-screen canvas when final pixel resolves | SeasonState.status === "Completed" detection; extend useResolution/useSeasonData; full-screen motion overlay |
| FS-05 | User can generate and share branded PNG of completed canvas | html-to-image library with toPng(); offscreen div with branded layout; navigator.share or clipboard fallback |
| FS-06 | User sees 12-hour intermission countdown with season stats after completion | SeasonState.status === "Intermission"; completed_at timestamp + 12h offset for countdown; same useCountdown pattern |
| FS-07 | VRF-resolved pixels display visual distinction on canvas | PixelState.vrf_resolved boolean; add VRF dot overlay in PixelCell.tsx; already partially shown in PixelTooltip |
| FS-08 | User can tap filled pixel to see result details (color, shade, warmth, round number) | Extend PixelTooltip (already exists and shows shade/warmth/color) — was FS-08 behavior already present but needs confirmation of round number display |
| FS-09 | Commit-reveal information displayed (prompt hash + published prompt accessible per round) | PixelState.prompt_hash ([u8;32]), arweave_txid ([u8;43]), has_arweave_txid bool; expandable section in PixelTooltip |
| FS-10 | How to Play in-app explainer | Next.js App Router pages under /how-it-works etc.; client layout re-uses header |
| FS-11 | Jackpot wallet balance displayed with "Coming soon" teaser | Static UI element in header or betting panel; no on-chain read needed |
| FS-12 | Failed transaction errors surfaced with clear message and retry option | Extend existing error pattern from usePlaceBet; add retry callback to error toast; wrap Anchor error codes in human-readable messages |
| FS-13 | User sees error state and recovery when wallet disconnects mid-session | useWallet().connected + useWallet().disconnect detection; overlay/banner with reconnect trigger |
| DOC-01 | How It Works page | Next.js route /how-it-works; static React page |
| DOC-02 | The AI Artist page | Next.js route /ai-artist; static React page |
| DOC-03 | Betting Rules page | Next.js route /rules; static React page |
| DOC-04 | Fairness & Verification page | Next.js route /fairness; expandable sections pattern |
| DOC-05 | FAQ page | Next.js route /faq; accordion pattern |
</phase_requirements>

---

## Summary

Phase 4 closes all remaining v1 requirements. The work falls into five distinct clusters: (1) My Bets drawer with on-chain history fetch and claim transactions, (2) season completion + intermission flow, (3) commit-reveal proof display inside the existing PixelTooltip, (4) five static in-app docs pages with a first-time onboarding tour, and (5) error resilience improvements.

The existing codebase is well-positioned: `usePlaceBet` establishes the transaction pattern for `claim_winnings`, `WinNotification` establishes confetti + motion patterns for the celebration overlay, `PixelTooltip` is the correct extension point for proof display, and the Zustand store already has the right shape to add bet-history, season-completion, and wallet-error state.

The main new technical surface is on-chain data fetching: the My Bets drawer needs to enumerate all BetAccount PDAs for a player across all season pixels. The correct approach is `program.account.betAccount.all([memcmp filter on player pubkey at offset 8])` — Anchor's `all()` method handles discriminator filtering automatically.

**Primary recommendation:** Build each cluster independently using existing patterns. Do not introduce new state management libraries. Extend Zustand store with bet history and season-completion slices. Use `motion/react` drag for the drawer (already installed). Use `html-to-image` for PNG generation (superior performance over html2canvas for DOM-based canvases). Build docs as plain Next.js App Router pages — no MDX needed.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` (motion/react) | ^12.38.0 | Drawer slide-up, season overlay, exit animations | Already used throughout; spring physics built in |
| `canvas-confetti` | ^1.9.4 | Season completion confetti burst | Already used in WinNotification; already installed |
| `zustand` | ^5.0.12 | Central game state including bet history, season completion | Already the state layer |
| `@coral-xyz/anchor` | ^0.32.1 | On-chain reads: BetAccount[], PlayerSeasonStats, claim tx | Already the Anchor client |
| `@solana/wallet-adapter-react` | ^0.15.39 | `useWallet().connected` for disconnect detection | Already the wallet layer |

### New Dependency
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `html-to-image` | ^1.11.11 | PNG generation for share feature | Better than html2canvas: SVG-based approach, handles modern CSS, faster; no canvas element needed |

**Installation:**
```bash
cd /Users/puranjaysingh/Documents/Claude2026/splat/app && npm install html-to-image
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `html-to-image` | `html2canvas` | html2canvas is more popular but slower on complex DOM and has CSS support gaps; html-to-image is lighter and handles Tailwind/CSS variables correctly |
| Custom drawer | `react-modal-sheet` | react-modal-sheet adds dependency weight; motion/react drag is sufficient for a single-snap drawer since we don't need multi-snap behavior |
| localStorage tour | `react-joyride` | react-joyride is full-featured but heavy for a 4-step one-time tour; custom is 30 lines of state |

---

## Architecture Patterns

### Recommended Project Structure Extensions

```
app/src/
├── app/
│   ├── page.tsx                     # existing game page (extend header)
│   ├── how-it-works/page.tsx        # DOC-01
│   ├── ai-artist/page.tsx           # DOC-02
│   ├── rules/page.tsx               # DOC-03
│   ├── fairness/page.tsx            # DOC-04
│   └── faq/page.tsx                 # DOC-05
├── components/
│   ├── betting/
│   │   └── (existing files)
│   ├── canvas/
│   │   ├── PixelCell.tsx            # add VRF dot (FS-07)
│   │   └── PixelTooltip.tsx         # extend proof section (FS-09)
│   ├── mybets/                      # NEW
│   │   ├── MyBetsDrawer.tsx         # slide-up bottom drawer
│   │   ├── BetHistoryList.tsx       # list rows per pixel
│   │   ├── BetStatsBar.tsx          # top stats: bets/wins/hit rate/volume
│   │   └── ClaimButton.tsx          # per-bet claim + Claim All
│   ├── season/                      # NEW
│   │   ├── SeasonCompleteOverlay.tsx # full-screen takeover (FS-04)
│   │   └── IntermissionScreen.tsx   # 12h countdown (FS-06)
│   ├── share/                       # NEW
│   │   └── ShareCanvas.tsx          # PNG generation trigger (FS-05)
│   ├── onboarding/                  # NEW
│   │   └── OnboardingTour.tsx       # 4-step first-visit tour (FS-10)
│   ├── docs/                        # NEW
│   │   ├── DocsLayout.tsx           # shared header + nav for docs pages
│   │   └── ExpandableSection.tsx    # collapsible "nerdy version" pattern
│   └── ui/
│       └── (existing: Toast, WinNotification, LossNotification)
├── hooks/
│   ├── useBetHistory.ts             # NEW: fetch all BetAccounts for player
│   ├── useClaimWinnings.ts          # NEW: claim_winnings transaction
│   └── useSeasonCompletion.ts       # NEW: watch SeasonState.status
└── store/
    └── gameStore.ts                 # extend with betHistory, seasonComplete slices
```

### Pattern 1: On-Chain Bet History Fetch

**What:** Fetch all BetAccount PDAs for a player using `program.account.betAccount.all()` with a memcmp filter on the player pubkey field (offset 8 — after 8-byte discriminator).

**When to use:** On drawer open, once per mount. Player's bet history doesn't change frequently; no need for WebSocket subscription.

```typescript
// Source: Anchor docs - program.account.TYPE.all(filters)
// BetAccount layout: discriminator[8] + player[32] + season_number[2] + pixel_index[2] + color[1] + amount[8] + claimed[1] + bump[1]
// player pubkey is at byte offset 8

const betAccounts = await (program.account as any)["betAccount"].all([
  {
    memcmp: {
      offset: 8, // skip 8-byte discriminator
      bytes: wallet.publicKey.toBase58(),
    },
  },
]);
// Returns { publicKey, account: { player, seasonNumber, pixelIndex, color, amount, claimed } }[]
```

### Pattern 2: Claim Winnings Transaction

**What:** Reuse `usePlaceBet` transaction skeleton for `claim_winnings`. The instruction accounts are: `pixel_state` (writable), `bet_account` (writable), `player_season_stats` (writable), `player` (signer), `system_program`.

**When to use:** Per-bet claim button and Claim All batch.

```typescript
// Source: app/src/lib/idl.json — claim_winnings instruction
// Same pattern as usePlaceBet: submit → confirmed commitment → update store

await (program.methods as any)
  .claimWinnings()
  .accounts({
    pixelState: pixelPDA,
    betAccount: betPDA,
    playerSeasonStats: statsPDA,
    player: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc({ commitment: "confirmed" });
```

**Claim All:** Loop sequentially — Solana requires sequential transactions for same account writes. Use `for...of`, not `Promise.all`, to avoid "account already in use" errors.

### Pattern 3: Bottom Drawer (motion/react)

**What:** A fixed bottom panel that slides up to 85vh. Drag handle dismisses on swipe-down. Backdrop darkens game canvas behind it.

**When to use:** My Bets panel triggered by header "Bets" button.

```typescript
// Source: motion.dev/docs/react-drag
// Drag constraint: only vertical (y axis), 0 to positive (downward only)
// onDragEnd: if y velocity > 300 or y offset > 200, close

<motion.div
  drag="y"
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={{ top: 0, bottom: 0.3 }}
  onDragEnd={(_, info) => {
    if (info.offset.y > 200 || info.velocity.y > 400) {
      onClose();
    }
  }}
  initial={{ y: "100%" }}
  animate={{ y: 0 }}
  exit={{ y: "100%" }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
  style={{
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "85vh",
    background: "#1E1E2E",
    borderRadius: "16px 16px 0 0",
    zIndex: 500,
    overflowY: "auto",
  }}
>
```

### Pattern 4: PNG Generation (html-to-image)

**What:** Render a hidden offscreen `<div>` with branded layout (canvas snapshot + stats), call `toPng()` from html-to-image, then trigger download or navigator.share.

**When to use:** Season completion screen "Share" button.

```typescript
// Source: html-to-image README (verified via npm)
import { toPng } from "html-to-image";

const shareRef = useRef<HTMLDivElement>(null);

const handleShare = async () => {
  if (!shareRef.current) return;
  const dataUrl = await toPng(shareRef.current, { pixelRatio: 2 });
  // navigator.share (mobile) or download fallback
  if (navigator.share) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "splat-season.png", { type: "image/png" });
    await navigator.share({ files: [file], title: "Splat Season Canvas" });
  } else {
    const link = document.createElement("a");
    link.download = "splat-season.png";
    link.href = dataUrl;
    link.click();
  }
};
```

The offscreen element must be in the DOM (can be `visibility: hidden; position: absolute; left: -9999px`) to allow html-to-image to capture it.

### Pattern 5: Season Completion Detection

**What:** Extend `useSeasonData` to decode `SeasonState.status` as `SeasonStatus` enum. When `status === "Completed"`, trigger full-screen overlay. When `status === "Intermission"`, show intermission screen with countdown derived from `completed_at + 12 * 3600`.

**When to use:** Called on every Helius WebSocket season account update (already wired in `useHeliusSocket`).

```typescript
// SeasonStatus variants from IDL: Active | Completed | Intermission
// completed_at is Option<i64> — available when Completed or Intermission
const statusRaw = decoded.status as { active?: object; completed?: object; intermission?: object };
let seasonStatus: "active" | "completed" | "intermission" = "active";
if (statusRaw.completed !== undefined) seasonStatus = "completed";
else if (statusRaw.intermission !== undefined) seasonStatus = "intermission";

const completedAt = decoded.completedAt as bigint | null;
const intermissionEndsSeconds = completedAt ? Number(completedAt) + 12 * 3600 : null;
```

### Pattern 6: Onboarding Tour (localStorage, custom)

**What:** A 4-step overlay tour with a single spotlight step div that points at canvas, betting panel, timer, then header. Shown once per device via `localStorage.getItem("splat_tour_done")`.

**When to use:** On first game page mount when wallet is connected (or even without wallet, to orient new users).

```typescript
// Check on mount
const hasSeenTour = localStorage.getItem("splat_tour_done") === "true";
if (!hasSeenTour) setShowTour(true);

// On complete
localStorage.setItem("splat_tour_done", "true");
setShowTour(false);
```

Steps array: `[{ target: "#game-canvas", text: "Watch the canvas..." }, ...]`. Each step renders a floating tooltip div positioned via `getBoundingClientRect()` of the target element.

### Pattern 7: Wallet Disconnect Recovery (FS-13)

**What:** Watch `useWallet().connected` transitions. When it goes `true → false` mid-session (not on initial load), show a persistent banner prompting reconnect.

```typescript
// Source: @solana/wallet-adapter-react useWallet hook
const { connected, connect, wallet } = useWallet();
const prevConnectedRef = useRef(connected);

useEffect(() => {
  if (prevConnectedRef.current === true && connected === false) {
    setShowDisconnectBanner(true);
  }
  prevConnectedRef.current = connected;
}, [connected]);
```

### Pattern 8: Commit-Reveal Proof in PixelTooltip

**What:** Extend the existing `PixelTooltip` to show an expandable proof section for resolved pixels. Default view: "Verified fair" badge. Expanded: prompt hash (hex), Arweave link if `has_arweave_txid`, VRF note if `vrf_resolved`.

**What to add to PixelSnapshot type:**
```typescript
// Add to types/game.ts PixelSnapshot:
promptHash: number[];           // [u8; 32] decoded as number[]
arweaveTxid: number[] | null;   // [u8; 43] or null if !has_arweave_txid
hasArweaveTxid: boolean;
```

**Arweave link format:** `https://arweave.net/{base64url(arweaveTxid bytes)}`
Actually, `arweave_txid` is stored as 43 UTF-8 bytes representing the Arweave transaction ID string (Arweave TxIDs are 43-char base64url strings). Convert: `String.fromCharCode(...arweaveTxid)`.

### Anti-Patterns to Avoid

- **Promise.all for claim transactions:** Multiple Anchor instructions modifying the same account (PlayerSeasonStats) in parallel will fail with "account already in use" errors. Use sequential `for...of`.
- **Reading BetAccounts on every render:** Fetch on drawer open, not continuously. Cache in Zustand store slice.
- **html-to-image on server:** html-to-image uses DOM APIs. Must be called in `useEffect` or event handlers, never in server components or during SSR. Add `"use client"` to any component using it.
- **motion drag on non-GPU composited layers:** Bottom drawer must have `will-change: transform` to avoid layout thrash during drag.
- **Docs pages with WalletProvider context:** Docs pages are static — do not wrap in SolanaWalletProvider. The root layout already wraps everything; ensure docs pages don't double-wrap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG export from DOM | Custom canvas recreation of layout | `html-to-image` toPng() | DOM-to-PNG requires handling CSS variables, fonts, gradients — html-to-image does all this via SVG serialization |
| Drawer drag physics | Custom mouse/touch event tracking | `motion/react` drag with `dragConstraints` + `onDragEnd` | Velocity calculation, elasticity, and gesture unification (mouse + touch) are all built in |
| Confetti for season | Custom particle system | `canvas-confetti` (already installed) | Particle physics, random spread, color palettes already implemented |
| Anchor filter queries | Manual memcmp byte building | `program.account.betAccount.all([{memcmp: ...}])` | Anchor handles discriminator + type decoding; manual approach is error-prone with byte offsets |
| Onboarding persistence | IndexedDB or cookie approach | `localStorage.setItem("splat_tour_done", "true")` | Simple boolean flag — localStorage is sufficient and synchronous |

**Key insight:** The expensive problems in this phase are visual fidelity (PNG export, smooth drawer) and on-chain data access (enumerated bet history). Both are already solved by installed/proven libraries.

---

## Common Pitfalls

### Pitfall 1: Sequential vs Parallel Claim Transactions

**What goes wrong:** Claiming multiple bets simultaneously with `Promise.all` causes Solana "Transaction simulation failed: account already in use" because `PlayerSeasonStats` PDA is written by each claim.
**Why it happens:** Solana processes transactions that share writable accounts serially, and simultaneous submission of same-account transactions fails before ordering.
**How to avoid:** Use `for...of` loop with `await` for each claim. Show a progress indicator (e.g., "Claiming 3 of 5...").
**Warning signs:** Claims succeed individually but fail when multiple are triggered together.

### Pitfall 2: html-to-image and CSS Custom Properties

**What goes wrong:** The share PNG renders with incorrect fonts or missing brand colors.
**Why it happens:** html-to-image serializes computed styles via SVG foreignObject. CSS custom properties (`var(--font-family-display)`) may not resolve if the capture element is detached or off-screen in a non-rendered subtree.
**How to avoid:** Use inline styles with resolved values (actual hex strings, actual font names) in the offscreen share template element. Do not rely on CSS variables in the capture target.
**Warning signs:** PNG looks unstyled or uses system fonts despite brand fonts being loaded.

### Pitfall 3: Arweave TxID Decoding

**What goes wrong:** Arweave link is garbage characters or incorrect URL.
**Why it happens:** `arweave_txid` is stored as `[u8; 43]` where the bytes are the ASCII character codes of the 43-character base64url Arweave transaction ID string. Not a raw binary hash.
**How to avoid:** Decode as: `const txidStr = String.fromCharCode(...arweaveTxidBytes)`. The URL is: `https://arweave.net/${txidStr}`.
**Warning signs:** Arweave link returns 404 or shows garbled characters.

### Pitfall 4: motion drag and scroll conflict

**What goes wrong:** The drawer's bet list cannot be scrolled — dragging the list triggers the dismiss gesture instead of scrolling.
**Why it happens:** motion drag captures all pointer events on the draggable element, including those meant for inner scroll containers.
**How to avoid:** Apply `drag="y"` only to the drag handle div at the top (the pill/handle indicator), not the entire drawer div. The scrollable list should be a sibling or child that doesn't inherit the drag.
**Warning signs:** User tries to scroll the bet list and the drawer starts to dismiss.

### Pitfall 5: SeasonState decode — field name casing

**What goes wrong:** `decoded.completedAt` is undefined even though the field exists.
**Why it happens:** Anchor's TypeScript decoder converts snake_case IDL fields to camelCase. `completed_at` becomes `completedAt`. This is consistent with Phase 3 patterns (`useSeasonData.ts` already uses `decoded.currentPixelIndex`).
**How to avoid:** Always use camelCase when accessing Anchor-decoded fields. Reference existing `useSeasonData.ts` decoding patterns.
**Warning signs:** All fields decode to undefined; adding console.log shows actual keys differ from expected.

### Pitfall 6: Next.js App Router — docs pages and layout hierarchy

**What goes wrong:** Docs pages don't have the wallet provider, causing wallet-related imports to crash.
**Why it happens:** The root `layout.tsx` already wraps all children in `SolanaWalletProvider`. Docs pages that don't need wallet will still work — the context is available but unused.
**How to avoid:** Docs pages should simply `"use client"` only if they have interactive state (expandable sections, FAQ accordion). They can use the shared root layout as-is. Do not create a separate layout for docs unless a distinct visual shell (different header/footer) is needed.
**Warning signs:** Hydration errors on docs pages, or "missing provider" errors.

### Pitfall 7: navigator.share not available on desktop

**What goes wrong:** Share button does nothing or throws on desktop browsers.
**Why it happens:** `navigator.share` with `files` is only available on mobile Safari and Android Chrome. Desktop Chrome supports text/url sharing but not file sharing.
**How to avoid:** Always provide a download fallback. Check `navigator.canShare?.({ files: [file] })` before calling `navigator.share`. Fall back to `<a download>` programmatic click.
**Warning signs:** Share button silently fails on desktop.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Fetch All BetAccounts for Player (FS-01)
```typescript
// Source: Anchor docs + existing (program.account as any) cast pattern from useSeasonData.ts
// BetAccount discriminator is 8 bytes; player pubkey starts at byte 8
const betAccounts = await (program.account as any)["betAccount"].all([
  {
    memcmp: {
      offset: 8,
      bytes: wallet.publicKey.toBase58(),
    },
  },
]);
// Each item: { publicKey: PublicKey, account: { player, seasonNumber, pixelIndex, color, amount, claimed, bump } }
```

### Decode PlayerSeasonStats (FS-03)
```typescript
// Source: IDL type PlayerSeasonStats — fields: total_bets(u32), total_volume(u64), correct_predictions(u16)
const [statsPDA] = deriveStatsPDA(PROGRAM_ID, seasonNumber, wallet.publicKey);
const statsInfo = await connection.getAccountInfo(statsPDA);
if (statsInfo) {
  const decoded = program.coder.accounts.decode("PlayerSeasonStats", statsInfo.data) as {
    totalBets: number;
    totalVolume: bigint;
    correctPredictions: number;
  };
  const hitRate = decoded.totalBets > 0
    ? ((decoded.correctPredictions / decoded.totalBets) * 100).toFixed(1)
    : "0.0";
}
```

### motion/react Bottom Drawer with Handle-Only Drag
```typescript
// Source: motion.dev/docs/react-drag (verified pattern)
// Drag handle at top, scroll container for list content

<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400 }}
      />
      {/* Drawer */}
      <motion.div
        key="drawer"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: "85vh", background: "#1E1E2E",
          borderRadius: "16px 16px 0 0", zIndex: 500,
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Drag handle — ONLY this div has drag applied */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 150 || info.velocity.y > 400) onClose();
          }}
          style={{ padding: "12px", cursor: "grab", flexShrink: 0 }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#444", margin: "0 auto" }} />
        </motion.div>
        {/* Scrollable list — NO drag applied here */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
          {/* bet list content */}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### Prompt Hash Display (FS-09)
```typescript
// Source: PixelState IDL — prompt_hash is [u8; 32], arweave_txid is [u8; 43]
// Convert prompt_hash to hex string
const promptHashHex = Array.from(promptHashBytes)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

// Arweave TxID: bytes are ASCII char codes of the 43-char base64url string
const arweaveId = String.fromCharCode(...arweaveTxidBytes);
const arweaveUrl = `https://arweave.net/${arweaveId}`;
```

### Zustand Store Extension Pattern
```typescript
// Source: existing gameStore.ts pattern
// Add to GameState interface in types/game.ts:
interface GameState {
  // ... existing fields ...
  betHistory: BetHistoryEntry[];
  betHistoryLoading: boolean;
  seasonStatus: "active" | "completed" | "intermission";
  intermissionEndsSeconds: number | null;
  walletDisconnectedMidSession: boolean;
  // actions:
  setBetHistory: (history: BetHistoryEntry[]) => void;
  setSeasonStatus: (status: "active" | "completed" | "intermission", intermissionEnds: number | null) => void;
  setWalletDisconnected: (flag: boolean) => void;
}

interface BetHistoryEntry {
  pixelIndex: number;
  colorIndex: number;
  amount: number;       // lamports
  claimed: boolean;
  winningColor: number | null;
  betPDA: string;
  pixelPDA: string;
}
```

### Season Completion Overlay Pattern
```typescript
// Source: WinNotification.tsx pattern + canvas-confetti (already installed)
// Full-screen takeover via fixed positioning + high z-index

useEffect(() => {
  if (seasonStatus === "completed" && !reducedMotion) {
    // Sustained confetti for season completion (longer than win notification)
    const duration = 4000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}, [seasonStatus, reducedMotion]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html2canvas for DOM-to-image | html-to-image (SVG-based) | ~2021 onward | Better CSS support, handles custom properties, 3-10x faster |
| Manual memcmp byte construction | `program.account.TYPE.all([memcmp])` | Anchor 0.20+ | Anchor handles discriminator automatically |
| React-specific tour libraries (react-joyride) | Custom localStorage-flagged tour | N/A | 4-step game tour is too simple to justify library weight |
| `framer-motion` package | `motion` package (motion/react) | Motion v11 (2024) | Same library, renamed and restructured; already using `motion/react` in this project |

**Deprecated/outdated:**
- `framer-motion` import: This project already uses the renamed `motion` package (`import { motion } from "motion/react"`). Never import from `framer-motion`.
- `html2canvas`: Replaced by `html-to-image` for this project.

---

## Open Questions

1. **Claim All batch approach**
   - What we know: Sequential `for...of` works but is slow for large numbers of claimable bets. Solana supports batching multiple instructions in a single transaction.
   - What's unclear: Can `claim_winnings` for different pixel PDAs be batched into a single transaction? They write different `pixel_state` and `bet_account` PDAs but all write the same `player_season_stats` PDA.
   - Recommendation: Implement as sequential transactions for v1. The `player_season_stats` PDA conflict makes same-transaction batching risky. A progress indicator ("Claiming 2 of 5...") provides adequate UX.

2. **PixelTooltip height expansion**
   - What we know: `TOOLTIP_HEIGHT` is hardcoded to 120 in `PixelTooltip.tsx`. Adding a proof section will require more height.
   - What's unclear: Whether to use a two-state height (collapsed 120px / expanded 240px) or dynamic height.
   - Recommendation: Remove the hardcoded height constant and let content size the tooltip. Apply `maxHeight: 300` with overflow scroll on expanded state. Update `clampToViewport` to use `tooltipRef.current.getBoundingClientRect().height` after expansion.

3. **Docs page header — standalone or shared**
   - What we know: Docs should feel like in-game help, accessed via `[?]` in the game header. The game page has its own header in `page.tsx`.
   - What's unclear: Whether docs pages use the root `layout.tsx` as-is, or need a custom layout with a "back to game" header.
   - Recommendation: Create a `DocsLayout.tsx` client component used by each docs page. It renders a slim header with a back arrow linking to `/` and the `[?]` context. This is consistent with the "in-game help" feel without duplicating the wallet provider.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x |
| Config file | `/Users/puranjaysingh/Documents/Claude2026/splat/app/vitest.config.ts` |
| Quick run command | `cd /Users/puranjaysingh/Documents/Claude2026/splat/app && npm test -- --reporter=verbose` |
| Full suite command | `cd /Users/puranjaysingh/Documents/Claude2026/splat/app && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FS-01 | MyBetsDrawer renders stats bar and bet list | unit | `npm test -- --reporter=verbose MyBetsDrawer` | Wave 0 |
| FS-02 | Claim button calls claim_winnings instruction; Claim All calls sequentially | unit (mock) | `npm test -- --reporter=verbose ClaimButton` | Wave 0 |
| FS-03 | BetStatsBar displays correct hit rate calculation | unit | `npm test -- --reporter=verbose BetStatsBar` | Wave 0 |
| FS-04 | SeasonCompleteOverlay renders when seasonStatus === "completed" | unit | `npm test -- --reporter=verbose SeasonCompleteOverlay` | Wave 0 |
| FS-05 | ShareCanvas calls toPng and triggers download/share | unit (mock html-to-image) | `npm test -- --reporter=verbose ShareCanvas` | Wave 0 |
| FS-06 | IntermissionScreen shows countdown from completed_at + 12h | unit | `npm test -- --reporter=verbose IntermissionScreen` | Wave 0 |
| FS-07 | PixelCell renders VRF dot when vrfResolved is true | unit | `npm test -- --reporter=verbose GameCanvas` | ❌ extend existing |
| FS-08 | PixelTooltip shows round number | unit | `npm test -- --reporter=verbose PixelTooltip` | Wave 0 |
| FS-09 | PixelTooltip shows proof section with hash + Arweave link | unit | `npm test -- --reporter=verbose PixelTooltip` | Wave 0 |
| FS-10 | Onboarding tour renders on first visit, sets localStorage on complete | unit | `npm test -- --reporter=verbose OnboardingTour` | Wave 0 |
| FS-11 | Jackpot teaser renders "Coming soon" in header | unit | `npm test -- --reporter=verbose` (page.tsx / header) | Wave 0 |
| FS-12 | Error toast shows with retry button after failed tx | unit | `npm test -- --reporter=verbose useClaimWinnings` | Wave 0 |
| FS-13 | Disconnect banner renders when connected transitions true→false | unit | `npm test -- --reporter=verbose WalletDisconnectBanner` | Wave 0 |
| DOC-01–05 | Docs pages render expected content headings | unit | `npm test -- --reporter=verbose DocsPages` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/puranjaysingh/Documents/Claude2026/splat/app && npm test -- --reporter=verbose`
- **Per wave merge:** `cd /Users/puranjaysingh/Documents/Claude2026/splat/app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/MyBetsDrawer.test.tsx` — covers FS-01, FS-02, FS-03
- [ ] `src/__tests__/SeasonCompleteOverlay.test.tsx` — covers FS-04
- [ ] `src/__tests__/ShareCanvas.test.tsx` — covers FS-05
- [ ] `src/__tests__/IntermissionScreen.test.tsx` — covers FS-06
- [ ] `src/__tests__/PixelTooltip.test.tsx` — covers FS-08, FS-09 (new file for extended component)
- [ ] `src/__tests__/OnboardingTour.test.tsx` — covers FS-10
- [ ] `src/__tests__/useClaimWinnings.test.ts` — covers FS-12
- [ ] `src/__tests__/WalletDisconnectBanner.test.tsx` — covers FS-13
- [ ] `src/__tests__/DocsPages.test.tsx` — covers DOC-01 through DOC-05

---

## Sources

### Primary (HIGH confidence)
- `/Users/puranjaysingh/Documents/Claude2026/splat/app/src/lib/idl.json` — IDL types for BetAccount, PlayerSeasonStats, SeasonState, PixelState; all field names and layouts
- `/Users/puranjaysingh/Documents/Claude2026/splat/app/src/hooks/usePlaceBet.ts` — transaction pattern reused for claim_winnings
- `/Users/puranjaysingh/Documents/Claude2026/splat/app/src/hooks/useSeasonData.ts` — Anchor account decode pattern, memcmp via fetchMultiple, camelCase field names
- `/Users/puranjaysingh/Documents/Claude2026/splat/app/src/components/ui/WinNotification.tsx` — confetti + motion spring pattern
- `/Users/puranjaysingh/Documents/Claude2026/splat/app/src/components/ui/Toast.tsx` — toast error/success pattern
- `/Users/puranjaysingh/Documents/Claude2026/splat/app/src/store/gameStore.ts` — Zustand extension pattern
- motion.dev docs — drag, AnimatePresence, spring transitions
- html-to-image npm README — toPng() API

### Secondary (MEDIUM confidence)
- [Solana Cookbook — getProgramAccounts](https://solanacookbook.com/guides/get-program-accounts.html) — memcmp offset pattern verified
- [motion.dev drag docs](https://motion.dev/docs/react-drag) — dragConstraints, onDragEnd velocity pattern
- [npm html-to-image](https://www.npmjs.com/package/html-to-image) — toPng() API, SSR note

### Tertiary (LOW confidence)
- WebSearch results for bottom sheet patterns — multiple sources agreed on drag handle isolation to prevent scroll conflict; not directly verified in official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed except html-to-image; IDL is ground truth for on-chain shapes
- Architecture: HIGH — all patterns are extensions of existing Phase 3 code with verified Anchor patterns
- Pitfalls: HIGH — sequential claim pitfall is verified Solana behavior; html-to-image CSS variable pitfall is documented; Arweave decoding is verified from IDL ([u8;43] ASCII bytes)
- Validation: HIGH — vitest + RTL already configured and working

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable stack — Next.js, Anchor, motion all in stable releases)
