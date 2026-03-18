---
phase: 04-trust-layer-and-docs
verified: 2026-03-18T14:00:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "Failed transactions surface a clear error with retry option"
    status: partial
    reason: "BettingPanel shows a toast error message but has no dedicated Retry button and no Anchor error-code-to-human-readable mapping. BettingPanel was not modified in any Phase 4 commit. The plan (04-05 Task 2 step 8) explicitly required adding a Retry button and contextual error messages; this was skipped."
    artifacts:
      - path: "app/src/components/betting/BettingPanel.tsx"
        issue: "No Retry button in error state; generic 'Something went wrong. Try again.' toast for all errors; no BettingClosed / InsufficientFunds error code mapping"
    missing:
      - "Explicit Retry button rendered when error occurs (calls clearError + allows re-submission)"
      - "Error-to-human-readable mapping for Anchor error codes (BettingClosed -> 'Bets are locked for this round', InsufficientFunds -> 'Not enough SOL in your wallet')"
human_verification:
  - test: "Visual inspection of complete Phase 4 integration"
    expected: "Header shows Bets button, ? button, jackpot teaser, wallet connect; My Bets drawer slides up from bottom; season completion overlay appears on final pixel; intermission screen shows countdown; onboarding tour appears on first visit; dark void aesthetic maintained"
    why_human: "Task 3 of Plan 05 is a blocking human checkpoint that has not been completed. Visual behavior, animation quality, mobile layout, and UX flow cannot be verified programmatically."
  - test: "My Bets drawer open and functional with a connected wallet"
    expected: "Drawer slides up with spring animation; stats bar shows bets placed, wins, hit rate, volume; bets grouped into Active / Claimable / History sections; individual Claim button visible for won bets; Claim All sticky footer appears with 2+ claimable bets"
    why_human: "Requires live wallet connection and actual on-chain bet data to test rendering of the bet list. Tests mock the data; actual drawer behavior with a wallet requires visual inspection."
  - test: "Tap a resolved pixel on canvas"
    expected: "Tooltip shows color name, shade, warmth, Round N; Verified fair badge in cyan; View proof expands to show truncated commitment hash and Arweave link if available; VRF pixels show orange 'Resolved via random fallback' instead"
    why_human: "Requires actual resolved pixel data from testnet/mainnet. Tests cover unit behavior; real tooltip UX requires visual verification."
---

# Phase 4: Trust Layer and Docs Verification Report

**Phase Goal:** A complete, shippable product where players can verify the AI's input was committed before they bet, see season stats, claim from My Bets, share completed canvases, and read clear docs — ready for mainnet launch
**Verified:** 2026-03-18T14:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| #   | Truth                                                                                                                                                  | Status      | Evidence                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | My Bets panel shows active, resolved, and claimable bets; player can claim individual or all winnings; personal season stats visible                    | VERIFIED  | `MyBetsDrawer.tsx`, `useBetHistory.ts`, `useClaimWinnings.ts`, `BetStatsBar.tsx`, `BetHistoryList.tsx`, `ClaimButton.tsx` all substantive and wired into `page.tsx` |
| 2   | Each resolved pixel shows commit-reveal data; VRF pixels have visual distinction; tapping shows color, shade, warmth, round number                     | VERIFIED  | `PixelCell.tsx` renders 6px cyan VRF dot; `PixelTooltip.tsx` shows Verified fair badge, expandable proof with `data.promptHash`; `game.ts` extended with `promptHash`, `arweaveTxid`, `hasArweaveTxid` |
| 3   | Season completion triggers full-screen canvas; player can generate/download branded PNG; 12-hour intermission shows countdown and season stats          | VERIFIED  | `SeasonCompleteOverlay.tsx`, `IntermissionScreen.tsx`, `ShareCanvas.tsx` all substantive; `useSeasonCompletion.ts` decodes on-chain status; wired into `page.tsx` |
| 4   | Jackpot balance visible with "Coming soon" label; failed transactions surface a clear error with retry option; wallet disconnect shows recovery state   | PARTIAL  | `JackpotTeaser.tsx` present and wired; `WalletDisconnectBanner.tsx` watches `prevConnectedRef` for true->false transition and shows orange recovery banner; **FS-12 gap: BettingPanel shows generic toast error but has no dedicated Retry button and no Anchor error code mapping** |
| 5   | Docs site covers How It Works, AI Artist, Betting Rules, Fairness, FAQ; all commit-reveal copy uses "prompt commitment proof" language                  | VERIFIED  | All 5 pages exist with substantive content, DocsLayout wrapper, and prompt commitment proof language confirmed in fairness and ai-artist pages |

