# Stack Research

**Domain:** Solana prediction market game with AI oracle and real-time Next.js frontend
**Researched:** 2026-03-16
**Confidence:** HIGH (all major choices verified against official docs, npm registry, or official announcements)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Anchor (Rust CLI) | 0.32.1 | Solana program framework | De-facto standard for Solana smart contracts. Provides IDL generation, type-safe TypeScript client, and account validation macros. 0.32.x is the latest stable; v1.0 not yet released. Use AVM to manage versions. |
| @coral-xyz/anchor | 0.32.1 | TypeScript client for Anchor programs | Must pin to same major/minor as the Rust CLI or deserialization breaks. Provides `Program`, `AnchorProvider`, and typed account fetching. |
| Next.js | 16.1.6 | Frontend framework | Released Oct 2025 (stable). Turbopack is now the default bundler (2–5x faster builds). React 19.2, React Compiler stable, and Cache Components. Requires Node 20.9+. Creates new App Router projects by default. |
| React | 19.2 | UI runtime | Bundled with Next.js 16. View Transitions and `useEffectEvent` are available. React Compiler eliminates manual memo calls. |
| TypeScript | 5.x | Type safety across all layers | Required minimum for Next.js 16. The Anchor IDL generates `.ts` types directly — TypeScript is not optional in this stack. |
| @solana/kit | 3.0.3 | Solana JS SDK (tree-shakeable) | The rename/successor to `@solana/web3.js` v2. Zero external dependencies, full tree-shaking, modern TypeScript. `helius-sdk` 2.x depends on it. Do not mix with `@solana/web3.js` v1 in the same package. |
| @anthropic-ai/sdk | 0.78.0 | Claude API client (oracle process) | Official Anthropic SDK. Used exclusively in the oracle service (Railway) — not in frontend code. Supports streaming, automatic retries, and typed responses. Temperature 0 is a single config flag. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @solana/react-hooks | 1.1.0 | Wallet connection and signing hooks | Solana's official modern React hooks layer, built on `@solana/kit`. Use in the App Router frontend instead of the older `@solana/wallet-adapter-react`. Provides `useConnectWallet`, `useDisconnectWallet`, auto-discovers Wallet Standard wallets (Phantom, Solflare, Backpack) without explicit configuration. |
| @solana/client | 1.1.0 | RPC connection management | Companion to `@solana/react-hooks`. Wraps connection/cluster config in a provider. Pin to same version as `@solana/react-hooks`. |
| helius-sdk | 2.2.2 | Helius RPC + enhanced APIs + WebSocket | Wraps Helius enhanced APIs and the `@solana/kit` WebSocket subscription methods (logsNotifications, signatureNotifications, slotNotifications). v2.0+ rewrote internals to use `@solana/kit` — install the new SDK, not the legacy 1.x branch. |
| Tailwind CSS | 4.x | Utility CSS | Released stable Jan 2025. CSS-first config (no `tailwind.config.js` needed). Up to 100x faster incremental builds. Required for mobile-first, dark-mode game aesthetic. |
| Zustand | 5.0.12 | Client-side game state | Manages round state, canvas pixels, betting panel UI, and countdown without prop drilling. No providers required. 20M weekly downloads — mature and stable. Use selectors to prevent unnecessary re-renders on 30-second pool refreshes. |
| @tanstack/react-query | 5.90.21 | Server/on-chain data fetching | Handles polling fallback when WebSocket drops. Use `refetchInterval` for 60-second pool update cadence. Combines with Zustand: React Query owns server state, Zustand owns UI state. |
| motion | 12.x (pkg: `motion`) | Animation library | Formerly Framer Motion. Use `import { motion } from 'motion/react'` in App Router (requires `'use client'` directive). Powers resolution animations, celebration effects, and micro-animations. New projects should use the `motion` package, not `framer-motion`. |
| node-cron | 3.x | Oracle scheduling (Railway service) | Railway's native cron runs the entire service restart every N minutes (minimum 5-min interval). For 30-minute round cycles, use Railway's built-in cron scheduler rather than `node-cron`. For sub-5-minute logic (retry backoff, 2-minute lockout checks), use `node-cron` inside the always-on service. |
| dotenv | 16.x | Environment variable management | Oracle service needs `HELIUS_API_KEY`, `ANTHROPIC_API_KEY`, and `PROGRAM_ID` at runtime. Railway injects these as env vars; `dotenv` is the standard loader for local development. |
| html2canvas / dom-to-image-more | latest | Season completion PNG export | Powers the "share as PNG" season completion screen. `dom-to-image-more` is the maintained fork of `dom-to-image` with React 19 compatibility. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Anchor CLI (AVM) | Rust program build, test, deploy | Install via AVM: `avm install 0.32.1 && avm use 0.32.1`. Keeps CLI in sync with `@coral-xyz/anchor` npm version. |
| Solana CLI | Keypair management, program deploy, balance checks | Installed alongside Anchor per official docs. Required for `anchor deploy`. |
| Rust toolchain (stable + `sbf` target) | Compiles Anchor programs to SBF bytecode | Use `rustup` to install. Anchor 0.32 requires a recent stable Rust. |
| ESLint (Flat Config) | Linting | Next.js 16 defaults to ESLint Flat Config (ESLint v10 compatible). The `next lint` command was removed; run ESLint directly. |
| Biome (optional alternative) | Fast lint + format | Mentioned in Next.js 16 docs as the preferred alternative to the removed `next lint`. Consider if ESLint config complexity grows. |
| Vitest | Unit testing for oracle and frontend logic | Works with TypeScript without babel. Test parimutuel math, commitment hash generation, and round lifecycle logic without spinning up a validator. |
| `@solana/test-validator` / `solana-test-validator` | Local Solana validator for integration tests | Run Anchor integration tests against a local validator before devnet. |

