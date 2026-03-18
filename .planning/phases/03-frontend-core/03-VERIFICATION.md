---
phase: 03-frontend-core
verified: 2026-03-18T15:30:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "Player connects wallet and sees live 10x10 canvas with shade/warmth-modified pixel colors and pulsing active pixel"
    status: partial
    reason: "Canvas renders correctly and active pixel has marching-ants animation. WebSocket hook (useHeliusSocket) exists and is fully implemented but is NEVER CALLED in the live app — it is neither wired into page.tsx nor into GameCanvas.tsx. The comment in page.tsx says 'useHeliusSocket is called via GameCanvas in a deeper tree after hydration' but GameCanvas does not call it. Live state updates rely only on useSeasonData (initial load) with no subsequent WebSocket subscription active."
    artifacts:
      - path: "app/src/hooks/useHeliusSocket.ts"
        issue: "Implemented (249 lines, substantive) but orphaned — not imported or called from any component in the render tree"
      - path: "app/src/app/page.tsx"
        issue: "Contains comment claiming useHeliusSocket is used via GameCanvas but it is not. PDAs are derived (seasonPDA, pixelPDA) but never passed to useHeliusSocket."
      - path: "app/src/components/canvas/GameCanvas.tsx"
        issue: "Does not import or call useHeliusSocket despite plan 03-04 comment claiming it is wired here"
    missing:
      - "Call useHeliusSocket({ pixelPDA, seasonPDA, seasonNumber }) in page.tsx (PDAs are already derived there)"
      - "OR import and call useHeliusSocket in GameCanvas.tsx passing derived PDAs from store"
  - truth: "Debug/test content left in production page"
    status: failed
    reason: "page.tsx line 132-135 contains a visible debug div: 'This is a test of the font family. THIS IS A TEST OF THE FONT FAMILY' — this is leftover development text rendered in the live page between the header and canvas"
    artifacts:
      - path: "app/src/app/page.tsx"
        issue: "Lines 132-135: <div className='py-2 font-bold'>This is a test of the font family. <br /> THIS IS A TEST OF THE FONT FAMILY</div>"
    missing:
      - "Remove the debug font-test div from page.tsx"
human_verification:
  - test: "Visual inspection of complete game loop UI at 375px mobile width"
    expected: "Dark Void background, Luckiest Guy display font (confirmed as substitute for Fredoka One — functionally equivalent), Nunito body text, rounded corners, chunky 44px buttons, marching-ants active pixel animation, 4x4 color swatch grid with multipliers visible"
    why_human: "Visual rendering, font appearance, animation smoothness, and overall brand aesthetic cannot be verified programmatically"
  - test: "Connect Phantom or Solflare wallet and verify wallet modal appears with both wallet options"
    expected: "Clicking WalletMultiButton opens modal showing at least Phantom and Solflare, with Backpack auto-discovered if installed"
    why_human: "Requires actual browser with wallet extensions installed"
  - test: "After WebSocket gap fix: verify live state updates on pixel resolution"
    expected: "When a round resolves on-chain, the active pixel floods with winning color without manual page refresh"
    why_human: "Requires live devnet round resolution to trigger"
---

# Phase 3: Frontend Core Verification Report