**Score:** 4/5 truths verified (one partial)

---

## Required Artifacts

### Plan 01 — VRF Trust Layer

| Artifact                                              | Expected                                        | Status    | Details                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `app/src/types/game.ts`                               | PixelSnapshot with promptHash/arweaveTxid fields | VERIFIED | Lines 16-21: `promptHash: number[] \| null`, `arweaveTxid: string \| null`, `hasArweaveTxid: boolean` |
| `app/src/hooks/useSeasonData.ts`                      | Decodes promptHash/arweaveTxid from on-chain     | VERIFIED | Lines 35-50: decodes `promptHash`, `hasArweaveTxid`, `arweaveTxid` via `String.fromCharCode` |
| `app/src/components/canvas/PixelCell.tsx`             | VRF dot overlay on resolved VRF pixels           | VERIFIED | Lines 73, 97-112: `showVrfDot` conditional, 6px #3BDBFF circle absolute top-right            |
| `app/src/components/canvas/PixelTooltip.tsx`          | Expandable proof section with promptHashHex      | VERIFIED | Lines 70-71, 202-281: `promptHashHex` built, "View proof" toggle, proof section with Arweave link |

### Plan 02 — My Bets Drawer

| Artifact                                              | Expected                                        | Status    | Details                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `app/src/hooks/useBetHistory.ts`                      | memcmp filter on player pubkey at offset 8       | VERIFIED | Lines 73-80: `program.account.betAccount.all([{ memcmp: { offset: 8, bytes: ... } }])`       |
| `app/src/hooks/useClaimWinnings.ts`                   | Sequential batch claim, double-submit protection | VERIFIED | Lines 88-115: `for` loop not Promise.all; lines 42-43: isClaiming guard                      |
| `app/src/components/mybets/MyBetsDrawer.tsx`          | Slide-up drawer wired to useBetHistory           | VERIFIED | Lines 6, 33: imports and uses `useBetHistory`; spring animation; drag handle isolated         |
| `app/src/components/mybets/ClaimButton.tsx`           | ClaimButton + ClaimAllButton exports             | VERIFIED | File exists with substantive content (verified in prior test runs — 9 tests pass)             |

### Plan 03 — Season Completion

| Artifact                                              | Expected                                        | Status    | Details                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `app/src/hooks/useSeasonCompletion.ts`                | Decodes SeasonState status enum                  | VERIFIED | Lines 83-86: checks `statusRaw.completed !== undefined`, `statusRaw.intermission !== undefined` |
| `app/src/components/season/SeasonCompleteOverlay.tsx` | Full-screen overlay with confetti + canvas grid  | VERIFIED | Lines 48-82: 4-second confetti rAF loop; lines 150-179: 100-pixel grid; z-index 600          |
| `app/src/components/season/IntermissionScreen.tsx`    | HH:MM:SS countdown, canvas grid, Share button    | VERIFIED | Lines 20-30: `formatCountdown`; lines 53-69: 1s setInterval; ShareCanvas imported and rendered |
| `app/src/components/share/ShareCanvas.tsx`            | toPng, navigator.share, download fallback        | VERIFIED | Lines 4, 155, 165-179: `toPng` called; `navigator.canShare` guard; programmatic download fallback |

### Plan 04 — Docs Pages

