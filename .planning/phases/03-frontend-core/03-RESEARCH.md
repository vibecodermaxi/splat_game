# Phase 3: Frontend Core - Research

**Researched:** 2026-03-18
**Domain:** Next.js 15 / Solana wallet integration / Anchor frontend / mobile game UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Canvas Rendering**
- CSS Grid (not HTML Canvas) — each pixel is a div with inline background-color computed from shade/warmth HSL formula
- Active pixel: animated marching/rotating dashed border (bouncing outline style) — playful, game-like
- Tapping a filled pixel shows a tooltip popup (small floating card with color name, shade, warmth, round number) — dismisses on tap-away
- Tapping the active pixel scrolls to the betting panel

**Betting Panel UX**
- 16 colors displayed as a 4×4 grid of swatches
- Each swatch shows the payout multiplier (e.g., "4.5x") overlaid on the color — pool % shown when selected
- Bet amount input: text input field with +/- buttons AND quick-set preset buttons (0.01, 0.05, 0.1, 0.5, 1 SOL)
- "Place Bet" button: large, rounded, takes the selected color as its background — pulses gently when ready, satisfying tap feel
- After betting: shows "Your bet: [color] [amount]" with option to add more
- Lockout state (final 2 min): dramatic shift — panel color shifts (red tint), timer pulses urgently, bet button grays with countdown to resolution

**Resolution Animation**
- Color flood: radial burst — color explodes outward from center of pixel with brief glow halo
- Win: payout amount floats up from pixel with confetti particles
- Loss: panel briefly dims, quick transition to next round — no lingering on failure
- Final 10-second countdown: full drama — large pulsing numbers, screen edges glow, subtle screen shake on last 3 seconds, casino energy

