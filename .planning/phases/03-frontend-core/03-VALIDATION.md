---
phase: 3
slug: frontend-core
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js build (`next build`) + TypeScript check (`tsc --noEmit`) + Vitest for unit tests |
| **Config file** | `app/next.config.ts` + `app/tsconfig.json` + `app/vitest.config.ts` |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && npm run test -- --run && npx tsc --noEmit && npx next build` |
| **Estimated runtime** | ~10 seconds (vitest) + ~15 seconds (tsc) + ~30 seconds (next build) |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npm run test -- --run`
- **After every plan wave:** Run `cd app && npm run test -- --run && npx tsc --noEmit && npx next build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 55 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 03-01-T1 | 03-01 | 1 | FE-01, FE-15 | unit | `cd app && npm run test -- --run 2>&1 \| tail -20` | pending |
| 03-01-T2 | 03-01 | 1 | FE-01, FE-15 | build | `cd app && npm run build 2>&1 \| tail -20` | pending |
| 03-02-T1 | 03-02 | 2 | FE-02, FE-03, FE-16 | unit | `cd app && npm run test -- --run 2>&1 \| tail -20` | pending |
| 03-02-T2 | 03-02 | 2 | FE-12, FE-13 | unit | `cd app && npm run test -- --run 2>&1 \| tail -20` | pending |
| 03-03-T1 | 03-03 | 2 | FE-07, FE-11 | unit+tdd | `cd app && npm run test -- --run 2>&1 \| tail -20` | pending |
| 03-03-T2 | 03-03 | 2 | FE-04, FE-05, FE-06, FE-08, FE-09, FE-14 | unit | `cd app && npm run test -- --run 2>&1 \| tail -20` | pending |
| 03-04-T1 | 03-04 | 3 | FE-10 | unit | `cd app && npm run test -- --run 2>&1 \| tail -20` | pending |
| 03-04-T2 | 03-04 | 3 | FE-14, FE-15 | build | `cd app && npm run build 2>&1 \| tail -20` | pending |
| 03-04-T3 | 03-04 | 3 | FE-10, FE-14, FE-15 | manual | Human visual verification | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Next.js app scaffolded in `app/` directory (03-01-T1)
- [ ] Tailwind CSS configured (03-01-T1)
- [ ] Fredoka One + Nunito fonts loaded via next/font (03-01-T2)
- [ ] Wallet adapter provider wired in layout (03-01-T2)
- [ ] Vitest configured with jsdom environment (03-01-T1)
- [ ] TypeScript compiles cleanly (03-01-T2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Plan Task |
|----------|-------------|------------|-------------------|-----------|
| Mobile layout at 375px | FE-14 | Requires visual inspection | Open Chrome DevTools, set viewport to 375px, verify tap targets and layout | 03-04-T3 |
| Animation quality | FE-10 | Subjective visual quality | Trigger resolution, verify radial burst and confetti feel satisfying | 03-04-T3 |
| Wallet connect flow | FE-01 | Requires wallet extension | Install Phantom, click connect, verify wallet modal appears | 03-04-T3 |
| Place Bet button uses selected color | FE-05 | Visual confirmation | Select a color swatch, verify button background matches that color | 03-04-T3 |
| Panel red tint during lockout | FE-08 | Visual confirmation | During lockout (final 2 min), verify panel has subtle red/pink tint | 03-04-T3 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
