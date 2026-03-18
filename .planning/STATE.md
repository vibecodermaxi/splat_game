---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Playable Devnet
status: planning
stopped_at: Completed 05-wire-01-PLAN.md
last_updated: "2026-03-18T20:05:50.750Z"
last_activity: 2026-03-19 — v1.1 roadmap created; 13 requirements mapped to 2 phases
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Players can place real-money bets on AI color choices with immediate, verifiable, on-chain resolution
**Current focus:** Phase 5 — Wire (v1.1 start)

## Current Position

Milestone: v1.1 Playable Devnet
Phase: 5 of 6 (Wire)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-19 — v1.1 roadmap created; 13 requirements mapped to 2 phases

Progress: [████████░░] 67% (4/6 phases complete — v1.0 shipped)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 21
- Average duration: ~15 min
- Total execution time: ~5.25 hours

**By Phase:**

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 1. Anchor Program | 6 | ~15 min |
| 2. Oracle Service | 6 | ~15 min |
| 3. Frontend Core | 4 | ~15 min |
| 4. Trust Layer and Docs | 5 | ~15 min |
| 5. Wire | TBD | — |
| 6. Deploy and Prove | TBD | — |

**Recent Trend:** Stable (v1.0 baseline)

*Updated after each plan completion*
| Phase 05-wire P02 | 2 | 2 tasks | 3 files |
| Phase 05-wire P01 | 4 | 2 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.0 Phase 2]: Program<anchor.Idl> used instead of Program<PixelPredict> — PixelPredict type outside oracle/src/ rootDir causes TS6059
- [v1.0 Phase 1]: lock_round and open_round use instruction args for PDA seeds to avoid Anchor 0.32 self-referential PDA validation failure
- [v1.0 Phase 4]: claimAll uses sequential for...of (not Promise.all) — all claims write same PlayerSeasonStats PDA
- [v1.0 Phase 3]: useAnchorWallet (not useWallet) required for Anchor Program instantiation
- [v1.1]: Anchor program already deployed at FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG — no redeploy needed for devnet
- [Phase 05-wire]: LOCKOUT_SECONDS stays hardcoded at 120 — protocol constant not a deployment config
- [Phase 05-wire]: useSeasonData reads initialSeasonNumber as param not from store — store starts at 0 before hook runs, creating circular initialization
- [Phase 05-wire]: IDL loaded via static import (import idl from './idl.json') — fails at compile time if missing
- [Phase 05-wire]: oracle/src/idl.json gitignored — must run scripts/copy-idl.sh after anchor build
- [Phase 05-wire]: ROUND_DURATION_MINUTES not in required[] array — has safe default of 30

### Pending Todos

None yet.

### Blockers/Concerns

- Oracle wallet must be funded with devnet SOL before Phase 6 can run rounds
- VRF (Switchboard On-Demand v3) requires oracle wallet to have SOL for request fees

## Session Continuity

Last session: 2026-03-18T20:00:49.700Z
Stopped at: Completed 05-wire-01-PLAN.md
Resume file: None
