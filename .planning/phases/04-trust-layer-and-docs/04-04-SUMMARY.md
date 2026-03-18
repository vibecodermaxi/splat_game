---
phase: 04-trust-layer-and-docs
plan: "04"
subsystem: ui
tags: [next.js, react, docs, testing-library, vitest]

# Dependency graph
requires:
  - phase: 03-frontend-core
    provides: Brand tokens (CSS variables), root layout with font variables, established inline-style patterns

provides:
  - DocsLayout component with fixed header, back-to-game arrow, page title, FAQ icon, and bottom nav with active-page highlight
  - ExpandableSection component with CSS max-height transition and rotating chevron
  - /how-it-works page — casual game loop explanation
  - /ai-artist page — AI inputs, isolation from bets, determinism, prompt commitment proof
  - /rules page — bet limits, one-color rule, clock, rake, zero-winner, claiming
  - /fairness page — casual 3-sentence explanation + 3 expandable nerdy/VRF/verify sections
  - /faq page — 7-item accordion with wallet, claiming, zero-winner, early bets, season, jackpot, fairness
  - DocsPages.test.tsx — 9 tests covering all 5 pages and ExpandableSection toggle behavior

affects: [04-05, any future in-app help or onboarding work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DocsLayout wraps all docs pages with shared header/nav — single source of truth for docs chrome
    - ExpandableSection uses CSS max-height transition (0 to 1000px) for collapse/expand — no JS measurement needed
    - Docs pages use inline styles with CSS variable references consistent with Phase 3 patterns
    - next/navigation usePathname used for active nav highlighting in shared layout

key-files:
  created:
    - app/src/components/docs/DocsLayout.tsx
    - app/src/components/docs/ExpandableSection.tsx
    - app/src/app/how-it-works/page.tsx
    - app/src/app/ai-artist/page.tsx
    - app/src/app/rules/page.tsx
    - app/src/app/fairness/page.tsx
    - app/src/app/faq/page.tsx
    - app/src/__tests__/DocsPages.test.tsx
  modified: []

key-decisions:
  - "All fairness copy uses 'prompt commitment proof' language — never 'reproducible result' (per user decision: AI output is deterministic but users cannot run Claude themselves, so commitment framing is more honest)"
  - "Fairness page layered depth: casual 3-sentence always visible, nerdy SHA-256/Arweave details behind ExpandableSection"
  - "FAQ uses ExpandableSection as accordion — all items start closed, consistent with ExpandableSection defaultOpen=false"
  - "DocsLayout uses usePathname() for active nav highlight — avoids prop drilling current page through all pages"

patterns-established:
  - "DocsLayout pattern: all docs pages wrap content in <DocsLayout title='...'> — shared chrome without duplication"
  - "ExpandableSection pattern: collapsible content via CSS max-height — reusable for any expandable detail"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05]

# Metrics
duration: 32min
completed: 2026-03-18
---

# Phase 04 Plan 04: Trust Layer Docs Summary

**Five in-app docs pages (how-it-works, ai-artist, rules, fairness, faq) with DocsLayout shell, ExpandableSection accordion, casual gamer tone, and prompt commitment proof language throughout**

## Performance

- **Duration:** 32 min
- **Started:** 2026-03-18T11:54:09Z
- **Completed:** 2026-03-18T12:26:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Built DocsLayout with fixed 56px header (back arrow, title, FAQ icon) and bottom nav with active-page highlight via usePathname
- Built ExpandableSection with CSS max-height 0-to-1000px transition and rotating chevron — no JS measurement, SSR-safe
- All five docs pages render with casual gamer tone: short sentences, game metaphors, no whitepaper language
- Fairness page uses layered depth — casual 3-sentence explanation always visible, SHA-256/Arweave/VRF/verify details behind expandable sections
- FAQ uses ExpandableSection as accordion — 7 questions covering wallet, claiming, zero-winner, early bets, season length, jackpot, fairness
- 9 tests pass covering all pages and ExpandableSection toggle behavior; 71 total tests pass; production build generates all 5 routes as static pages

## Task Commits

Each task was committed atomically:

1. **Task 1: DocsLayout, ExpandableSection, How It Works, AI Artist** - `2890ef8` (feat)
2. **Task 2: Rules, Fairness, FAQ pages and DocsPages tests** - `ddb3e86` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/src/components/docs/DocsLayout.tsx` — Shared docs shell: fixed header with back arrow, page title, FAQ link, and bottom nav with usePathname active highlight
- `app/src/components/docs/ExpandableSection.tsx` — Collapsible section component: CSS max-height transition, rotating chevron, aria-expanded attribute
- `app/src/app/how-it-works/page.tsx` — Game loop explanation: The Game, The Loop, The Canvas, The Odds
- `app/src/app/ai-artist/page.tsx` — AI artist explanation: What It Sees, What It Doesn't See, How It Picks, The Commitment (prompt commitment proof)
- `app/src/app/rules/page.tsx` — Betting rules: limits, one-color rule, clock, rake breakdown, zero-winner, claiming
- `app/src/app/fairness/page.tsx` — Fairness page: casual 3-sentence intro + The Nerdy Version + VRF Fallback + How to Verify expandable sections
- `app/src/app/faq/page.tsx` — FAQ accordion: 7 questions all starting closed
- `app/src/__tests__/DocsPages.test.tsx` — 9 tests: 5 page render tests + 4 ExpandableSection toggle behavior tests

## Decisions Made

None beyond what was specified in the plan — followed all user decisions (prompt commitment proof language, layered depth on fairness, FAQ accordion pattern).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 docs pages ready for navigation from the [?] header button
- DocsLayout and ExpandableSection are reusable for any future in-app help content (onboarding tour, phase 4 plan 5+ features)
- 71 tests passing, TypeScript clean, production build succeeds

## Self-Check: PASSED

All 8 created files verified on disk. Both task commits (2890ef8, ddb3e86) verified in git log.

---
*Phase: 04-trust-layer-and-docs*
*Completed: 2026-03-18*