| Artifact                                              | Expected                                        | Status    | Details                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `app/src/components/docs/DocsLayout.tsx`              | Fixed header with back arrow and nav             | VERIFIED | Lines 49-65: back arrow Link to "/"; lines 132-151: bottom nav with `usePathname` highlight   |
| `app/src/components/docs/ExpandableSection.tsx`       | CSS max-height collapsible section               | VERIFIED | File exists; CSS transition pattern confirmed in summary                                       |
| `app/src/app/how-it-works/page.tsx`                   | Wraps DocsLayout, min 30 lines                   | VERIFIED | 49 lines; imports and wraps `<DocsLayout title="How It Works">`                               |
| `app/src/app/fairness/page.tsx`                       | Contains "prompt commitment proof"               | VERIFIED | Line 41: exact phrase "prompt commitment proof" present; 3 ExpandableSection blocks           |
| `app/src/app/ai-artist/page.tsx`                      | AI Artist content with commitment language       | VERIFIED | Line 47: "prompt commitment proof" present                                                    |
| `app/src/app/rules/page.tsx`                          | Betting rules page                               | VERIFIED | 58 lines with substantive rules content; DocsLayout wrapped                                   |
| `app/src/app/faq/page.tsx`                            | 7-item FAQ accordion                             | VERIFIED | 7 ExpandableSection items confirmed in grep output                                             |

### Plan 05 — Integration

| Artifact                                              | Expected                                        | Status    | Details                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `app/src/components/onboarding/OnboardingTour.tsx`    | 4-step tour with localStorage persistence        | VERIFIED | Lines 86-95: localStorage check on mount; 4 TOUR_STEPS defined; Next/Got it! buttons          |
| `app/src/components/ui/WalletDisconnectBanner.tsx`    | prevConnectedRef pattern for true->false detect  | VERIFIED | Lines 17, 22-24: `prevConnectedRef = useRef(connected)`; disconnect detection; orange banner   |
| `app/src/components/ui/JackpotTeaser.tsx`             | "Coming soon" label in Splat Cyan                | VERIFIED | Lines 48-51: "Coming soon" text in `#3BDBFF`                                                  |
| `app/src/app/page.tsx`                                | MyBetsDrawer, SeasonCompleteOverlay wired in     | VERIFIED | Lines 12-17: all Phase 4 imports; lines 296: MyBetsDrawer; lines 278-284: SeasonCompleteOverlay; lines 71-88: IntermissionScreen conditional render |
| `app/src/components/betting/BettingPanel.tsx`         | Error with Retry button and error code mapping   | STUB    | Shows generic toast, no Retry button, no Anchor error code mapping. Not modified in Phase 4. |

---

## Key Link Verification

