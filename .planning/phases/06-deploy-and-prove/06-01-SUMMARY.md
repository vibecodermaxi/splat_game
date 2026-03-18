---
phase: 06-deploy-and-prove
plan: 01
subsystem: infra
tags: [railway, vercel, docker, nextjs, health-check, devnet]

# Dependency graph
requires:
  - phase: 05-wire
    provides: oracle index.ts entry point, logger module, and complete oracle service for deployment
provides:
  - Oracle HTTP health endpoint (GET /health → 200 JSON) for Railway health checks
  - oracle/Dockerfile using node:20-slim for Railway deployment
  - oracle/.dockerignore keeping image small
  - app/vercel.json with explicit Next.js framework config for Vercel root-dir deployment
  - scripts/devnet-setup.ts CLI with --season, --grid, --fund-oracle, --help flags
affects:
  - 06-deploy-and-prove plan 02 (end-to-end game loop testing)

# Tech tracking
tech-stack:
  added: [dotenv (root)]
  patterns: [Node.js built-in http for minimal health server, Docker multi-stage with npm ci --omit=dev]

key-files:
  created:
    - oracle/src/health.ts
    - oracle/Dockerfile
    - oracle/.dockerignore
    - app/vercel.json
  modified:
    - oracle/src/index.ts
    - scripts/devnet-setup.ts
    - package.json

key-decisions:
  - "Health server starts before recovery check so Railway health checks pass even during long startup recovery"
  - "Docker image copies src/ directly (not dist/) and runs tsc inside container — idl.json must exist before docker build via copy-idl.sh"
  - "Vercel env vars (NEXT_PUBLIC_SOLANA_RPC_URL, NEXT_PUBLIC_ROUND_DURATION_SECONDS) set via dashboard only, never committed"
  - "dotenv installed at root so scripts/devnet-setup.ts resolves oracle/.env without needing oracle's node_modules on PATH"

patterns-established:
  - "Health-first startup: expose health endpoint before any async initialization for zero-downtime Railway deploys"
  - "Idempotent setup scripts: skip already-initialized config/season with clear console feedback"

requirements-completed: [DEP-01, DEP-02, GAME-01]

# Metrics
duration: 12min
completed: 2026-03-18
---

# Phase 6 Plan 1: Deploy Infrastructure Summary

**Oracle Railway deployment via Dockerfile with HTTP health endpoint, Vercel Next.js config, and improved devnet-setup CLI with --season/--grid/--fund-oracle flags**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-18T20:17:08Z
- **Completed:** 2026-03-18T20:29:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-action — deploy steps for user)
- **Files modified:** 7

## Accomplishments
- Oracle HTTP health server using Node.js built-in `http` module starts immediately on startup, returning `{ status: "ok", uptime, timestamp }` at GET /health
- Dockerfile builds oracle image on node:20-slim with production-only deps (`npm ci --omit=dev`) and in-container TypeScript compilation
- Frontend builds cleanly (9 static pages generated, 0 errors) — confirms Vercel deploy will succeed
- devnet-setup.ts rewritten as a proper CLI: `--season N`, `--grid WxH`, `--fund-oracle`, `--help` with formatted summary output

## Task Commits

Each task was committed atomically:

1. **Task 1: Add health endpoint to oracle and create Dockerfile** - `4168f18` (feat)
2. **Task 2: Create Vercel config and improve devnet-setup CLI** - `3621c01` (feat)
3. **Task 3: Deploy oracle to Railway and frontend to Vercel** - checkpoint:human-action (user deploys)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `oracle/src/health.ts` - HTTP health server using Node.js built-in http; GET /health returns 200 JSON
- `oracle/src/index.ts` - Added startHealthServer() call before recovery check
- `oracle/Dockerfile` - node:20-slim image; npm ci --omit=dev; tsc build; PORT=3000 EXPOSE
- `oracle/.dockerignore` - Excludes node_modules, dist, .env, round_history.json
- `app/vercel.json` - nextjs framework, buildCommand, outputDirectory for Vercel root-dir override
- `scripts/devnet-setup.ts` - Full CLI rewrite with --season, --grid, --fund-oracle, --help; formatted summary output
- `package.json` - Added dotenv dependency for scripts/devnet-setup.ts module resolution

## Decisions Made
- Health server starts before recovery check so Railway's health probe passes even during long startup (open/locked round recovery can take minutes)
- Dockerfile runs `tsc` inside the container rather than copying pre-built dist/ — ensures clean build from source; requires `scripts/copy-idl.sh` to have been run first since idl.json is gitignored
- dotenv added to root package.json (Rule 3 auto-fix) because scripts/devnet-setup.ts cannot import from oracle/node_modules without it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed dotenv at root for devnet-setup.ts**
- **Found during:** Task 2 (verifying --help flag)
- **Issue:** `scripts/devnet-setup.ts` imports dotenv but root package.json lacked it; tsx resolved dotenv from oracle/node_modules in some contexts but not when running from root
- **Fix:** Ran `npm install dotenv --save` at root level
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx tsx scripts/devnet-setup.ts --help` outputs usage text correctly
- **Committed in:** 3621c01 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency)
**Impact on plan:** Necessary for script to be runnable from root. No scope creep.

## Issues Encountered
- devnet-setup.ts had been relying on oracle/node_modules for dotenv resolution (worked in some tsx versions); root dotenv install makes it explicit and reliable

## User Setup Required

**External services require manual configuration.** See the plan frontmatter for full setup details:
- Railway: Create project from GitHub repo (root: /oracle), add 6 env vars, set health check path to /health
- Vercel: Import project from GitHub repo (root: /app), add 2 NEXT_PUBLIC_ env vars
- Run `npx tsx scripts/devnet-setup.ts --season 1 --fund-oracle` first to initialize devnet

## Self-Check: PASSED

Files verified:
- FOUND: oracle/src/health.ts
- FOUND: oracle/Dockerfile
- FOUND: oracle/.dockerignore
- FOUND: app/vercel.json
- FOUND: scripts/devnet-setup.ts

Commits verified:
- FOUND: 3621c01 feat(06-01): add Vercel config and improve devnet-setup CLI
- FOUND: 4168f18 feat(06-01): add health endpoint to oracle and create Dockerfile

## Next Phase Readiness
- Oracle is deployable to Railway via Dockerfile — user needs to push to GitHub and connect Railway
- Frontend is deployable to Vercel — user needs to import project and add env vars
- devnet-setup CLI is ready for season initialization
- Once deployed, Plan 02 (end-to-end game loop testing) can begin

---
*Phase: 06-deploy-and-prove*
*Completed: 2026-03-18*
