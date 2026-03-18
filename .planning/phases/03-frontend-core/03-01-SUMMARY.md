---
phase: 03-frontend-core
plan: "01"
subsystem: ui
tags: [next.js, react, solana, anchor, wallet-adapter, zustand, tailwind, vitest, typescript]

# Dependency graph
requires:
  - phase: 01-anchor-program
    provides: IDL at target/idl/pixel_predict.json and program ID FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG
  - phase: 02-oracle-service
    provides: COLOR_NAMES array and PDA seed patterns from oracle/src/chain.ts and oracle/src/types.ts
provides:
  - Next.js 15 app scaffolded in app/ with Solana/Anchor dependencies
  - SolanaWalletProvider (Phantom, Solflare, Backpack via Wallet Standard)
  - useAnchorProgram hook returning memoized Program instance
  - color utilities (computePixelColor, hexToHsl, hslToHex) with HSL shade/warmth formula
  - PDA derivation functions matching oracle/src/chain.ts seeds exactly
  - Zustand gameStore with PixelSnapshot, BetState, GameState
  - Splat brand globals.css with Void background, font variables, Tailwind theme tokens
  - All 12 unit tests passing (6 color, 6 PDA)
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added:
    - next@16.1.7 (App Router, Turbopack)
    - "@coral-xyz/anchor@^0.32.1"
    - "@solana/web3.js@^1.98.4"
    - "@solana/wallet-adapter-react + react-ui + wallets + base"
    - zustand@^5.0.12
    - motion@^12.38.0
    - canvas-confetti@^1.9.4
    - vitest@^4.1.0 + @vitejs/plugin-react + jsdom
    - tailwindcss@^4 (via @tailwindcss/postcss)
  patterns:
    - Turbopack enabled by default (Next.js 16); webpack config replaced with empty turbopack config
    - Wallet Standard auto-discovery for Backpack (no explicit adapter needed)
    - useAnchorWallet (not useWallet) for Anchor Program instantiation
    - per-file vitest environment annotation (@vitest-environment node) for @solana/web3.js tests
    - Tailwind v4 @theme block for brand color token definitions

key-files:
  created:
    - app/src/lib/constants.ts
    - app/src/lib/color.ts
    - app/src/lib/pda.ts
    - app/src/lib/anchor.ts
    - app/src/lib/idl.json
    - app/src/types/game.ts
    - app/src/store/gameStore.ts
    - app/src/components/providers/WalletProvider.tsx
    - app/src/hooks/useAnchorProgram.ts
    - app/src/__tests__/color.test.ts
    - app/src/__tests__/pda.test.ts
    - app/vitest.config.ts
  modified:
    - app/package.json (added test script + all dependencies)
    - app/next.config.ts (Turbopack config + transpilePackages)
    - app/src/app/layout.tsx (Fredoka/Nunito/JetBrains fonts + SolanaWalletProvider)
    - app/src/app/page.tsx (SPLAT shell with WalletMultiButton)
    - app/src/app/globals.css (brand colors, Void bg, scrollbar, font utilities)

key-decisions:
  - "Next.js 16 Turbopack by default: replaced webpack config with empty turbopack: {} block to silence error"
  - "per-file vitest environment: @vitest-environment node annotation used for PDA tests — jsdom lacks Node crypto needed by @solana/web3.js findProgramAddressSync"
  - "Backpack wallet via Wallet Standard: no explicit BackpackWalletAdapter import needed, auto-discovered"
  - "useAnchorWallet not useWallet for Anchor: Anchor requires synchronous signable wallet interface"
  - "Tailwind v4 @theme block for brand tokens: avoids tailwind.config.ts, colocated with globals.css"

patterns-established:
  - "WalletProvider pattern: SolanaWalletProvider wraps children in layout.tsx; all client components below can use wallet hooks"
  - "Anchor hook pattern: useAnchorProgram returns Program | null based on wallet connection state"
  - "HSL pixel color formula: base hex -> HSL, L += (50-shade)*0.4, H += (warmth-50)*0.15, clamp, back to hex"
  - "PDA test pattern: @vitest-environment node annotation for any test file using @solana/web3.js"
  - "Brand color tokens: all Splat brand colors available as Tailwind utilities (bg-void, text-splat-pink, etc.)"

requirements-completed: [FE-01, FE-15]

# Metrics
duration: 11min
completed: 2026-03-18
---

# Phase 3 Plan 01: Frontend Core Scaffold Summary

**Next.js 16 + Anchor + wallet-adapter frontend scaffold with color utilities, PDA derivation, Zustand game store, Splat brand globals, and 12 passing unit tests**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-18T04:10:55Z
- **Completed:** 2026-03-18T04:22:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Scaffolded Next.js 16 App Router project with full Solana/Anchor dependency suite (wallet-adapter, @coral-xyz/anchor, @solana/web3.js, zustand, motion)
- Implemented color math utilities (computePixelColor with HSL shade/warmth formula) and PDA derivation functions matching oracle/src/chain.ts seeds exactly — all 12 unit tests pass
- Wired SolanaWalletProvider (Phantom, Solflare, Backpack), useAnchorProgram hook, Fredoka/Nunito/JetBrains Mono fonts, and Splat brand Void theme into root layout; production build succeeds

## Task Commits