---

## Installation

```bash
# Frontend (Next.js 16 + Solana + UI)
npm install next@latest react@latest react-dom@latest
npm install @solana/kit @solana/client @solana/react-hooks
npm install @coral-xyz/anchor
npm install helius-sdk
npm install zustand @tanstack/react-query
npm install motion
npm install dom-to-image-more

# Dev dependencies (frontend)
npm install -D typescript @types/node @types/react @types/react-dom
npm install -D tailwindcss @tailwindcss/vite

# Oracle service (Node.js on Railway)
npm install @anthropic-ai/sdk
npm install @solana/kit @coral-xyz/anchor
npm install helius-sdk
npm install node-cron dotenv
npm install -D typescript @types/node ts-node

# Solana toolchain (system-level, not npm)
# Install AVM: cargo install --git https://github.com/coral-xyz/avm avm --force
# avm install 0.32.1 && avm use 0.32.1
# rustup component add rust-src
# solana-install init 2.x
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@solana/react-hooks` + `@solana/client` | `@solana/wallet-adapter-react` 0.15.x | Only if already on a 1.x-era codebase that mixes `@solana/web3.js` v1. For greenfield projects, the new hooks layer is the canonical path per official Solana docs. |
| `helius-sdk` 2.x | Raw WebSocket (`wss://atlas-mainnet.helius-rpc.com`) | Use raw WebSocket only if you need granular control over reconnect logic. The SDK handles reconnections, auth headers, and integrates with `@solana/kit`. |
| `motion` | `react-spring` / GSAP | If you need scroll-driven animations (GSAP ScrollTrigger) or physics at 60fps outside React's render cycle. For this project's celebration effects and resolution animations, `motion` is sufficient. |
| Railway cron (native) + `node-cron` for intra-round | `bull` / `BullMQ` job queue | BullMQ is warranted if parallel processing or job persistence is needed. The oracle is a single stateless process with no parallelism — a cron + simple retry loop is sufficient and avoids Redis dependency cost. |
| Zustand + TanStack Query | Redux Toolkit + RTK Query | Redux is over-engineered for this scope. Zustand handles the canvas/betting UI state; TanStack Query handles on-chain reads with polling fallback. The two libraries complement each other cleanly. |
| `@coral-xyz/anchor` TypeScript client | `@solana/kit` raw RPC calls | Raw Kit calls work for simple transfers but lose the typed account deserialization and discriminator checks that `@coral-xyz/anchor` provides. Keep Anchor client for all program interactions. |
| Pyth Entropy (VRF fallback) | Switchboard VRF | Both are viable. Pyth Entropy uses a commit-reveal protocol that is conceptually aligned with the oracle's own commit-reveal design. ORAO VRF is a lighter alternative. The specific Anchor CPI integration matters more than the provider choice — validate CPI compatibility with Anchor 0.32 before committing. |
| Vitest | Jest | Vitest runs in ESM natively and requires zero Babel config for TypeScript. Jest requires additional transform configuration for both ESM and TypeScript in 2025. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@solana/web3.js` v1 (1.x) | No longer actively developed. Not tree-shakeable. Mixing v1 with `@solana/kit` (formerly v2) causes bundle conflicts and type errors. `helius-sdk` 2.x requires `@solana/kit`. | `@solana/kit` 3.x |
| `@solana/wallet-adapter-react` (new projects) | The older adapter requires explicit wallet list configuration (`[new PhantomWalletAdapter()]`). The new `@solana/react-hooks` auto-discovers all Wallet Standard wallets (Phantom, Solflare, Backpack) with zero config. | `@solana/react-hooks` 1.1.0 |
| `framer-motion` package name (new projects) | Still works but `motion` is the renamed canonical package. New APIs (e.g., `motion/react`) are cleaner. | `motion` (pkg) |
| `create-react-app` | Unmaintained, webpack 4, no App Router support. | `create-next-app@latest` |
| In-process scheduler (node-cron only, no Railway cron) | Keeping the Node process alive 24/7 just for a 30-min timer is wasteful on Railway's billing. Railway's native cron starts/stops the container. | Railway native cron for 30-min trigger; `node-cron` inside for sub-5-min retry logic |
| Prisma / PostgreSQL (for oracle) | The oracle is intentionally stateless — a `round_history.json` file for 5-round context is the spec. Adding a DB introduces infra complexity and cost for no gain. | Local `round_history.json` file read/written on each execution |
| `@project-serum/anchor` | Old package name, unmaintained. The project moved to `@coral-xyz/anchor`. | `@coral-xyz/anchor` |
| Pages Router | App Router is the default in Next.js 16. Pages Router is on a maintenance path. Server Components simplify RPC data-fetching for non-real-time views (e.g., How to Play page). | App Router (`app/` directory) |
| webpack (default) in Next.js 16 | Turbopack is now the default in Next.js 16 and provides 2–5x faster builds. Webpack is available via `--webpack` flag but should only be needed if you have a custom webpack plugin with no Turbopack equivalent. | Turbopack (default in Next.js 16) |

---

## Stack Patterns by Variant

**For the frontend (Vercel, App Router):**
- Use Server Components for static/infrequent pages (How to Play, Docs pages)
- Use `'use client'` components with Zustand + TanStack Query for the live betting panel, canvas, and countdown timer
- Wallet context (SolanaProvider) must live in a Client Component boundary — wrap in `app/providers.tsx` with `'use client'`, import in `app/layout.tsx`
- Helius WebSocket subscriptions belong in a Client Component, not a Server Component

**For the oracle service (Railway):**
- Run as an always-on Node.js service (not a Railway cron service), because the 30-minute round cycle requires precise timing and a 2-minute lockout phase that Railway's 5-minute minimum cron interval cannot handle internally
- Use Railway environment variables for `ANTHROPIC_API_KEY`, `HELIUS_RPC_URL`, `ORACLE_KEYPAIR` (base58), `PROGRAM_ID`
- The `ORACLE_KEYPAIR` should be a dedicated hot wallet with minimal SOL — not the upgrade authority keypair
- `round_history.json` should be written to `/tmp` or a Railway persistent volume; treat it as ephemeral, not a source of truth

**For VRF fallback integration:**
- The fallback is invoked only when Claude API fails after retries
- Design the Anchor instruction to accept either an oracle signature OR a VRF proof — validated differently but resolving identically
- Do not implement VRF fallback in the first milestone; stub the interface so it can be added without program redeployment

**For mobile-first rendering:**
- Tailwind v4's CSS cascade layers enable granular dark-mode theming without `darkMode: 'class'` config
- The 10x10 canvas should use CSS Grid with `aspect-ratio: 1` — do not use Canvas API for the betting grid (Canvas requires extra hit-testing code; CSS Grid handles tap targets natively)
- Canvas API is only needed for the PNG export feature (season completion screen)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@coral-xyz/anchor@0.32.1` | `anchor-cli@0.32.1` | Must match major.minor exactly or IDL serialization silently diverges. Pin both. |
| `@solana/react-hooks@1.1.0` | `@solana/client@1.1.0`, `@solana/kit@5.0.0` | Official tested set per Solana docs. Note: `@solana/kit` npm v3.0.3 is the SDK package; `@solana/kit@5.0.0` in the tested set refers to the older monorepo release — verify the exact version from Solana's official nextjs-solana doc before pinning. |
| `helius-sdk@2.2.2` | `@solana/kit@3.x` | helius-sdk 2.x rewrote internals to use `@solana/kit`. Do not mix helius-sdk 2.x with `@solana/web3.js` v1. |
| `next@16.x` | `node@20.9+` | Next.js 16 drops Node 18 support. Railway and Vercel both support Node 20 LTS. Verify runtime settings in both dashboards. |
| `@coral-xyz/anchor@0.32.1` | webpack (polyfills required) | Anchor's TypeScript client uses Node.js native modules. For Next.js (Turbopack), test that `crypto` and `buffer` globals are available. If Turbopack throws on Anchor imports, add `resolve.fallback` or use dynamic imports to keep Anchor code out of the SSR bundle. |
| `motion@12.x` | `react@19.x` | Tested and confirmed. React 19's Compiler can auto-memoize motion components. |
| `zustand@5.x` | `react@19.x` | v5 was explicitly released for React 18/19 concurrent rendering compatibility. |