**Phase Goal:** A playable, mobile-first game loop where a player with a connected wallet can view the live canvas, place a bet, watch the countdown, see the round resolve with animation, and claim winnings
**Verified:** 2026-03-18T15:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player connects Phantom/Solflare/Backpack and sees live 10x10 canvas with shade/warmth colors and pulsing active pixel | PARTIAL | Canvas (180 lines), WalletProvider, useSeasonData all verified and wired. Active pixel has `pixel-active` CSS class with marching-ants. BUT useHeliusSocket is orphaned — canvas is not "live" after initial load |
| 2 | Player selects color, enters bet, submits transaction, receives confirmation — bet button shows "Bets locked" in final 2 minutes | VERIFIED | BettingPanel (345 lines) wires useCountdown, useColorPools, usePlaceBet. isLocked disables button with "Locked. The AI is thinking..." label. Toast confirmation wired. ColorSwatch with min-height 44px. BetInput with quick-set buttons. |
| 3 | Countdown timer tracks on-chain opened_at; pool percentages and multipliers refresh every 60 seconds | VERIFIED | useCountdown reads openedAtSeconds from store. CountdownTimer renders MM:SS, lockout badge, final drama. useColorPools sets 60s interval with POOL_REFRESH_INTERVAL_MS constant and tab-visibility reset. |
| 4 | Round resolution triggers color flood animation with win/loss notification; canvas and season progress update immediately | VERIFIED | useResolution (138 lines) detects status->resolved transition via prevStatusRef. ResolutionAnimation (95 lines) uses clipPath circle burst + glow. WinNotification with confetti + rAF ticker. LossNotification minimal fade. clearForNewRound fires after 2.5s. |
| 5 | All interactions work on 375px mobile with thumb-reach tap targets; dark video-game-casual aesthetic renders correctly | PARTIAL | Functionally verified: CSS globals enforce min-height 44px buttons, ColorSwatch min-height 44px, BetInput 44px. Void background #14141F, Surface #1E1E2E in globals.css. BUT: (a) debug text "This is a test of the font family" is live in page.tsx; (b) font is Luckiest Guy not Fredoka One (plan deviation — functionally equivalent display font, needs human visual check) |

**Score:** 4/5 truths verified (2 partially verified with gaps blocking full verification)

---

## Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `app/src/components/providers/WalletProvider.tsx` | — | 42 | VERIFIED | Exports SolanaWalletProvider. ConnectionProvider + WalletProvider + WalletModalProvider tree. PhantomWalletAdapter + SolflareWalletAdapter. autoConnect. |
| `app/src/hooks/useAnchorProgram.ts` | — | 29 | VERIFIED | useAnchorWallet + AnchorProvider + Program(idl). Returns null when disconnected. Memoized on [wallet, connection]. |
| `app/src/lib/color.ts` | — | 134 | VERIFIED | COLOR_NAMES (16), BASE_HEX, hexToHsl, hslToHex, computePixelColor with exact SPEC formula. |
| `app/src/lib/pda.ts` | — | 87 | VERIFIED | All 5 PDA functions. Seeds match oracle/src/chain.ts exactly. u16LE encoding with Buffer.alloc(2). |
| `app/src/store/gameStore.ts` | — | 34 | VERIFIED | Zustand create with setPixelState, setSeasonState, setPlayerBet, setWsConnected, clearForNewRound. |
| `app/src/types/game.ts` | — | 54 | VERIFIED | PixelSnapshot, BetState, RoundState, GameState interfaces all present. |
| `app/src/lib/constants.ts` | — | 28 | VERIFIED | PROGRAM_ID, GRID_SIZE, ROUND_DURATION_SECONDS (1800), LOCKOUT_SECONDS (120), POOL_REFRESH_INTERVAL_MS (60000), POLLING_FALLBACK_INTERVAL_MS (15000), WS_PING_INTERVAL_MS, MIN_BET_SOL, MAX_BET_SOL, QUICK_BET_AMOUNTS. |
| `app/src/components/canvas/GameCanvas.tsx` | 40 | 180 | VERIFIED | 10x10 CSS grid, 100 pixels, PixelTooltip, ResolutionAnimation overlay via CSS calc positioning. Reads pixels + currentPixelIndex from store. |
| `app/src/components/canvas/PixelCell.tsx` | 30 | 97 | VERIFIED | computePixelColor for resolved. pixel-active class for marching-ants. Scrolls to #betting-panel on active tap. |
| `app/src/components/canvas/PixelTooltip.tsx` | 25 | 135 | VERIFIED | Floating card with color name, shade, warmth, round number, VRF badge. Click-away dismiss. Viewport clamping. |
| `app/src/components/round/RoundInfo.tsx` | 15 | 76 | VERIFIED | "Round N of 100" with Splat Cyan color number. "Season N". Progress bar width = (pixelIndex/100)*100%. |
| `app/src/hooks/useHeliusSocket.ts` | — | 249 | ORPHANED | Fully implemented — PixelState+SeasonState subscriptions, 60s ping, polling fallback, tab visibility handler, cleanup. But NOT CALLED anywhere in the render tree. |
| `app/src/hooks/useSeasonData.ts` | — | 164 | VERIFIED | Fetches SeasonState, batch-fetches all PixelState accounts, fetches player BetAccount. Updates store. |
| `app/src/components/betting/BettingPanel.tsx` | 80 | 345 | VERIFIED | All 6 sections: CountdownTimer, 4x4 ColorSwatch grid with multipliers, BetInput, action button (selected color background), after-bet display, toast notifications. isLocked red tint via panel-locked CSS. |
| `app/src/components/betting/ColorSwatch.tsx` | 25 | 70 | VERIFIED | BASE_HEX background, multiplier overlay, motion scale on select, min-height 44px. |
| `app/src/components/betting/BetInput.tsx` | 40 | 179 | VERIFIED | type="text" inputMode="decimal", +/- buttons (44px each), QUICK_BET_AMOUNTS presets, clamp to MIN/MAX, disabled state. |
| `app/src/components/round/CountdownTimer.tsx` | 40 | 141 | VERIFIED | Normal (cyan), locked (yellow + LOCKED badge), final drama (pink, scale/shake, edge glow), thinking state. useReducedMotion. |
| `app/src/hooks/useCountdown.ts` | — | 62 | VERIFIED | 1s interval from openedAtSeconds. isLocked = secondsLeft <= 120. isFinalDrama = secondsLeft <= 10 && > 0. MM:SS display strings. |
| `app/src/hooks/useColorPools.ts` | — | 107 | VERIFIED | 60s interval with POOL_REFRESH_INTERVAL_MS. Tab visibility reset. computeMultiplier + computePoolPercent exported. |
| `app/src/hooks/usePlaceBet.ts` | — | 89 | VERIFIED | Double-submit guard. program.methods.placeBet().accounts().rpc(). Optimistic setPlayerBet on success. Error state + clearError. |
| `app/src/components/canvas/ResolutionAnimation.tsx` | 40 | 95 | VERIFIED | clipPath circle(0%)->circle(150%) 200ms + boxShadow glow pulse 500ms. prefers-reduced-motion instant fill. onComplete after 750ms. |
| `app/src/components/ui/WinNotification.tsx` | 30 | 150 | VERIFIED | Spring slide-in. confetti() with 6 brand colors. rAF ticker 0->payoutSol over 600ms ease-out. 4s auto-dismiss. |
| `app/src/components/ui/LossNotification.tsx` | 20 | 71 | VERIFIED | Fade in 300ms, hold 2s, fade out 300ms. 2.6s auto-dismiss. "Splat. It was {color}. Next one?" |
| `app/src/hooks/useResolution.ts` | — | 138 | VERIFIED | prevStatusRef detects one-shot "resolved" transition. Win/loss computed. Payout estimated. clearForNewRound after 2.5s. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| WalletProvider.tsx | app/layout.tsx | `<SolanaWalletProvider>` wraps children | WIRED | layout.tsx imports and uses SolanaWalletProvider |
| useAnchorProgram.ts | lib/idl.json | `import idl from "@/lib/idl.json"` | WIRED | Direct import confirmed |
| lib/pda.ts | lib/constants.ts | Uses PROGRAM_ID | WIRED | All PDA functions import PROGRAM_ID from constants |
| useHeliusSocket.ts | store/gameStore.ts | useGameStore setPixelState/setSeasonState | ORPHANED | Hook correctly calls store setters internally BUT IS NEVER CALLED — wiring to page/component layer missing |
| GameCanvas.tsx | store/gameStore.ts | `useGameStore.*pixels` | WIRED | Reads pixels and currentPixelIndex from store |
| PixelCell.tsx | lib/color.ts | `computePixelColor` | WIRED | Called on every resolved pixel render |
| useCountdown.ts | store/gameStore.ts | reads openedAtSeconds via BettingPanel/CountdownTimer prop chain | WIRED | CountdownTimer reads from store, passes to useCountdown |
| useColorPools.ts | lib/pda.ts | `derivePixelPDA` | WIRED | Called in fetchPools to derive the pixel PDA |
| usePlaceBet.ts | useAnchorProgram.ts | `program.methods.placeBet` | WIRED | usePlaceBet calls useAnchorProgram(), uses program.methods |
| BettingPanel.tsx | useCountdown.ts | `isLocked` for disabled state and red tint | WIRED | BettingPanel reads isLocked from useCountdown, applies panel-locked class |
| useResolution.ts | store/gameStore.ts | `useGameStore.*activePixelData` status | WIRED | Reads pixels[currentPixelIndex].status via store |
| useResolution.ts | ResolutionAnimation.tsx | sets resolvedPixel, GameCanvas renders overlay | WIRED | GameCanvas calls useResolution internally, renders ResolutionAnimation when resolvedPixel is set |
| WinNotification.tsx | canvas-confetti | `confetti(...)` | WIRED | Direct import and call in useEffect on mount |
| page.tsx | useHeliusSocket.ts | Call in render tree | NOT WIRED | PDAs are derived in page.tsx but useHeliusSocket is never imported or called |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FE-01 | 03-01 | User can connect Solana wallet (Phantom, Solflare, Backpack) | SATISFIED | WalletProvider.tsx with PhantomWalletAdapter + SolflareWalletAdapter + Backpack auto-discovery |
| FE-02 | 03-02 | User sees 10×10 canvas with shade/warmth-modified colors | SATISFIED | GameCanvas + PixelCell + computePixelColor wired |
| FE-03 | 03-02 | Active pixel has pulsing highlight/border animation | SATISFIED | pixel-active CSS class in globals.css with marching-ants @keyframes borderMarch |
| FE-04 | 03-03 | User sees 16-color betting panel with pool percentages and payout multipliers | SATISFIED | BettingPanel 4x4 grid with ColorSwatch, multipliers from useColorPools |
| FE-05 | 03-03 | User can select color and enter bet with quick-set buttons | SATISFIED | ColorSwatch selection, BetInput with +/- and QUICK_BET_AMOUNTS presets |
| FE-06 | 03-03 | User sees transaction confirmation after placing bet | SATISFIED | Toast notification wired in BettingPanel on bet success and error |
| FE-07 | 03-03 | Countdown timer synced to on-chain opened_at | SATISFIED | useCountdown computes from openedAtSeconds, CountdownTimer renders MM:SS |
| FE-08 | 03-03 | Timer shows visual shift in final 2 minutes | SATISFIED | CountdownTimer shifts to yellow + LOCKED badge at isLocked. Final 10s: pink, pulse, shake, edge glow |
| FE-09 | 03-03 | Bet button disabled with "Bets locked" during lockout | SATISFIED | buttonLabel returns "Locked. The AI is thinking..." when isLocked. isActionDisabled=true. |
| FE-10 | 03-04 | Resolution animation when round resolves | SATISFIED | ResolutionAnimation radial burst + glow, triggered by useResolution |
| FE-11 | 03-03 | Pool distribution updates from on-chain data every 60 seconds | SATISFIED | useColorPools with POOL_REFRESH_INTERVAL_MS=60000 |
| FE-12 | 03-02 | Frontend uses Helius WebSocket subscriptions | BLOCKED | useHeliusSocket fully implemented but NEVER CALLED in production render tree |
| FE-13 | 03-02 | Frontend falls back to polling every 15 seconds if WebSocket disconnects | BLOCKED | Polling fallback implemented inside useHeliusSocket but hook is orphaned |
| FE-14 | 03-03, 03-04 | All interactions work with thumb-reach tap targets on mobile (375px+) | SATISFIED | globals.css: button min-height 44px. ColorSwatch min-height 44px. BetInput buttons 44px. Action button 52px. |
| FE-15 | 03-01, 03-04 | Dark background with video-game-casual aesthetic | PARTIAL | Void background #14141F, Surface #1E1E2E, rounded corners, chunky buttons all verified in CSS. Font substituted (Luckiest Guy instead of Fredoka One — functionally equivalent for display use). Debug text div remains in page.tsx. Human visual confirmation needed. |
| FE-16 | 03-02 | User sees season progress indicator (round N of 100) | SATISFIED | RoundInfo renders "Round N of 100" with Splat Cyan color, progress bar, "Season N" |

