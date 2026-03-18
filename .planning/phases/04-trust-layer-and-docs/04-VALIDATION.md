---
phase: 04
slug: trust-layer-and-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x + @testing-library/react |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `cd app && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd app && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd app && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | FS-01, FS-02, FS-03 | unit+integration | `cd app && npx vitest run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | FS-09, FS-07, FS-08 | unit | `cd app && npx vitest run` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | FS-04, FS-05, FS-06 | unit | `cd app && npx vitest run` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | FS-11, FS-12, FS-13 | unit | `cd app && npx vitest run` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 3 | DOC-01..05, FS-10 | unit+snapshot | `cd app && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for My Bets drawer component and claim hooks
- [ ] Test stubs for PixelTooltip proof section expansion
- [ ] Test stubs for season completion screen and PNG generation
- [ ] Test stubs for error handling and wallet disconnect recovery
- [ ] Test stubs for docs page rendering and content

*Existing vitest + RTL infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide-up drawer gesture feel | FS-01 | Touch interaction quality | Open drawer on 375px mobile, verify smooth drag and snap |
| PNG visual quality | FS-05 | Image rendering fidelity | Generate PNG, verify fonts render correctly, colors match |
| Onboarding tooltip positioning | FS-10 | Visual layout on various screens | First visit at 375px, verify tooltips point at correct elements |
| VRF corner dot visibility | FS-07 | Visual subtlety on small canvas | Verify dot visible but not distracting on 375px grid |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
