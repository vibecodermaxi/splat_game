# Roadmap: Pixel Predict

## Milestones

- ✅ **v1.0 Pixel Predict MVP** — Phases 1-4 (shipped 2026-03-18)
- 🚧 **v1.1 Playable Devnet** — Phases 5-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 Pixel Predict MVP (Phases 1-4) — SHIPPED 2026-03-18</summary>

- [x] Phase 1: Anchor Program (6/6 plans) — completed 2026-03-17
- [x] Phase 2: Oracle Service (6/6 plans) — completed 2026-03-17
- [x] Phase 3: Frontend Core (4/4 plans) — completed 2026-03-18
- [x] Phase 4: Trust Layer and Docs (5/5 plans) — completed 2026-03-18

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Playable Devnet (In Progress)

**Milestone Goal:** Wire the three v1.0 subsystems together and deploy to devnet so a player can play a complete game end-to-end — place bets, watch the AI resolve rounds, claim winnings, and see a season progress.

## Phase Details

### Phase 5: Wire
**Goal**: All three subsystems share the same IDL and environment configuration, and every frontend hook submits real transactions and receives real data from devnet
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, DEP-03
**Success Criteria** (what must be TRUE):
  1. Running `anchor build` and the copy script propagates a single IDL file to both the frontend and oracle with no manual steps
  2. Every subsystem (program, oracle, frontend) reads RPC URL, program ID, and round timing from environment variables — no hardcoded values remain
  3. A wallet-connected player can submit a `place_bet` transaction from the UI and confirm the BetAccount exists on devnet via Solana Explorer
  4. A player whose bet won can submit a `claim_winnings` transaction from the UI and see SOL arrive in their wallet
  5. The canvas and betting panel update live on-screen when a PixelState or SeasonState account changes on devnet
**Plans:** 2 plans
Plans:
- [ ] 05-01-PLAN.md — IDL copy script and centralized env var config for oracle
- [ ] 05-02-PLAN.md — Frontend env-driven constants and hardcoded value removal

### Phase 6: Deploy and Prove
**Goal**: Oracle is live on Railway, frontend is live on Vercel, a season is running on devnet, and a smoke test confirms the full bet-to-claim cycle works end-to-end
**Depends on**: Phase 5
**Requirements**: DEP-01, DEP-02, GAME-01, GAME-02, GAME-03, GAME-04
**Success Criteria** (what must be TRUE):
  1. The oracle is reachable at a Railway URL, its health check endpoint returns 200, and it opens rounds on its cron schedule
  2. The frontend is reachable at a Vercel URL with no build errors and correctly points to devnet RPC and program ID
  3. An admin can run a single CLI command to initialize a new season and see the oracle begin opening pixel rounds
  4. A player visiting the Vercel URL can connect a wallet, place a bet, watch the countdown, see the AI pick a color, and find the result in My Bets — all in one session
  5. The smoke test script runs to completion, prints "PASS", and the terminal shows a claimed SOL balance
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Anchor Program | v1.0 | 6/6 | Complete | 2026-03-17 |
| 2. Oracle Service | v1.0 | 6/6 | Complete | 2026-03-17 |
| 3. Frontend Core | v1.0 | 4/4 | Complete | 2026-03-18 |
| 4. Trust Layer and Docs | v1.0 | 5/5 | Complete | 2026-03-18 |
| 5. Wire | v1.1 | 0/2 | In progress | - |
| 6. Deploy and Prove | v1.1 | 0/TBD | Not started | - |
