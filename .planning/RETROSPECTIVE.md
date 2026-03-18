# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Pixel Predict MVP

**Shipped:** 2026-03-18
**Phases:** 4 | **Plans:** 21

### What Was Built
- Full Anchor program with parimutuel math, commit-reveal, VRF fallback, and season lifecycle
- Oracle service with Claude API, Arweave archival, cron scheduling, and failure cascade
- Mobile-first game UI with live canvas, betting panel, countdown, resolution animations
- Trust layer with commit-reveal proof display, My Bets drawer, season completion, branded PNG share
- 5 in-app docs pages with casual gamer tone and onboarding tour

### What Worked
- Wave-based parallel execution in Phases 3 and 4 — 4 agents building independent feature clusters simultaneously
- Strict phase dependency chain (Anchor → Oracle → Frontend → Trust) kept integration clean
- Discussion-before-planning captured font preferences, drawer UX, proof display decisions that would have needed rework otherwise
- Verifier agent caught real gaps (orphaned useHeliusSocket, missing FS-12 retry button) before they shipped

### What Was Inefficient
- Hardcoded font-family inline styles in Phase 3 components required manual cleanup across 8 files during font experimentation
- Circular CSS variable self-reference in :root block (`--font-display: var(--font-display)`) silently broke font loading
- Phase 3 ROADMAP.md checkbox not marked complete by tooling (showed `[ ]` while disk showed complete)

### Patterns Established
- CSS variables for all font references — never hardcode font-family inline
- No `:root` block shadowing Next.js font variables — let `next/font` inject directly
- Sequential claim transactions for shared PDA writes (not Promise.all)
- "Prompt commitment proof" language standard for all fairness copy
- Luckiest Guy + Nunito + JetBrains Mono font stack

### Key Lessons
1. Always use CSS variables for theming properties (fonts, colors) — inline hardcoding creates maintenance debt that compounds during design iteration
2. Verifier agents are worth the context cost — they caught 2 real bugs that would have shipped to users
3. Font experimentation is best done before any component implementation, not after — changing fonts touched every component file

### Cost Observations
- Model mix: orchestration on Opus, execution on Sonnet, verification on Sonnet
- 4 parallel agents per wave kept wall-clock time low despite 21 total plans
- Research agents added ~5 minutes per phase but prevented implementation rework

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 4 |
| Plans | 21 |
| LOC | ~13K |
| Timeline | 2 days |
| Verification gaps found | 3 |
| Gaps fixed before ship | 3 |