**Typography & Brand**
- Display font: Fredoka One (headings, timer, bet amounts)
- Background: near-black (#0a0a0f or similar; SPLAT_BRAND_IDENTITY.md specifies Void #14141F) for maximum canvas contrast
- UI chrome: neutral/dark, accent colors pulled from the 16 game colors for interactive elements
- Buttons: big, rounded, colorful (selected color as background)
- Overall vibe: polished hyper-casual mobile game, not crypto trading terminal

**Already Decided (from prior phases / spec)**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FE-01 | User can connect Solana wallet (Phantom, Solflare, Backpack) | Wallet Standard via @solana/wallet-adapter-react; all three wallets auto-discovered |
| FE-02 | User sees 10×10 canvas with filled pixels showing shade/warmth-modified colors | CSS Grid, inline HSL formula from SPEC, div-per-pixel pattern |
| FE-03 | Active pixel has pulsing highlight/border animation | CSS keyframe marching-ants dashed border; no library needed |
| FE-04 | User sees 16-color betting panel with pool percentages and payout multipliers | React state slice for colorPools from PixelStateData; 4×4 grid of swatches |
| FE-05 | User can select a color and enter bet amount with quick-set buttons (0.01/0.05/0.1/0.5/1 SOL) | Controlled input + local React state; LAMPORTS_PER_SOL conversion via BN |
| FE-06 | User sees transaction confirmation feedback after placing bet | Optimistic toast/notification; Anchor sendAndConfirm callback; Motion slide-in |
| FE-07 | User sees countdown timer synced to on-chain opened_at timestamp | opened_at from PixelStateData (i64 unix seconds); useEffect interval; Math.floor |
| FE-08 | Timer shows visual shift in final 2 minutes (lockout period) | Conditional CSS class swap + Motion animate; Splat Yellow flash at lockout trigger |
| FE-09 | Bet button disabled with "Bets locked" label during lockout | Derived from countdown + PixelState.status == "locked"; disabled + aria-disabled |
| FE-10 | User sees resolution animation when round resolves (color flood + win/loss notification) | Motion radial clip-path expand + glow box-shadow; canvas-confetti for win burst |
| FE-11 | Pool distribution updates from on-chain data every 60 seconds | setInterval(fetchColorPools, 60_000); intentional — do NOT reduce cadence |
| FE-12 | Frontend uses Helius WebSocket subscriptions for live state updates | Connection.onAccountChange on PixelState + SeasonState PDAs via @solana/web3.js 1.x |
| FE-13 | Frontend falls back to polling every 15 seconds if WebSocket disconnects | ws.onclose → clear intervals → start 15s poll loop; ws reconnect with backoff |
| FE-14 | All interactions work with thumb-reach tap targets on mobile (375px+ width) | 44px min tap target; CSS Grid with aspect-ratio:1; Tailwind responsive classes |
| FE-15 | Dark background with video-game-casual aesthetic (rounded corners, chunky buttons, playful typography) | Void #14141F + Surface #1E1E2E; Fredoka One + Nunito; 10-16px border-radius everywhere |
| FE-16 | User sees season progress indicator (round N of 100) | SeasonState.currentPixelIndex / (gridWidth × gridHeight); displayed in header |
</phase_requirements>

---

## Summary

This phase builds a Next.js 15 (App Router) mobile-first frontend for a Solana prediction market game. The stack is tightly constrained by existing project decisions: Anchor 0.32 on-chain, @solana/web3.js 1.x (required for Anchor compatibility), and @solana/wallet-adapter-react for Phantom/Solflare/Backpack support via the Wallet Standard. The new @solana/kit / @solana/react-hooks ecosystem is incompatible with @coral-xyz/anchor 0.32, so the legacy wallet-adapter stack is the correct choice despite the newer API existing.

The game UI is built around a CSS Grid 10×10 canvas (100 divs), Tailwind CSS v4 for styling, and Motion (formerly Framer Motion) v12 for animations. State is divided between server reads (Anchor account fetches) and client subscription (Helius WebSocket → Connection.onAccountChange). Zustand manages global game state (canvas pixels, active round, pools); local React state handles betting UI interactions. The brand identity is fully documented in SPLAT_BRAND_IDENTITY.md with exact hex values, font roles, and animation rules.

The single highest-risk area is the Anchor + Next.js integration: Anchor's Program must be instantiated client-side only (no SSR), and the wallet provider tree must be wrapped in a `"use client"` boundary. Any Server Component that attempts to import Anchor or wallet hooks will fail.

**Primary recommendation:** Scaffold with `npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir`; add @solana/wallet-adapter-react (not @solana/kit) for wallet; use @coral-xyz/anchor 0.32 for on-chain reads/writes; use Motion v12 (import from `motion/react`) for all animations.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.x | React framework, App Router, SSR/SSG | Standard for production React apps; official Solana guides target it |
| react / react-dom | 19.x | UI rendering | Bundled with Next.js 16; no separate install needed |
| typescript | 5.7.x | Type safety | Already used in oracle; IDL generates TS types |
| tailwindcss | 4.2.x | Utility-first CSS | Standard for new React projects; v4 auto-scans, no config file required |
| @coral-xyz/anchor | 0.32.1 | On-chain program client, IDL types, account fetch | Required — must match oracle's anchor version; incompatible with kit/web3.js v2 |
| @solana/web3.js | 1.98.x | Connection, PublicKey, LAMPORTS_PER_SOL, WebSocket subscriptions | Required by @coral-xyz/anchor 0.32; kit (v2) is NOT compatible with Anchor 0.32 |
| @solana/wallet-adapter-react | 0.15.x | useWallet, useAnchorWallet, useConnection hooks | Required for wallet standard integration |
| @solana/wallet-adapter-wallets | 0.19.x | PhantomWalletAdapter, SolflareWalletAdapter, BackpackWalletAdapter | Provides wallet standard auto-discovery |
| @solana/wallet-adapter-react-ui | 0.9.x | WalletModalProvider, WalletMultiButton | Standard modal UI for wallet selection |
| @solana/wallet-adapter-base | 0.9.x | Base types | Peer dependency |
| motion | 12.38.x | Animations (radial burst, countdown shake, slide-in notifications) | Rebranded from framer-motion; import from `motion/react`; zero breaking changes in v12 |
| zustand | 5.0.x | Global game state (canvas pixels, round state, pools) | Minimal boilerplate, hook-based, performance-friendly for game loop |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| canvas-confetti | 1.9.x | Win particle burst from pixel | Use for the win resolution confetti; lighter than tsParticles for a single effect |
| @next/font (built-in) | bundled | Fredoka One, Nunito, JetBrains Mono from Google Fonts | Use next/font/google to self-host; zero FOUT; CSS variables for Tailwind |
| bn.js | bundled via @coral-xyz/anchor | Large integer handling for lamports | Anchor brings it; use `new BN(amount)` for place_bet instruction args |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @solana/wallet-adapter-react | @solana/react-hooks + @solana/kit | kit is NOT compatible with @coral-xyz/anchor 0.32; avoid until Anchor supports web3.js v2 |
| motion (framer-motion v12) | react-spring, CSS animations | Motion has better spring physics and simpler API for complex sequences; CSS-only for marching ants only |
| zustand | TanStack Query + Context | TanStack Query excels at server state; game loop needs optimistic local state; Zustand handles both |
| canvas-confetti | @tsparticles/confetti | tsParticles is heavier (full particle engine); canvas-confetti is < 5KB for one-shot bursts |
| Tailwind v4 | Tailwind v3 | v4 is current standard; no config file required; 100x faster incremental builds |

### Installation

```bash
# In /app directory (create-next-app output)
npm install @coral-xyz/anchor @solana/web3.js \
  @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
  @solana/wallet-adapter-wallets @solana/wallet-adapter-base \
  motion zustand canvas-confetti

npm install --save-dev @types/bn.js
```

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout: fonts, providers, global CSS
│   │   ├── page.tsx            # Game page (server component shell)
│   │   └── globals.css         # Tailwind @import + CSS custom properties
│   ├── components/
│   │   ├── providers/
│   │   │   └── WalletProvider.tsx   # "use client" — ConnectionProvider, WalletProvider, WalletModalProvider
│   │   ├── canvas/
│   │   │   ├── GameCanvas.tsx       # 10×10 CSS Grid
│   │   │   ├── PixelCell.tsx        # Single pixel div
│   │   │   └── PixelTooltip.tsx     # Floating card on tap
│   │   ├── betting/
│   │   │   ├── BettingPanel.tsx     # Color grid + bet input
│   │   │   ├── ColorSwatch.tsx      # Single 1/16 swatch with multiplier
│   │   │   └── BetInput.tsx         # Text input + +/- + quick-set buttons
│   │   ├── round/
│   │   │   ├── CountdownTimer.tsx   # Countdown synced to opened_at
│   │   │   └── RoundInfo.tsx        # Pool total, round N of 100
│   │   └── ui/
│   │       ├── WinNotification.tsx  # Slide-in win toast
│   │       └── LossNotification.tsx # Fade loss message
│   ├── hooks/
│   │   ├── useGameState.ts      # Zustand store selector
│   │   ├── useHeliusSocket.ts   # WebSocket subscription + polling fallback
│   │   ├── useAnchorProgram.ts  # Memoized AnchorProvider + Program instance
│   │   ├── useCountdown.ts      # Derived from opened_at, returns { secondsLeft, isLocked }
│   │   └── useColorPools.ts     # 60s interval fetch of colorPools from PixelState
│   ├── store/
│   │   └── gameStore.ts         # Zustand store: canvas pixels, activePixelIndex, pools, roundStatus
│   ├── lib/
│   │   ├── anchor.ts            # Program instantiation helpers, IDL import
│   │   ├── pda.ts               # deriveConfigPDA, deriveSeasonPDA, derivePixelPDA (port from oracle)
│   │   ├── color.ts             # COLOR_NAMES, BASE_HEX, computePixelColor(shade, warmth)
│   │   └── constants.ts         # PROGRAM_ID, LAMPORTS_PER_SOL_BN, GRID_SIZE, etc.
│   └── types/
│       └── game.ts              # Frontend PixelData, RoundState, etc.
├── public/
│   └── fonts/                   # (empty — next/font self-hosts)
├── next.config.ts
├── tailwind.css                 # @import "tailwindcss" (v4 style)
└── tsconfig.json
```

### Pattern 1: Wallet Provider Tree (Client Boundary)

**What:** All Solana wallet and Anchor context must live in a client component subtree.
**When to use:** Always. Never import wallet hooks or Anchor Program into Server Components.

```typescript
// Source: https://solana.com/developers/guides/wallets/add-solana-wallet-adapter-to-nextjs
// app/src/components/providers/WalletProvider.tsx
"use client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { useMemo } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

// Backpack is auto-discovered via Wallet Standard — no explicit adapter needed
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
  const memoWallets = useMemo(() => wallets, []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={memoWallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### Pattern 2: Anchor Program Hook (Client-Side Only)

**What:** Memoized Anchor Program instance derived from wallet + connection context.
**When to use:** In any client component that needs to read accounts or send transactions.

```typescript
// Source: https://www.anchor-lang.com/docs/clients/typescript
// app/src/hooks/useAnchorProgram.ts
"use client";
import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "@/../target/idl/pixel_predict.json";

const PROGRAM_ID = new PublicKey("FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG");

export function useAnchorProgram() {
  const wallet = useAnchorWallet(); // useAnchorWallet, NOT useWallet — Anchor requires signable wallet
  const { connection } = useConnection();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    return new Program(idl as any, provider);
  }, [wallet, connection]);
}
```

### Pattern 3: Shade/Warmth Color Computation

**What:** Convert base hex + shade + warmth to final rendered hex per SPEC formula.
**When to use:** For every filled pixel on canvas render.

```typescript
// Source: SPEC.md "Rendering formula" section
// app/src/lib/color.ts
export const COLOR_NAMES = ["Red","Orange","Yellow","Lime","Green","Teal","Cyan","Blue",
  "Indigo","Purple","Pink","Magenta","Brown","Gray","Black","White"];

export const BASE_HEX: Record<string, string> = {
  Red:"#E53E3E", Orange:"#ED8936", Yellow:"#ECC94B", Lime:"#68D391",
  Green:"#38A169", Teal:"#38B2AC", Cyan:"#4FD1C5", Blue:"#4299E1",
  Indigo:"#5C6BC0", Purple:"#9F7AEA", Pink:"#ED64A6", Magenta:"#D53F8C",
  Brown:"#8B6C5C", Gray:"#A0AEC0", Black:"#2D3748", White:"#F7FAFC",
};

function hexToHsl(hex: string): [number, number, number] { /* ... */ }
function hslToHex(h: number, s: number, l: number): string { /* ... */ }

export function computePixelColor(colorIndex: number, shade: number, warmth: number): string {
  const name = COLOR_NAMES[colorIndex];
  const [h, s, l] = hexToHsl(BASE_HEX[name]);
  const lFinal = Math.min(100, Math.max(0, l + (50 - shade) * 0.4));
  const hFinal = ((h + (warmth - 50) * 0.15) + 360) % 360;
  return hslToHex(hFinal, s, lFinal);
}
```

### Pattern 4: CSS Grid Canvas (10×10)

**What:** 10×10 CSS Grid with aspect-ratio:1 cells, max-width bound to viewport.
**When to use:** Canvas component; all styling decisions flow from this.

```css
/* Pixel gap = 3px per SPLAT_BRAND_IDENTITY.md */
.game-canvas {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  width: 100%;
  max-width: min(calc(100vw - 32px), 480px);
  aspect-ratio: 1;
}
.pixel-cell {
  border-radius: 4px;  /* per brand identity */
  aspect-ratio: 1;
}
```

### Pattern 5: Marching-Ants Active Pixel Border

**What:** Animated dashed border that "marches" around the active pixel.
**When to use:** Exactly one pixel at a time — the active betting target.

```css
/* CSS-only, no JS needed */
@keyframes marchingAnts {
  to { stroke-dashoffset: -20; }
}
/* Alternative: background-position trick for pure CSS */
@keyframes borderMarch {
  to { background-position: 100% 0, 0 100%, 0 0, 100% 100%; }
}
.pixel-active {
  background-image:
    repeating-linear-gradient(90deg,  #FF3B6F 0, #FF3B6F 4px, transparent 4px, transparent 8px),
    repeating-linear-gradient(180deg, #FF3B6F 0, #FF3B6F 4px, transparent 4px, transparent 8px),
    repeating-linear-gradient(90deg,  #FF3B6F 0, #FF3B6F 4px, transparent 4px, transparent 8px),
    repeating-linear-gradient(180deg, #FF3B6F 0, #FF3B6F 4px, transparent 4px, transparent 8px);
  background-size: 8px 2px, 2px 8px, 8px 2px, 2px 8px;
  background-position: 0 0, 100% 0, 0 100%, 0 0;
  background-repeat: repeat-x, repeat-y, repeat-x, repeat-y;
  animation: borderMarch 0.5s linear infinite;
}
```

### Pattern 6: Helius WebSocket with Polling Fallback

**What:** Subscribe to PixelState + SeasonState account changes; reconnect with backoff; fallback to 15s polling.
**When to use:** useHeliusSocket hook, mounted once at the game page level.

```typescript
// Source: https://docs.helius.dev/webhooks-and-websockets/enhanced-websockets
// app/src/hooks/useHeliusSocket.ts
export function useHeliusSocket(pixelPDA: PublicKey | null, seasonPDA: PublicKey) {
  const { connection } = useConnection();
  const setPixelState = useGameStore(s => s.setPixelState);

  useEffect(() => {
    if (!pixelPDA) return;
    let subId: number | null = null;
    // Helius ping every 60s to prevent 10-min inactivity timeout
    const ping = setInterval(() => connection.getSlot(), 60_000);

    subId = connection.onAccountChange(pixelPDA, (info) => {
      // decode and update store
    }, "confirmed");

    return () => {
      if (subId !== null) connection.removeAccountChangeListener(subId);
      clearInterval(ping);
    };
  }, [pixelPDA?.toBase58()]);
}
```

### Pattern 7: 60-Second Pool Cadence (Intentional)

**What:** Pool percentages and multipliers only refresh every 60 seconds.
**When to use:** In useColorPools hook. Do NOT change this to real-time.

```typescript
// THIS IS INTENTIONAL ANTI-SNIPING DESIGN — do not optimize
useEffect(() => {
  const fetchPools = async () => { /* fetch PixelState.colorPools */ };
  fetchPools();
  const interval = setInterval(fetchPools, 60_000);
  return () => clearInterval(interval);
}, [pixelPDA]);
```

### Pattern 8: Motion v12 Resolution Animation

**What:** Radial clip-path expand from pixel center for color flood; slide-in win notification.
**When to use:** Triggered when PixelState.status transitions to "resolved".

```typescript
// Source: https://motion.dev/docs/react-animation
import { motion, animate } from "motion/react";

// Radial burst: clip-path circle expand
<motion.div
  initial={{ clipPath: "circle(0% at 50% 50%)" }}
  animate={{ clipPath: "circle(150% at 50% 50%)" }}
  transition={{ duration: 0.2, ease: "easeOut" }}
  style={{ backgroundColor: winningColor }}
/>

// Win notification slide-in from bottom
<motion.div
  initial={{ y: "100%", opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: "100%", opacity: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>
```

### Pattern 9: Font Setup via next/font/google

**What:** Self-hosted Google Fonts with CSS variables, no FOUT, Tailwind integration.
**When to use:** layout.tsx root; expose as CSS variables.

```typescript
// Source: https://nextjs.org/docs/app/getting-started/fonts
import { Fredoka_One, Nunito, JetBrains_Mono } from "next/font/google";

const fredokaOne = Fredoka_One({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Note: Fredoka_One weight is "400" only — it's a single-weight decorative font
```

### Anti-Patterns to Avoid

- **Importing Anchor or wallet hooks in Server Components:** Next.js App Router renders Server Components on the server. Anchor requires `window` and browser APIs. Mark any component using Anchor or wallet hooks with `"use client"`.
- **Using useWallet instead of useAnchorWallet for transactions:** `useWallet` returns an adapter that may not implement signing. `useAnchorWallet` returns a compatible wallet or `undefined` — always check for null.
- **Using @solana/kit (web3.js v2) alongside @coral-xyz/anchor:** Anchor 0.32 only works with @solana/web3.js 1.x. The two major versions are API-incompatible. Do not mix.
- **Optimizing pool cadence below 60 seconds:** The 60-second pool update is an intentional anti-sniping design decision. Do not replace with WebSocket real-time updates for pool percentages.
- **Instantiating Program outside useMemo:** Program instantiation is expensive. Always memoize on `[wallet, connection]`.
- **Helius WebSocket without ping:** Helius closes idle WebSockets after 10 minutes. Send a lightweight ping (e.g., `connection.getSlot()`) every 60 seconds.
- **Fixed pixel size in px:** The 10×10 grid must use `1fr` columns with `aspect-ratio: 1` on cells so the canvas scales to any mobile viewport from 375px up.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet connect modal | Custom wallet picker | @solana/wallet-adapter-react-ui WalletModalProvider | Handles 15+ wallets, Wallet Standard auto-discovery, accessibility, multi-account |
| Transaction signing flow | Custom sign + send | Anchor Program.methods.placeBet().rpc() | Handles blockhash, signature, confirmation, retry; error codes mapped from IDL |
| PDA derivation | Compute program's PDAs manually | Port pda.ts from oracle/src/chain.ts | Seeds already validated in Phase 1/2; exact same logic required |
| Color HSL math | Guess at formula | Implement SPEC.md formula exactly (L ± (50-shade)×0.4, H ± (warmth-50)×0.15) | Formula is canonical — deviation changes rendered colors |
| Confetti burst | CSS particles | canvas-confetti | 100 moving DOM nodes will jank on mobile; canvas-confetti renders off-thread |
| Countdown timer | Server-side computed time | Client-side `Date.now() - openedAt_ms` in useEffect interval | Clock sync: opened_at is on-chain unix timestamp; client calculates elapsed locally |

**Key insight:** Solana wallets, transaction lifecycle, and PDA derivation each have subtle edge cases (reorg handling, blockhash expiry, seed canonicalization) that existing libraries handle correctly. Custom implementations introduce exactly those failure modes on a real-money game.

---

## Common Pitfalls

### Pitfall 1: SSR + Wallet Adapter = Hydration Mismatch
**What goes wrong:** WalletProvider reads `window.solana` which doesn't exist during SSR. React 19 (shipped with Next.js 15+) has stricter hydration checks — any mismatch throws an error in production.
**Why it happens:** App Router renders layouts on the server first unless explicitly marked `"use client"`.
**How to avoid:** Wrap the entire wallet provider tree in a `"use client"` component. The root `layout.tsx` can be a Server Component that imports and renders a `<SolanaWalletProvider>` client component.
**Warning signs:** `Hydration failed because the initial UI does not match server-rendered HTML` in console.

### Pitfall 2: Anchor's BN.js vs Native BigInt
**What goes wrong:** On-chain u64 values (colorPools, totalPool, lamport amounts) come back as `BN` objects from Anchor 0.32 program.account fetches. Passing them to `Number()` loses precision for amounts > 2^53. Displaying them raw shows `[object Object]`.
**Why it happens:** @coral-xyz/anchor 0.32 uses BN.js for all u64/u128 fields; it does not return native BigInt.
**How to avoid:** Convert with `.toNumber()` for display (safe for SOL amounts under 9007 SOL), or `.toString()` for exact display. Use BN arithmetic for on-chain instruction args.
**Warning signs:** Pool displays show `NaN` or `[object Object]`.

### Pitfall 3: WebSocket Account Decode — Raw Buffer vs Anchor Coder
**What goes wrong:** `connection.onAccountChange` delivers raw `AccountInfo<Buffer>`. Direct buffer read without Anchor's coder produces garbage.
**Why it happens:** Anchor accounts have an 8-byte discriminator prefix followed by Borsh-encoded data. Raw access ignores this.
**How to avoid:** Use `program.coder.accounts.decode("PixelState", accountInfo.data)` to decode the buffer using the IDL schema.
**Warning signs:** colorPools array shows zeroes even when bets exist; status field is an integer instead of a string.

### Pitfall 4: Helius 10-Minute WebSocket Inactivity Timeout
**What goes wrong:** WebSocket silently closes after 10 minutes of no server-sent messages (if no round activity occurs, e.g., during intermission). Frontend shows stale data without surfacing an error.
**Why it happens:** Helius enforces an inactivity timer on their WebSocket infrastructure.
**How to avoid:** Send a `connection.getSlot()` ping every 60 seconds inside the subscription useEffect. Implement `ws.onclose` → fallback to 15s polling loop.
**Warning signs:** Frontend shows correct data initially but stops updating; no console errors.

### Pitfall 5: Pool Cadence Drift Under Tab Suspension
**What goes wrong:** `setInterval` in a backgrounded browser tab is throttled by the browser (Chrome: 1-second minimum, some cases 1-minute). The 60-second pool interval becomes unreliable.
**Why it happens:** Browser power-saving throttles timers in hidden tabs.
**How to avoid:** Use `document.visibilitychange` to reset the interval when the tab regains focus. On `visibilitychange` to visible, immediately fetch and restart the 60s interval.
**Warning signs:** Users report stale pool percentages after switching tabs.

### Pitfall 6: Place Bet Double-Submit Race Condition
**What goes wrong:** Player taps "Place Bet" twice fast before the first transaction confirms, submitting two transactions that exceed the 10 SOL max or create duplicate BetAccount.
**Why it happens:** async RPC call hasn't returned when second tap fires.
**How to avoid:** Disable the bet button immediately on first tap (local `isSubmitting` state); re-enable only on transaction confirmation or error. Never rely on server-side idempotency alone.
**Warning signs:** Error toast "BetAccount already exists" in testing.

### Pitfall 7: opened_at Timestamp Precision
**What goes wrong:** `PixelState.openedAt` is an `i64` (unix seconds) from the Anchor coder, returned as BN. `Date.now()` is milliseconds. Mismatched units produce huge countdown values (e.g., "1,709,000 seconds remaining").
**Why it happens:** JavaScript `Date.now()` / 1000 returns float; BN `.toNumber()` returns integer seconds.
**How to avoid:** Always divide `Date.now()` by 1000 and floor before comparing. The 30-minute round = 1800 seconds; cap the countdown display at `Math.min(secondsLeft, 1800)`.
**Warning signs:** Countdown shows absurd values on first load.

---

## Code Examples

### Payout Multiplier Calculation (Display)

```typescript
// Source: SPEC.md "Displayed odds" section
// colorPool and totalPool are BN values from Anchor — convert to number for display
function computeMultiplier(colorPoolLamports: BN, totalPoolLamports: BN): string {
  const colorPool = colorPoolLamports.toNumber();
  const totalPool = totalPoolLamports.toNumber();
  if (colorPool === 0 || totalPool === 0) return "—";
  const multiplier = (totalPool * 0.95) / colorPool;
  return `${multiplier.toFixed(2)}x`;
}

function computePoolPercent(colorPoolLamports: BN, totalPoolLamports: BN): string {
  const colorPool = colorPoolLamports.toNumber();
  const totalPool = totalPoolLamports.toNumber();
  if (totalPool === 0) return "0%";
  return `${((colorPool / totalPool) * 100).toFixed(1)}%`;
}
```

### Place Bet Instruction

```typescript
// Source: oracle/src/chain.ts pattern + Anchor TypeScript docs
// https://www.anchor-lang.com/docs/clients/typescript
import BN from "bn.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

async function placeBet(
  program: Program,
  pixelPDA: PublicKey,
  betPDA: PublicKey,
  statsPDA: PublicKey,
  colorIndex: number,
  amountSol: number
) {
  const amountLamports = new BN(Math.floor(amountSol * LAMPORTS_PER_SOL));
  await program.methods
    .placeBet(colorIndex, amountLamports)
    .accounts({
      pixelState: pixelPDA,
      betAccount: betPDA,
      playerSeasonStats: statsPDA,
      player: program.provider.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });
}
```

### Countdown Hook

```typescript
// Derived from opened_at (on-chain unix seconds)
export function useCountdown(openedAtSeconds: number | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (openedAtSeconds === null) return;
    const ROUND_DURATION = 30 * 60; // 1800 seconds
    const LOCKOUT_START = 2 * 60;   // 120 seconds before end

    const tick = () => {
      const elapsed = Math.floor(Date.now() / 1000) - openedAtSeconds;
      const remaining = Math.max(0, ROUND_DURATION - elapsed);
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openedAtSeconds]);

  const isLocked = secondsLeft <= 120;
  const isFinalDrama = secondsLeft <= 10;
  return { secondsLeft, isLocked, isFinalDrama };
}
```

### Win Confetti Burst

```typescript
// Source: https://www.npmjs.com/package/canvas-confetti
import confetti from "canvas-confetti";

function triggerWinConfetti() {
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    colors: ["#FF3B6F", "#3BDBFF", "#FFD93B", "#A83BFF", "#FF6B3B", "#3BFF8A"],
  });
}
```

### Zustand Game Store Shape

```typescript
// app/src/store/gameStore.ts
import { create } from "zustand";

interface PixelSnapshot {
  pixelIndex: number;
  colorIndex: number;
  shade: number;
  warmth: number;
  status: "open" | "locked" | "resolved";
  colorPools: number[]; // 16 values in lamports (as number — safe for display)
  openedAtSeconds: number | null;
  winningColor: number | null;
}

interface GameState {
  seasonNumber: number;
  currentPixelIndex: number; // active round
  pixels: Record<number, PixelSnapshot>; // resolved + active
  activePixelData: PixelSnapshot | null;
  setPixelState: (data: PixelSnapshot) => void;
  setSeasonState: (seasonNumber: number, currentPixelIndex: number) => void;
}

export const useGameStore = create<GameState>((set) => ({ /* ... */ }));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| import from "framer-motion" | import from "motion/react" | Late 2024 (v11+) | Old import still works via re-export, but new import is canonical |
| Tailwind config in tailwind.config.js | @import "tailwindcss" in CSS, zero config file | Jan 2025 (v4.0) | Auto-scan; 100x faster; no purge config needed |
| @solana/kit / web3.js v2 | @solana/web3.js 1.x (when using Anchor) | Ongoing — kit is NOT Anchor-compatible yet | Must stay on 1.x for Anchor 0.32 |
| Manual wallet adapters (15+ packages) | Wallet Standard auto-discovery | 2023-2024 | Phantom/Backpack auto-register; fewer explicit adapter imports needed |
| create-next-app with pages/ | create-next-app with app/ (App Router) | Next.js 13+ stable | App Router is the current default and future |

**Deprecated/outdated:**
- `import { motion } from "framer-motion"`: Works (re-exported) but the package is now named `motion` — use `motion/react`
- `next/font` with `loader: "google"` option: Removed; use `next/font/google` named exports directly
- `@solana/wallet-adapter-phantom` (standalone): Superseded by Wallet Standard auto-discovery; PhantomWalletAdapter from @solana/wallet-adapter-wallets still works as fallback

---

## Open Questions

1. **@solana/kit (web3.js v2) readiness for Anchor**
   - What we know: @coral-xyz/anchor 0.32 is explicitly incompatible with web3.js v2; Anchor team is working on v2 support
   - What's unclear: Timeline for Anchor + kit compatibility; whether a workaround exists for read-only operations
   - Recommendation: Use @solana/web3.js 1.x throughout Phase 3. Re-evaluate at Phase 4. Do not mix.

2. **Anchor IDL TypeScript types in Next.js App Router**
   - What we know: IDL is at `target/idl/pixel_predict.json`; oracle uses `anchor.Idl` cast to avoid rootDir issues
   - What's unclear: Whether the frontend can import `target/types/pixel_predict.ts` directly (that file is outside `app/src/`)
   - Recommendation: Copy `target/idl/pixel_predict.json` into `app/src/lib/idl.json` at scaffold time, or symlink. Use `new Program(idl as any, provider)` as the oracle does.

3. **Helius WebSocket plan requirement**
   - What we know: Enhanced WebSockets require Business or Professional plan as of Oct 2025; standard `accountSubscribe` works on all plans
   - What's unclear: Whether the project's Helius plan includes enhanced WebSocket credits
   - Recommendation: Use standard `connection.onAccountChange` (web3.js built-in) rather than Helius-specific enhanced WebSocket API — same endpoint, no plan gating.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (to be configured in Wave 0) |
| Config file | `app/vitest.config.ts` — Wave 0 gap |
| Quick run command | `cd app && npm run test -- --run` |
| Full suite command | `cd app && npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FE-01 | Wallet provider renders without crashing SSR | unit | `vitest run src/__tests__/WalletProvider.test.tsx` | Wave 0 |
| FE-02 | computePixelColor returns correct hex for known shade/warmth | unit | `vitest run src/__tests__/color.test.ts` | Wave 0 |
| FE-03 | Active pixel CSS class applied to currentPixelIndex only | unit | `vitest run src/__tests__/GameCanvas.test.tsx` | Wave 0 |
| FE-04 | computeMultiplier and computePoolPercent return correct values | unit | `vitest run src/__tests__/odds.test.ts` | Wave 0 |
| FE-05 | BetInput enforces min/max SOL, quick-set buttons update value | unit | `vitest run src/__tests__/BetInput.test.tsx` | Wave 0 |
| FE-07 | useCountdown returns correct secondsLeft from openedAt | unit | `vitest run src/__tests__/useCountdown.test.ts` | Wave 0 |
| FE-08 | isLocked=true when secondsLeft <= 120 | unit | included in useCountdown test | Wave 0 |
| FE-09 | Bet button has disabled attr when isLocked=true | unit | `vitest run src/__tests__/BettingPanel.test.tsx` | Wave 0 |
| FE-11 | Pool fetch does NOT fire more than once per 60s window | unit | `vitest run src/__tests__/useColorPools.test.ts` | Wave 0 |
| FE-06 | Transaction confirmation toast renders | unit | `vitest run src/__tests__/WinNotification.test.tsx` | Wave 0 |
| FE-12 | WebSocket subscription calls onAccountChange | unit (mock) | `vitest run src/__tests__/useHeliusSocket.test.ts` | Wave 0 |
| FE-13 | Polling fallback activates on ws close | unit (mock) | included in useHeliusSocket test | Wave 0 |
| FE-10 | Resolution animation triggers on status→resolved transition | integration | manual-only (animation visual) | manual |
| FE-14 | Tap targets >= 44px on 375px viewport | manual | browser DevTools responsive mode | manual |
| FE-15 | Dark aesthetic renders correctly | manual | visual review | manual |
| FE-16 | Season progress indicator shows correct N/100 | unit | `vitest run src/__tests__/RoundInfo.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd app && npm run test -- --run` (unit tests only, <10s)
- **Per wave merge:** `cd app && npm run test` (watch off, full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/vitest.config.ts` — configure Vitest with jsdom environment
- [ ] `app/src/__tests__/color.test.ts` — covers FE-02 (computePixelColor formula)
- [ ] `app/src/__tests__/odds.test.ts` — covers FE-04 (multiplier + pool %)
- [ ] `app/src/__tests__/useCountdown.test.ts` — covers FE-07, FE-08
- [ ] `app/src/__tests__/BetInput.test.tsx` — covers FE-05
- [ ] `app/src/__tests__/BettingPanel.test.tsx` — covers FE-09
- [ ] `app/src/__tests__/GameCanvas.test.tsx` — covers FE-03
- [ ] `app/src/__tests__/useColorPools.test.ts` — covers FE-11
- [ ] `app/src/__tests__/useHeliusSocket.test.ts` — covers FE-12, FE-13
- [ ] `app/src/__tests__/RoundInfo.test.tsx` — covers FE-16
- [ ] `app/src/__tests__/WalletProvider.test.tsx` — covers FE-01 (SSR smoke test)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event`

---

## Sources

### Primary (HIGH confidence)
- SPEC.md (local) — color system, rendering formula, betting mechanics, PDA seeds, round lifecycle
- SPLAT_BRAND_IDENTITY.md (local) — typography, color palette, animation rules, spacing
- oracle/src/types.ts + chain.ts (local) — COLOR_NAMES, PixelStateData interface, PDA derivation patterns
- target/idl/pixel_predict.json (local) — instruction discriminators, account shapes
- [Solana Next.js Wallet Guide](https://solana.com/developers/guides/wallets/add-solana-wallet-adapter-to-nextjs) — provider setup, package list
- [Anchor TypeScript Client Docs](https://www.anchor-lang.com/docs/clients/typescript) — Program instantiation, useAnchorWallet pattern
- [Motion for React Docs](https://motion.dev/docs/react) — animate, spring, keyframes API (v12)
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) — next/font/google, CSS variables

### Secondary (MEDIUM confidence)
- npm registry — verified package versions: next@16.1.7, @coral-xyz/anchor@0.32.1, motion@12.38.0, @solana/wallet-adapter-react@0.15.39, tailwindcss@4.2.1, zustand@5.0.12, canvas-confetti@1.9.4
- [Helius Enhanced WebSockets Docs](https://docs.helius.dev/webhooks-and-websockets/enhanced-websockets) — accountSubscribe, 10-min inactivity timer, ping guidance
- [Tailwind v4 release](https://tailwindcss.com/blog/tailwindcss-v4) — zero-config setup, @import "tailwindcss"
- [Solana web3.js v2 Anza announcement](https://www.anza.xyz/blog/solana-web3-js-2-release) — confirms Anchor 0.32 incompatibility with kit

### Tertiary (LOW confidence — needs validation)
- WebSearch: Backpack auto-discovered via Wallet Standard with @solana/wallet-adapter-wallets — single source, should be tested in integration
- WebSearch: Canvas-confetti renders off main thread — verify on actual test device

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry; Anchor/web3.js compatibility confirmed via official Anza blog
- Architecture: HIGH — patterns derived from existing oracle code, official Anchor docs, official Next.js docs
- Pitfalls: HIGH for SSR/hydration and BN issues (well-documented); MEDIUM for Helius timeout specifics (one official source)
- Animation details: MEDIUM — Motion v12 API confirmed; exact easing values are Claude's discretion

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable stack; Solana ecosystem moves fast but Anchor 0.32 pin keeps it stable)