---

## Sources

- [Anchor Releases — GitHub](https://github.com/solana-foundation/anchor/releases) — confirmed 0.32.1 as latest stable
- [anchor-lang.com TypeScript Client docs](https://www.anchor-lang.com/docs/clients/typescript) — IDL generation and `@coral-xyz/anchor` usage
- [Solana Next.js Integration Guide](https://solana.com/docs/frontend/nextjs-solana) — `@solana/react-hooks`, `@solana/client`, `@solana/kit` 1.1.0/5.0.0 tested set; MEDIUM confidence on exact kit version (two version numbers in circulation — verify before pinning)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) — release date, Turbopack stable, React 19.2, Node 20.9+ requirement, middleware→proxy.ts rename
- [Helius SDK GitHub](https://github.com/helius-labs/helius-sdk) — v2.2.2 published; v2 rewrote to use `@solana/kit`
- [Helius WebSocket Docs](https://www.helius.dev/docs/rpc/websocket) — subscription method names confirmed
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — 0.78.0 latest, supports claude-sonnet-4-x models
- [Tailwind CSS v4 Blog](https://tailwindcss.com/blog/tailwindcss-v4) — stable Jan 2025, CSS-first config
- [Zustand GitHub Releases](https://github.com/pmndrs/zustand/releases) — 5.0.12 latest
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) — 5.90.21 latest
- [motion.dev](https://motion.dev/) — Motion (formerly Framer Motion) 12.x, confirmed React 19 support
- [Railway Cron Docs](https://docs.railway.com/cron-jobs) — 5-minute minimum, UTC-based, container start/stop per execution
- [@solana/kit GitHub (anza-xyz)](https://github.com/anza-xyz/kit) — 3.0.3 latest on npm
- [Pyth Entropy Docs](https://docs.pyth.network/entropy) — commit-reveal VRF fallback option
- [ORAO Solana VRF](https://github.com/orao-network/solana-vrf) — alternative VRF at 0.001 SOL/request
- [@coral-xyz/anchor npm](https://www.npmjs.com/package/@coral-xyz/anchor) — 0.32.1 confirmed

---

*Stack research for: Pixel Predict — Solana prediction market game with AI oracle*
*Researched: 2026-03-16*