**FE-12 BLOCKED and FE-13 BLOCKED** because their implementation lives inside useHeliusSocket, which is orphaned from the component tree.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/app/page.tsx` | 132-135 | Debug text: "This is a test of the font family. THIS IS A TEST OF THE FONT FAMILY" | BLOCKER | Visible to all users in production UI; renders between header and canvas |
| `app/src/app/page.tsx` | 34 | Comment claims useHeliusSocket "is called via GameCanvas in a deeper tree after hydration" — false statement | BLOCKER | Misleading comment concealing the fact that live WebSocket subscriptions are not active; FE-12 and FE-13 fail silently |
| `app/src/app/layout.tsx` | 7 | `Luckiest_Guy` used instead of specified `Fredoka` | WARNING | Plan called for Fredoka One; implementation uses Luckiest Guy. Both are chunky display fonts — visually similar but not identical to brand spec. Needs human sign-off. |

---

## Human Verification Required

### 1. Full Visual and Brand Inspection

**Test:** Run `cd app && npm run dev`, open http://localhost:3000 in a browser at 375px width (Chrome DevTools device toolbar)
**Expected:** Dark Void (#14141F) background, white text, Luckiest Guy headings (chunky, uppercase), Nunito body text, rounded corners on all cards and buttons, 4x4 color swatch grid visible, countdown timer in Splat Cyan, marching-ants animation on one pixel cell
**Why human:** Visual rendering and animation quality cannot be verified programmatically

### 2. Wallet Connection Modal

**Test:** Click WalletMultiButton in the header
**Expected:** Modal opens showing Phantom and Solflare wallet options; Backpack appears if browser extension is installed
**Why human:** Requires browser with wallet extensions; can't simulate wallet modal programmatically

### 3. Luckiest Guy Font Sign-Off

**Test:** Inspect headings and button text in live browser vs brand identity doc
**Expected:** Display font should feel "chunky, playful, game-casual" — confirm Luckiest Guy satisfies the brand intent or requires replacement with Fredoka One
**Why human:** Font aesthetic judgment is subjective and requires visual inspection

---

## Gaps Summary

Two gaps are blocking goal achievement:

**Gap 1 — useHeliusSocket Not Wired (CRITICAL, blocks FE-12 and FE-13)**

`useHeliusSocket` is a fully implemented, 249-line hook that handles WebSocket subscriptions to PixelState and SeasonState accounts, maintains a 60-second keepalive ping, provides polling fallback on disconnect, and handles tab visibility changes. However, it is never called. `page.tsx` derives `pixelPDA` and `seasonPDA` (the exact parameters useHeliusSocket needs) but stops there with a misleading comment. The app currently only loads initial data via `useSeasonData()` on mount — after that initial fetch, the canvas never updates without a page refresh.

Fix: In `page.tsx`, import `useHeliusSocket` and call it after the PDA derivations:
```typescript
useHeliusSocket({ pixelPDA, seasonPDA, seasonNumber: seasonNumber || 1 });
```

**Gap 2 — Debug Text in Production Page (WARNING)**

`page.tsx` lines 132-135 contain a visible `<div>` with the text "This is a test of the font family. THIS IS A TEST OF THE FONT FAMILY" left over from development. This renders in the live page between the header padding and the canvas.

Fix: Remove lines 132-135 from `app/src/app/page.tsx`.

Both fixes are minimal code changes — the underlying implementations are complete and correct. The WebSocket hook already implements everything needed; it just needs to be called.

---

_Verified: 2026-03-18T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
