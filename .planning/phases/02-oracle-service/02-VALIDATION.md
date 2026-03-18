---
phase: 2
slug: oracle-service
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest / Vitest (TypeScript) + integration tests against localnet |
| **Config file** | `oracle/jest.config.ts` or `oracle/vitest.config.ts` |
| **Quick run command** | `cd oracle && npm test` |
| **Full suite command** | `cd oracle && npm test -- --coverage` |
| **Estimated runtime** | ~30 seconds (unit) + ~60 seconds (integration with localnet) |

---

## Sampling Rate

- **After every task commit:** Run `cd oracle && npm test`
- **After every plan wave:** Run `cd oracle && npm test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ORC-01 | unit+integration | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-02 | unit+integration | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-03 | unit+integration | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-04 | unit | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-05 | integration | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-06 | unit | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-07 | unit | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-08 | integration | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-09 | unit | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-10 | integration | `cd oracle && npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORC-11 | unit | `cd oracle && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `oracle/` directory initialized with `package.json`, `tsconfig.json`
- [ ] Test framework installed (Jest or Vitest)
- [ ] Test helpers for mocking Claude API, Solana RPC, and Irys
- [ ] Shared fixtures for keypairs, PDAs, and mock responses

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway deployment | ORC-10 | Requires Railway account and network | Deploy via `railway up`, verify process stays alive |
| Telegram alerts fire | ORC-10 | Requires Telegram bot token | Trigger test alert, verify message in channel |
| Devnet round lifecycle | All | Requires funded devnet wallets | Run oracle against devnet program, observe one full round |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
