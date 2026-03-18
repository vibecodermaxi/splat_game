---
phase: 1
slug: anchor-program
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust unit tests (`cargo test`) + TypeScript integration tests (anchor-litesvm / `anchor test`) |
| **Config file** | `Anchor.toml` + workspace `Cargo.toml` |
| **Quick run command** | `cargo test -p pixel_predict` |
| **Full suite command** | `cargo test -p pixel_predict && anchor test` |
| **Estimated runtime** | ~30 seconds (Rust) + ~60 seconds (TS integration) |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p pixel_predict`
- **After every plan wave:** Run `cargo test -p pixel_predict && anchor test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SC-01 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-02 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-03 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-04 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-05 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-06 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-07 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-08 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-09 | unit+integration | `cargo test -p pixel_predict && anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-10 | unit+integration | `cargo test -p pixel_predict && anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-11 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-12 | unit | `cargo test -p pixel_predict` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-13 | unit+integration | `cargo test -p pixel_predict && anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-14 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-15 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-16 | integration | `anchor test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-17 | integration | `anchor test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Anchor workspace initialized (`anchor init pixel_predict`)
- [ ] `Cargo.toml` with `overflow-checks = true` in `[profile.release]`
- [ ] Test setup with LiteSVM (replaces deprecated Bankrun)
- [ ] Shared test fixtures for keypairs, PDAs, and helpers

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Devnet deployment | SC-01 | Requires network access | Deploy via `anchor deploy --provider.cluster devnet` and verify program ID |

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