| From                           | To                                  | Via                                       | Status  | Details                                                                     |
| ------------------------------ | ----------------------------------- | ----------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `useSeasonData.ts`             | `game.ts` PixelSnapshot             | Decodes promptHash/arweaveTxid on-chain   | WIRED   | Lines 40-49 decode and return all three new fields                          |
| `PixelTooltip.tsx`             | `PixelSnapshot.promptHash`          | `data.promptHash` read in component       | WIRED   | Line 70: `data.promptHash ? bytesToHex(data.promptHash) : null`             |
| `useBetHistory.ts`             | `program.account.betAccount.all`    | memcmp offset 8 filter                    | WIRED   | Lines 73-80 use memcmp correctly                                            |
| `useClaimWinnings.ts`          | `program.methods.claimWinnings`     | Anchor instruction call                   | WIRED   | Lines 49-58 and 93-103: `.claimWinnings().accounts(...).rpc()`              |
| `MyBetsDrawer.tsx`             | `useBetHistory`                     | Called inside drawer                      | WIRED   | Line 33: `const { bets, stats, loading, refresh } = useBetHistory()`        |
| `useSeasonCompletion.ts`       | SeasonState on-chain                | Decodes `status` enum + `completedAt`     | WIRED   | Lines 73-96: Anchor coder decode; intermissionEndsSeconds computed          |
| `ShareCanvas.tsx`              | `html-to-image` toPng               | `toPng(shareRef.current, ...)`            | WIRED   | Line 155: `const dataUrl = await toPng(shareRef.current, { pixelRatio: 2 })`|
| `page.tsx`                     | `MyBetsDrawer`                      | isOpen state toggled by Bets header button | WIRED  | Lines 50, 175-196: `myBetsOpen` state; Bets button calls `setMyBetsOpen(true)`; line 296 renders drawer |
| `page.tsx`                     | `SeasonCompleteOverlay`             | Conditional on seasonStatus === "completed"| WIRED  | Lines 64-68: useEffect sets `showSeasonComplete`; lines 278-284: conditional render |
| `WalletDisconnectBanner.tsx`   | `useWallet().connected`             | prevConnectedRef transition detection     | WIRED   | Lines 17, 22-30: `prevConnectedRef.current === true && connected === false`  |
| `how-it-works/page.tsx`        | `DocsLayout`                        | Wraps content in DocsLayout               | WIRED   | Line 22: `<DocsLayout title="How It Works">`                                |
| `fairness/page.tsx`            | `ExpandableSection`                 | Uses ExpandableSection for nerdy content  | WIRED   | Lines 88-92: 3 ExpandableSection blocks                                     |
| `BettingPanel.tsx`             | Retry button (FS-12)                | Was supposed to show Retry on error       | NOT_WIRED | No Retry button rendered; `clearError()` called immediately in toast useEffect, not on retry action |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                  | Status     | Evidence                                                                      |
| ----------- | ----------- | ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| FS-01       | 04-02       | View active, resolved, claimable bets in My Bets panel       | SATISFIED  | `BetHistoryList.tsx` groups into Active/Claimable/History sections            |
| FS-02       | 04-02       | Claim individual winnings or all at once                     | SATISFIED  | `ClaimButton` + `ClaimAllButton` with sequential batch in `useClaimWinnings`  |
| FS-03       | 04-02       | Personal season stats (bets, wins, hit rate, volume)         | SATISFIED  | `BetStatsBar.tsx` reads from `PlayerStats`; `useBetHistory` fetches stats PDA |
| FS-04       | 04-03       | Full-screen completion screen when final pixel resolves      | SATISFIED  | `SeasonCompleteOverlay.tsx` z-index 600, confetti, zoomed canvas grid         |
| FS-05       | 04-03       | Generate and share branded PNG "Pixel Predict — Season X"   | SATISFIED  | `ShareCanvas.tsx` uses `html-to-image` toPng with inline styles; navigator.share + download fallback |
| FS-06       | 04-03       | 12-hour intermission countdown with season stats             | SATISFIED  | `IntermissionScreen.tsx` HH:MM:SS countdown via setInterval                   |
| FS-07       | 04-01       | VRF-resolved pixels display visual distinction on canvas     | SATISFIED  | `PixelCell.tsx` renders 6px #3BDBFF dot when `vrfResolved === true`           |
| FS-08       | 04-01       | Tap pixel to see color, shade, warmth, round number          | SATISFIED  | `PixelTooltip.tsx` lines 162-165: shade/warmth/round displayed                |
| FS-09       | 04-01       | Commit-reveal data: prompt hash + Arweave link per round     | SATISFIED  | `PixelTooltip.tsx` expandable proof section with hex hash and Arweave link    |
| FS-10       | 04-05       | In-app explainer (4-step onboarding tour)                    | SATISFIED  | `OnboardingTour.tsx` 4 steps, localStorage persistence, targets game-canvas/betting-panel/header |
| FS-11       | 04-05       | Jackpot balance with "Coming soon" label                     | SATISFIED  | `JackpotTeaser.tsx` renders "Coming soon" in #3BDBFF in header                |
| FS-12       | 04-05       | Failed transactions: clear error message with retry option   | BLOCKED    | Toast shows generic error; no Retry button; no Anchor error code mapping; `BettingPanel.tsx` not modified in Phase 4 |
| FS-13       | 04-05       | Wallet disconnect recovery state                             | SATISFIED  | `WalletDisconnectBanner.tsx` prevConnectedRef detects true->false; orange banner with Reconnect button |
| DOC-01      | 04-04       | How It Works page — game loop in casual language             | SATISFIED  | `/how-it-works/page.tsx` 49 lines: The Game, The Loop, The Canvas, The Odds  |
| DOC-02      | 04-04       | AI Artist page — what AI sees/doesn't see, how it picks      | SATISFIED  | `/ai-artist/page.tsx`: What AI Sees, What It Doesn't See, How It Picks, The Commitment with "prompt commitment proof" |
| DOC-03      | 04-04       | Betting Rules page — limits, lockout, rake, zero-winner      | SATISFIED  | `/rules/page.tsx` covers bet limits, one-color rule, clock, rake, zero-winner, claiming |
| DOC-04      | 04-04       | Fairness page — commit-reveal, prompt publication, verify    | SATISFIED  | `/fairness/page.tsx` casual 3-sentence intro + 3 ExpandableSection blocks; "prompt commitment proof" language confirmed |
| DOC-05      | 04-04       | FAQ page — wallet, claiming, zero-winner, season timing      | SATISFIED  | `/faq/page.tsx` 7 ExpandableSection accordion items covering all specified topics |