1. **Task 1: Scaffold Next.js project with all dependencies and shared library modules** - `2758d82` (feat)
2. **Task 2: Wire wallet provider, fonts, global styles, and root layout** - `4794dbd` (feat)

## Files Created/Modified

- `app/src/lib/constants.ts` - PROGRAM_ID, GRID_SIZE, timing/betting constants
- `app/src/lib/color.ts` - COLOR_NAMES, BASE_HEX, hexToHsl, hslToHex, computePixelColor
- `app/src/lib/pda.ts` - deriveConfigPDA, deriveSeasonPDA, derivePixelPDA, deriveBetPDA, deriveStatsPDA
- `app/src/lib/anchor.ts` - createAnchorProvider, createProgram helpers
- `app/src/lib/idl.json` - copied from target/idl/pixel_predict.json
- `app/src/types/game.ts` - PixelSnapshot, BetState, RoundState, GameState interfaces
- `app/src/store/gameStore.ts` - Zustand game store with all actions
- `app/src/components/providers/WalletProvider.tsx` - SolanaWalletProvider
- `app/src/hooks/useAnchorProgram.ts` - memoized Anchor Program hook
- `app/src/__tests__/color.test.ts` - 6 color math tests
- `app/src/__tests__/pda.test.ts` - 6 PDA derivation tests
- `app/vitest.config.ts` - jsdom environment, @vitejs/plugin-react, @ path alias
- `app/package.json` - test script + all dependencies
- `app/next.config.ts` - Turbopack config + transpilePackages
- `app/src/app/layout.tsx` - Fredoka/Nunito/JetBrains fonts + SolanaWalletProvider
- `app/src/app/page.tsx` - SPLAT shell with WalletMultiButton
- `app/src/app/globals.css` - brand colors, Void background, font utilities, scrollbar

## Decisions Made

- **Next.js 16 Turbopack:** Next.js 16 enables Turbopack by default. The plan specified webpack fallbacks for @solana/web3.js Node.js built-ins, but webpack config causes a hard error in Next.js 16 Turbopack mode. Replaced with `turbopack: {}` — Turbopack browser target handles Node.js exclusions automatically without explicit fallback config.
- **vitest @vitest-environment node for PDA tests:** jsdom environment does not provide the Node.js `crypto` module needed by `@solana/web3.js findProgramAddressSync`. Added `// @vitest-environment node` annotation to pda.test.ts. Color tests remain in jsdom.
- **Valid base58 public keys for PDA tests:** Test file used invalid base58 strings ("22...2"). Replaced with valid known public keys (system program, token program) for player key derivation tests.
- **Backpack via Wallet Standard:** No explicit BackpackWalletAdapter needed — Backpack is auto-discovered by the @solana/wallet-adapter-react WalletProvider via Wallet Standard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js 16 Turbopack incompatible with webpack config**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan specified `webpack` config for Node.js polyfill fallbacks. Next.js 16 defaults to Turbopack and throws a hard build error when webpack config is present without explicit `--webpack` flag.
- **Fix:** Replaced webpack config with `turbopack: {}` in next.config.ts. Turbopack's browser target automatically excludes Node.js built-ins without manual fallback configuration.
- **Files modified:** app/next.config.ts
- **Verification:** `npm run build` succeeds with zero errors
- **Committed in:** 4794dbd (Task 2 commit)

**2. [Rule 1 - Bug] jsdom lacks Node crypto for @solana/web3.js PDA tests**
- **Found during:** Task 1 (test run)
- **Issue:** vitest with jsdom environment throws "Unable to find a viable program address nonce" because jsdom does not expose Node.js `crypto.createHash` used by `@solana/web3.js findProgramAddressSync`.
- **Fix:** Added `// @vitest-environment node` annotation to pda.test.ts to run those tests in Node environment where crypto is available.
- **Files modified:** app/src/__tests__/pda.test.ts
- **Verification:** All 6 PDA tests pass
- **Committed in:** 2758d82 (Task 1 commit)

**3. [Rule 1 - Bug] Invalid base58 public key strings in PDA tests**
- **Found during:** Task 1 (test run)
- **Issue:** Test used `"22222222222222222222222222222222"` as a public key string, which is not valid base58 and throws "Invalid public key input".
- **Fix:** Replaced with valid known Solana public keys (system program `11111111111111111111111111111111` and token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`).
- **Files modified:** app/src/__tests__/pda.test.ts
- **Verification:** All 6 PDA tests pass
- **Committed in:** 2758d82 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three auto-fixes required for build and test correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

Replace `NEXT_PUBLIC_SOLANA_RPC_URL` in `app/.env.local` with a Helius devnet RPC URL for production use. The placeholder `https://api.devnet.solana.com` works for development but lacks WebSocket support needed by later plans.

## Next Phase Readiness

- All shared infrastructure exported and tested: color utilities, PDA derivation, Zustand store, Anchor hook, wallet provider
- Ready for 03-02 (canvas rendering) — `useGameStore`, `PixelSnapshot`, `computePixelColor` all available
- Ready for 03-03 (betting panel) — `useAnchorProgram`, `BetState`, wallet connection state available
- No blockers for subsequent plans

---
*Phase: 03-frontend-core*
*Completed: 2026-03-18*

## Self-Check: PASSED

All 16 key files verified present on disk.
Commits 2758d82 and 4794dbd verified in git log.
