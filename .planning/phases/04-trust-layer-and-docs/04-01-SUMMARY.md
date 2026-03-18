---
phase: 04-trust-layer-and-docs
plan: "01"
subsystem: ui
tags: [react, typescript, solana, vrf, arweave, commit-reveal, trust]

# Dependency graph
requires:
  - phase: 03-frontend-core
    provides: PixelSnapshot type, PixelCell, PixelTooltip, useSeasonData, useHeliusSocket
  - phase: 01-anchor-program
    provides: on-chain VRF resolution flag, promptHash, arweaveTxid fields on PixelState
provides:
  - VRF dot overlay on resolved VRF pixels (6px cyan circle, top-right corner)
  - Expandable proof section in PixelTooltip with prompt commitment hash, Arweave link, VRF note
  - "Verified fair" badge and "Resolved via random fallback" badge
  - Extended PixelSnapshot type with promptHash, arweaveTxid, hasArweaveTxid fields
  - Decode functions updated in useSeasonData and useHeliusSocket (kept in sync)
affects: [04-trust-layer-and-docs, any plan consuming PixelSnapshot]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic tooltip height: getBoundingClientRect().height used for re-clamping after render/state changes"
    - "Hex truncation pattern: first 8 + '...' + last 8 chars for 64-char hash display"
    - "Arweave txid decode: String.fromCharCode(...bytes) from [u8; 43] on-chain byte array"
    - "Prompt commitment proof language: use 'prompt commitment proof', never 'reproducible result'"

key-files:
  created:
    - app/src/__tests__/PixelTooltip.test.tsx
  modified:
    - app/src/types/game.ts
    - app/src/hooks/useSeasonData.ts
    - app/src/hooks/useHeliusSocket.ts
    - app/src/hooks/useColorPools.ts
    - app/src/components/canvas/PixelCell.tsx
    - app/src/components/canvas/PixelTooltip.tsx

key-decisions:
  - "PixelTooltip TOOLTIP_WIDTH increased from 160 to 200 to accommodate proof data"
  - "Dynamic height clamping: tooltipRef.getBoundingClientRect() in useEffect, re-runs when proofExpanded toggles"
  - "VRF dot on PixelCell: position:relative added only when isResolved+backgroundColor (avoids layout shift on open/locked cells)"
  - "Proof section only shown when promptHashHex is non-null (guards unresolved pixels)"
  - "Arweave txid decoded client-side via String.fromCharCode (matches oracle encode logic)"

patterns-established:
  - "Prompt commitment proof language: 'prompt commitment proof' not 'reproducible result' (per user decision)"
  - "Trust badge pattern: checkmark + 'Verified fair' in #3BDBFF; fallback arrow + 'Resolved via random fallback' in #ED8936"

requirements-completed: [FS-07, FS-08, FS-09]

# Metrics
duration: 20min
completed: 2026-03-18
---

# Phase 4 Plan 01: VRF Trust Layer and Commit-Reveal Proof UI Summary

**VRF cyan dot on resolved pixels and expandable commit-reveal proof section in PixelTooltip with "Verified fair" badge, prompt hash hex display, and Arweave link**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-18T11:37:00Z
- **Completed:** 2026-03-18T11:57:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extended PixelSnapshot interface with three new fields (promptHash, arweaveTxid, hasArweaveTxid) and updated both decode functions
- Added VRF dot overlay (6px cyan circle) to resolved VRF pixels on the canvas grid
- Rebuilt PixelTooltip with "Verified fair" badge, "Resolved via random fallback" indicator, and expandable proof section showing prompt hash hex and Arweave link
- All 71 tests pass; production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PixelSnapshot type and decode prompt hash + Arweave txid** - `db2addc` (feat)
2. **Task 2: Add VRF dot to PixelCell and expandable proof section to PixelTooltip** - `f9efc33` (feat)

**Plan metadata:** `(docs commit follows)`

## Files Created/Modified
- `app/src/types/game.ts` - Added promptHash, arweaveTxid, hasArweaveTxid to PixelSnapshot interface
- `app/src/hooks/useSeasonData.ts` - Decodes new fields from on-chain PixelState in decodePixelState
- `app/src/hooks/useHeliusSocket.ts` - Kept decodePixelStateToSnapshot in sync with same three fields
- `app/src/hooks/useColorPools.ts` - Fixed partial PixelSnapshot construction to include new required fields
- `app/src/components/canvas/PixelCell.tsx` - VRF dot overlay (position:relative, 6px #3BDBFF circle top-right)
- `app/src/components/canvas/PixelTooltip.tsx` - Full rebuild: dynamic height, verified fair badge, expandable proof section
- `app/src/__tests__/PixelTooltip.test.tsx` - 6 tests covering badge, VRF fallback, proof expansion, Arweave link

## Decisions Made
- Increased TOOLTIP_WIDTH from 160 to 200 to accommodate proof data without overflow
- Dynamic height clamping: re-clamp via useEffect when proofExpanded state changes
- position:relative only added to PixelCell when resolved+backgroundColor to avoid layout shift

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useColorPools.ts PixelSnapshot construction missing new required fields**
- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** useColorPools builds a partial PixelSnapshot for pool updates; after adding three required fields to the interface, TypeScript reported a type error
- **Fix:** Added promptHash, arweaveTxid, hasArweaveTxid fields (falling back to existing snapshot values) to the setPixelState call in useColorPools
- **Files modified:** app/src/hooks/useColorPools.ts
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** db2addc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix for TypeScript correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VRF trust layer complete: players can see which pixels used VRF fallback and verify the prompt commitment proof
- PixelSnapshot type is stable and extended — future plans consuming it will have promptHash and arweaveTxid available
- Ready for remaining Phase 4 plans (docs, how-it-works, FAQ pages)

---
*Phase: 04-trust-layer-and-docs*
*Completed: 2026-03-18*

## Self-Check: PASSED
- All key files exist on disk
- Both task commits (db2addc, f9efc33) verified in git log
- 71 tests passing, production build succeeds