**Requirements satisfied:** 18/19
**Blocked:** FS-12

---

## Anti-Patterns Found

| File                                       | Line | Pattern                                         | Severity | Impact                                                            |
| ------------------------------------------ | ---- | ----------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `app/src/components/betting/BettingPanel.tsx` | 61 | Generic error toast "Something went wrong. Try again." — no error code mapping, no Retry button | Warning | FS-12 partially unmet: error is surfaced but lacks retry affordance and contextual messaging |

No STUB patterns found. No placeholder returns. No empty implementations. No TODO/FIXME markers in Phase 4 files. TypeScript compiles with zero errors.

---

## Human Verification Required

### 1. Complete Phase 4 Visual Integration

**Test:** Run `npm run dev` in `app/`. Open http://localhost:3000. Verify:
- Header shows SPLAT logo, Bets button (when wallet connected), ? button, JackpotTeaser with "Coming soon"
- Clicking ? navigates to /how-it-works with back arrow and bottom nav
- On first visit, 4-step onboarding tour appears and advances correctly
- Connecting wallet reveals the Bets button
- Bets button opens the slide-up My Bets drawer with drag-to-dismiss handle
- Dark void aesthetic (#14141F) maintained throughout all pages on mobile viewport (375px)

**Expected:** All header elements visible; docs pages accessible; drawer slides in with spring animation; no light mode leaks
**Why human:** Plan 05 Task 3 is a blocking human checkpoint. Visual behavior, animation quality, and mobile layout require visual inspection.

### 2. My Bets Drawer with Live On-Chain Data

**Test:** Connect wallet with prior bets on testnet. Open My Bets drawer.
**Expected:** Stats bar shows real bets placed, wins, hit rate, volume from PlayerSeasonStats PDA; bets grouped into Active/Claimable/History; Claim button present for won bets; Claim All footer appears with 2+ claimable bets
**Why human:** Unit tests mock the data. Real on-chain enumeration via memcmp and the claim_winnings transaction require a connected wallet and actual bets.

### 3. Pixel Tooltip Proof Section

**Test:** On a season with resolved pixels, tap a non-VRF resolved pixel.
**Expected:** Tooltip shows color, shade, warmth, round number; "Verified fair" badge in cyan; "View proof" expands to show truncated hash (first 8 + last 8 chars) and "View prompt on Arweave" link if hasArweaveTxid is true
**Why human:** Requires live resolved pixel data from testnet. The tooltip's hash display and Arweave link are only meaningful with real on-chain prompt commitment data.

---

## Gaps Summary

One gap blocking complete goal achievement:

**FS-12 — Failed transaction retry option not implemented.** The plan (04-05, Task 2, step 8) required enhancing `BettingPanel.tsx` with: (a) a dedicated Retry button rendered when error is non-null, and (b) error-to-human-readable mapping for Anchor error codes. Neither was implemented. `BettingPanel.tsx` was not modified in any Phase 4 commit — its last change was Phase 3. The current behavior shows a generic 5-second toast ("Something went wrong. Try again.") and immediately calls `clearError()`, leaving no explicit retry affordance.

The user can technically retry by clicking SPLAT IT again after the toast dismisses, but this is not the dedicated retry UI specified by the requirement. The error message is also not contextual — "BettingClosed" errors and "InsufficientFunds" errors produce the same generic text.

The other 18/19 requirements are fully verified against the codebase. All Phase 4 artifacts exist, are substantive, and are wired correctly. TypeScript compiles clean. All documented tests pass (71+ tests across phase). The `html-to-image` package is installed. The "prompt commitment proof" language is present and "reproducible result" language is absent throughout.

The phase goal is 95% achieved. The one gap is a UX enhancement to an already-functional error path.

---

_Verified: 2026-03-18T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
