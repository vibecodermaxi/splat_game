---
phase: 02-oracle-service
plan: 03
subsystem: oracle
tags: [node, typescript, prompt-construction, claude-api, sha256, tdd, commit-reveal]

# Dependency graph
requires:
  - phase: 02-oracle-service
    provides: oracle/src/types.ts with PixelData, RoundHistoryEntry, ClaudeResult, COLOR_NAMES; oracle/config/system-prompt.txt template
  - phase: 02-oracle-service
    provides: oracle/ project scaffolded with all dependencies (anthropic SDK, mocha/chai test stack)

provides:
  - oracle/src/prompt.ts: buildSystemPrompt, buildUserMessage, buildFullPrompt, hashPrompt functions
  - oracle/src/claude.ts: parseClaudeResponse, validateClaudeResult, callClaude functions
  - oracle/src/__tests__/prompt.test.ts: 11 unit tests for prompt construction
  - oracle/src/__tests__/claude.test.ts: 14 unit tests for Claude response parsing and validation
  - SHA-256 prompt hashing for on-chain commit-reveal verifiability
  - Claude API integration at temperature 0 with structured response validation

affects: [02-oracle-service plans 04+, lifecycle manager, Arweave upload]

# Tech tracking
tech-stack:
  added:
    - "node:crypto (createHash — built-in, no new dependency)"
  patterns:
    - "Prompt construction: template loaded from config/system-prompt.txt via fs.readFileSync with module-level cache (one disk read per process lifetime)"
    - "Prompt hashing: SHA-256 over UTF-8 Buffer of full concatenated prompt — hash is deterministic for same inputs"
    - "Claude response parsing: line-by-line regex matching (/^FIELD:\s*(.+)$/m) handles preamble text, avoids positional assumptions"
    - "Validation pipeline: parseClaudeResponse returns null on any failure; validateClaudeResult checks numeric ranges; callClaude throws with raw response text on failure"

key-files:
  created:
    - oracle/src/prompt.ts
    - oracle/src/claude.ts
    - oracle/src/__tests__/prompt.test.ts
    - oracle/src/__tests__/claude.test.ts

key-decisions:
  - "Template path is ../config/system-prompt.txt relative to oracle/src/ (not ../../config/) — __dirname in prompt.ts is oracle/src/, one level up reaches oracle/ where config/ lives"

patterns-established:
  - "Prompt module pattern: buildSystemPrompt + buildUserMessage + buildFullPrompt + hashPrompt — four pure functions with no side effects except template file read"
  - "Neighbor detection: 8-direction adjacency check using coordinate map for O(1) lookup per neighbor"
  - "Claude parse pipeline: returns null (not throws) for all parse failures — callClaude is the one that throws with context"

requirements-completed: [ORC-01, ORC-03, ORC-04, ORC-11]

# Metrics
duration: 12min
completed: 2026-03-17
---

# Phase 2 Plan 3: Prompt Construction and Claude API Client Summary

**SHA-256-hashed prompt construction from canvas state + season style summary, and a Claude API client parsing structured COLOR/SHADE/WARMTH/REASONING responses at temperature 0 with full input validation**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-17T18:05:00Z
- **Completed:** 2026-03-17T18:17:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 4 created

## Accomplishments
- Built `prompt.ts` with SPEC-compliant prompt construction: canvas state, current pixel, 8-direction neighbors, last-5 history, SHA-256 hashing
- Built `claude.ts` with line-by-line regex parsing, range validation, and `callClaude` at temperature 0 using claude-sonnet-4-6
- 25 total unit tests pass across both test files; `tsc --noEmit` exits clean
- Season style summary injection (ORC-11) verified: non-empty value replaces `{season_style_summary}` placeholder in system prompt

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for prompt construction** - `67c0b03` (test)
2. **Task 1 GREEN: prompt.ts implementation** - `eaf1fc7` (feat)
3. **Task 2 RED: Failing tests for Claude response parsing** - `5a09720` (test)
4. **Task 2 GREEN: claude.ts implementation** - `0df0723` (feat)

## Files Created/Modified
- `oracle/src/prompt.ts` - buildSystemPrompt, buildUserMessage, buildFullPrompt, hashPrompt (template-based prompt construction + SHA-256)
- `oracle/src/claude.ts` - parseClaudeResponse, validateClaudeResult, callClaude (Claude API at temperature 0)
- `oracle/src/__tests__/prompt.test.ts` - 11 unit tests for all prompt construction behaviors
- `oracle/src/__tests__/claude.test.ts` - 14 unit tests for parse/validate behaviors including edge cases

## Decisions Made
- `../config/system-prompt.txt` path from `oracle/src/` — `__dirname` in `prompt.ts` resolves to `oracle/src/`, not `oracle/`, so the template is one level up at `oracle/config/`.
- Template is cached after first read at module level (`_cachedTemplate` variable) — no repeated disk reads during the process lifetime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect template path: `../../config` should be `../config`**
- **Found during:** Task 1 GREEN (first test run after implementing prompt.ts)
- **Issue:** `path.resolve(__dirname, "../../config/system-prompt.txt")` from `oracle/src/` resolves to `splat/config/system-prompt.txt` (two levels up), not `oracle/config/system-prompt.txt`. The file does not exist at the wrong path.
- **Fix:** Changed to `path.resolve(__dirname, "../config/system-prompt.txt")` — one level up from `oracle/src/` correctly reaches `oracle/config/`.
- **Files modified:** oracle/src/prompt.ts
- **Verification:** All 11 prompt tests pass after fix
- **Committed in:** eaf1fc7 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — wrong relative path)
**Impact on plan:** Fix was necessary for correct file loading. No scope creep.

## Issues Encountered
- None beyond the path bug above.

## User Setup Required
None - no external service configuration required. No new dependencies added.

## Next Phase Readiness
- `prompt.ts` and `claude.ts` are ready for use by the lifecycle manager (Plan 04)
- The full oracle round pipeline can now: construct SPEC-compliant prompt → hash for commit → call Claude → parse + validate response
- All downstream oracle plans can `import { buildSystemPrompt, buildUserMessage, buildFullPrompt, hashPrompt } from "./prompt"` and `import { callClaude, parseClaudeResponse, validateClaudeResult } from "./claude"`
- No blockers for oracle Plans 04+ (lifecycle manager, Arweave upload)

---
*Phase: 02-oracle-service*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: oracle/src/prompt.ts
- FOUND: oracle/src/claude.ts
- FOUND: oracle/src/__tests__/prompt.test.ts
- FOUND: oracle/src/__tests__/claude.test.ts
- FOUND: .planning/phases/02-oracle-service/02-03-SUMMARY.md
- FOUND commit: 67c0b03 (test: RED prompt tests)
- FOUND commit: eaf1fc7 (feat: prompt.ts implementation)
- FOUND commit: 5a09720 (test: RED claude tests)
- FOUND commit: 0df0723 (feat: claude.ts implementation)
