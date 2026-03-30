/**
 * Core round lifecycle state machine for the Pixel Predict oracle service.
 *
 * Exports:
 * - sleep(ms): simple await-based delay
 * - OracleContext: aggregates all dependencies for a round
 * - callClaudeWithFallback: 3-tier failure cascade (3x30s, 6x5min, VRF)
 * - tick(ctx): stateless polling ticker — reads chain state, does one action, returns
 */

import { createHash } from "crypto";
import type { OracleConfig } from "./config";
import type { ChainClient } from "./chain";
import { callClaude } from "./claude";
import { buildSystemPrompt, buildUserMessage, buildFullPrompt, hashPrompt } from "./prompt";
import { resolveViaVrf } from "./vrf";
import type { ResolutionResult, RoundHistoryEntry } from "./types";
import type { Alerts } from "./alerts";
import { uploadToArweave } from "./arweave";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Aggregates all dependencies injected into the round lifecycle.
 * Using an explicit context object makes every dependency visible and testable.
 */
export interface OracleContext {
  config: OracleConfig;
  chain: ChainClient;
  alerts: Alerts;
  history: {
    read(): Promise<RoundHistoryEntry[]>;
    push(entry: RoundHistoryEntry): Promise<void>;
  };
  /** Internal test hooks — override callClaude, sleep, resolveViaVrf in unit tests */
  _testHooks?: {
    callClaude?: (attempt: number) => Promise<ResolutionResult>;
    sleep?: (ms: number) => Promise<void>;
    resolveViaVrf?: (
      ctx: OracleContext,
      seasonNumber: number,
      pixelIndex: number
    ) => Promise<ResolutionResult>;
  };
}

// ---------------------------------------------------------------------------
// sleep
// ---------------------------------------------------------------------------

/**
 * Simple Promise-based delay. Used for retry back-off in callClaudeWithFallback.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// callClaudeWithFallback — 3-tier failure cascade
// ---------------------------------------------------------------------------

const FAST_RETRY_COUNT = 3;          // Tier 1: number of fast retry attempts
const FAST_RETRY_DELAY_MS = 30_000;  // Tier 1: 30 seconds between fast retries
const DELAY_RETRY_COUNT = 6;         // Tier 2: number of delay retries
const DELAY_RETRY_MS = 5 * 60_000;   // Tier 2: 5 minutes between delay retries

/**
 * Call Claude with a 3-tier failure cascade to guarantee resolution:
 *
 *   Tier 1 — 3 fast retries at 30s:
 *     - Attempt 0, 1, 2 in quick succession (30s sleep between failures)
 *
 *   Tier 2 — delay state, 6 retries at 5-min intervals:
 *     - After all 3 fast retries fail, send retryWarning alert
 *     - Sleep 5 min, try Claude, repeat up to 6 times
 *
 *   Tier 3 — VRF fallback:
 *     - After all 9 attempts (3+6) fail, send vrfFallback alert
 *     - Delegate to resolveViaVrf which calls the Switchboard randomness instruction
 *
 * @param ctx            Oracle context with injected dependencies
 * @param systemPrompt   System prompt string for Claude
 * @param userMessage    Per-round user message for Claude
 * @param seasonNumber   Current season number (for VRF path)
 * @param pixelIndex     Current pixel index (for VRF path)
 * @returns Resolved ResolutionResult (always resolves — never throws)
 */
export async function callClaudeWithFallback(
  ctx: OracleContext,
  systemPrompt: string,
  userMessage: string,
  seasonNumber: number,
  pixelIndex: number
): Promise<ResolutionResult> {
  // Allow test hooks to replace the real callClaude and sleep
  const sleepFn = ctx._testHooks?.sleep ?? sleep;
  const vrf = ctx._testHooks?.resolveViaVrf ?? resolveViaVrf;

  let attemptGlobal = 0; // used for _testHooks.callClaude(attempt) tracking

  // ----- Tier 1: 3 fast retries at 30s intervals -----
  for (let attempt = 0; attempt < FAST_RETRY_COUNT; attempt++) {
    try {
      let result: ResolutionResult;
      if (ctx._testHooks?.callClaude) {
        result = await ctx._testHooks.callClaude(attemptGlobal);
      } else {
        const claudeResult = await callClaude(
          ctx.config.anthropicApiKey,
          systemPrompt,
          userMessage
        );
        result = { ...claudeResult, vrfResolved: false };
      }
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ event: "claude_retry", tier: 1, attempt, error: errMsg });
      if (attempt < FAST_RETRY_COUNT - 1) {
        await sleepFn(FAST_RETRY_DELAY_MS);
      }
    }
    attemptGlobal++;
  }

  // ----- Tier 2: delay state — send alert then 6 retries at 5-min intervals -----
  await ctx.alerts.sendRetryWarning();

  for (let attempt = 0; attempt < DELAY_RETRY_COUNT; attempt++) {
    await sleepFn(DELAY_RETRY_MS);
    try {
      let result: ResolutionResult;
      if (ctx._testHooks?.callClaude) {
        result = await ctx._testHooks.callClaude(attemptGlobal);
      } else {
        const claudeResult = await callClaude(
          ctx.config.anthropicApiKey,
          systemPrompt,
          userMessage
        );
        result = { ...claudeResult, vrfResolved: false };
      }
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ event: "claude_delay_retry", tier: 2, attempt, error: errMsg });
    }
    attemptGlobal++;
  }

  // ----- Tier 3: VRF fallback -----
  await ctx.alerts.sendVrfFallback();
  return vrf(ctx, seasonNumber, pixelIndex);
}

// ---------------------------------------------------------------------------
// tick — stateless polling state machine
// ---------------------------------------------------------------------------

/** Overlap protection — prevents concurrent ticks (Claude calls can take 30+ min) */
let _tickBusy = false;
let _tickStartedAt = 0;
const TICK_STALE_MS = 45 * 60_000; // 45 minutes — longer than worst-case Claude fallback cascade

/** Reset busy flag (for tests only) */
export function _resetTickBusy(): void {
  _tickBusy = false;
  _tickStartedAt = 0;
}

/**
 * State-machine ticker. Each tick reads on-chain state, does one action, returns.
 * No separate recovery flow — the tick IS the recovery.
 *
 * State machine:
 *   PixelState = null          → open_round + pre-open N+1
 *   status=open,  <28min       → noop (betting window)
 *   status=open,  ≥28min       → lock_round
 *   status=locked, <2min       → noop (lockout)
 *   status=locked, ≥2min       → call Claude + resolve_round + arweave + history
 *   status=resolved, no arweave → upload to Arweave (safety net)
 *   status=resolved, has arweave → noop (round complete)
 */
export async function tick(ctx: OracleContext): Promise<void> {
  if (_tickBusy) {
    // Auto-reset if previous tick has been running longer than TICK_STALE_MS
    if (Date.now() - _tickStartedAt > TICK_STALE_MS) {
      logger.warn({ event: "tick_stale_reset", staleSinceMs: Date.now() - _tickStartedAt });
      _tickBusy = false;
    } else {
      logger.info({ event: "tick_skipped", reason: "busy" });
      return;
    }
  }
  _tickBusy = true;
  _tickStartedAt = Date.now();
  try {
    await _tickInner(ctx);
  } finally {
    _tickBusy = false;
  }
}

async function _tickInner(ctx: OracleContext): Promise<void> {
  const { config, chain } = ctx;

  // Read season state
  const seasonState = await chain.getSeasonState(config.currentSeason);
  const { seasonNumber, gridWidth, gridHeight, currentPixelIndex } = seasonState;
  const pixelIndex = currentPixelIndex;
  const totalPixels = gridWidth * gridHeight;

  // Season completion guard
  if (pixelIndex >= totalPixels) {
    logger.info({ event: "tick_noop", reason: "season_complete", seasonNumber, pixelIndex, totalPixels });
    return;
  }

  // Read pixel state
  const pixelState = await chain.getPixelState(seasonNumber, pixelIndex);

  logger.info({
    event: "tick_start",
    seasonNumber,
    pixelIndex,
    status: pixelState?.status ?? "null",
  });

  // --- PixelState = null → open_round + pre-open N+1 ---
  if (pixelState === null) {
    const x = pixelIndex % gridWidth;
    const y = Math.floor(pixelIndex / gridWidth);
    const canvasPixels = await chain.getAllResolvedPixels(seasonNumber, pixelIndex);
    const history = await ctx.history.read();
    const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, config.seasonStyleSummary);
    const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, history);
    const fullPrompt = buildFullPrompt(systemPrompt, userMessage);
    const promptHash = hashPrompt(fullPrompt);

    await chain.openRoundForSeason(seasonNumber, pixelIndex, Array.from(promptHash));
    logger.info({ event: "tick_action", action: "open_round", seasonNumber, pixelIndex });
    return;
  }

  switch (pixelState.status) {
    // --- Betting window ---
    case "open": {
      const openedAt = pixelState.openedAt ? Number(pixelState.openedAt) * 1000 : Date.now();
      const elapsed = Date.now() - openedAt;
      const bettingMs = config.bettingWindowMinutes * 60_000;
      if (elapsed < bettingMs) {
        logger.info({ event: "tick_noop", reason: "betting_window", pixelIndex, remainingMs: bettingMs - elapsed });
        return;
      }
      // Betting window expired → lock
      await chain.lockRound(seasonNumber, pixelIndex);
      logger.info({ event: "tick_action", action: "lock_round", seasonNumber, pixelIndex });
      return;
    }

    // --- Lock window → resolve ---
    case "locked": {
      const lockedAt = pixelState.lockedAt ? Number(pixelState.lockedAt) * 1000 : Date.now();
      const elapsed = Date.now() - lockedAt;
      const lockMs = config.lockWindowMinutes * 60_000;
      if (elapsed < lockMs) {
        logger.info({ event: "tick_noop", reason: "lock_window", pixelIndex, remainingMs: lockMs - elapsed });
        return;
      }

      // Lock window expired → resolve
      const x = pixelIndex % gridWidth;
      const y = Math.floor(pixelIndex / gridWidth);
      const canvasPixels = await chain.getAllResolvedPixels(seasonNumber, pixelIndex);
      const historyEntries = await ctx.history.read();
      const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, config.seasonStyleSummary);
      const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, historyEntries);
      const fullPrompt = buildFullPrompt(systemPrompt, userMessage);

      // Check RIGGED_COLOR test mode
      const riggedColor = process.env.RIGGED_COLOR;
      let result: ResolutionResult;

      if (riggedColor !== undefined) {
        const riggedIndex = parseInt(riggedColor, 10);
        const { COLOR_NAMES } = await import("./types");
        const colorName = COLOR_NAMES[riggedIndex] ?? "Red";
        logger.info({ event: "rigged_resolve", pixelIndex, colorIndex: riggedIndex, colorName });
        result = {
          colorIndex: riggedIndex,
          colorName,
          shade: 50,
          warmth: 50,
          reasoning: "RIGGED FOR TESTING",
          vrfResolved: false,
        };
      } else {
        result = await callClaudeWithFallback(ctx, systemPrompt, userMessage, seasonNumber, pixelIndex);
      }

      // Post result on-chain (VRF path already posts itself in resolveViaVrf)
      if (!result.vrfResolved) {
        const claudeResult = result as Exclude<ResolutionResult, { vrfResolved: true }>;
        await chain.resolveRound(seasonNumber, pixelIndex, {
          colorIndex: claudeResult.colorIndex,
          colorName: claudeResult.colorName,
          shade: claudeResult.shade,
          warmth: claudeResult.warmth,
          reasoning: claudeResult.reasoning ?? "",
        });
      }

      // Arweave upload (non-blocking — errors caught and logged)
      const txid = await uploadToArweave(
        fullPrompt,
        config.oracleKeypair,
        config.solanaRpcUrl
      ).catch((err) => {
        logger.warn({
          event: "arweave_upload_failed",
          pixelIndex,
          error: err instanceof Error ? err.message : String(err),
        });
        ctx.alerts.sendArweaveFailure(pixelIndex, err instanceof Error ? err.message : String(err)).catch(() => {});
        return null;
      });
      if (txid) {
        await chain.setArweaveTxid(seasonNumber, pixelIndex, txid).catch((err) => {
          logger.warn({
            event: "arweave_txid_write_failed",
            pixelIndex,
            txid,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      // Update round history
      const historyEntry: RoundHistoryEntry = {
        pixelIndex,
        x,
        y,
        color: result.vrfResolved
          ? `color-${result.colorIndex}`
          : (result as Exclude<ResolutionResult, { vrfResolved: true }>).colorName,
        shade: result.shade,
        warmth: result.warmth,
        reasoning: result.vrfResolved
          ? "VRF fallback — Claude was unavailable for 30+ minutes"
          : (result as Exclude<ResolutionResult, { vrfResolved: true }>).reasoning ?? "",
      };
      await ctx.history.push(historyEntry);

      logger.info({
        event: "tick_action",
        action: "resolve_round",
        seasonNumber,
        pixelIndex,
        x,
        y,
        colorIndex: result.colorIndex,
        color: historyEntry.color,
        shade: result.shade,
        warmth: result.warmth,
        vrfResolved: result.vrfResolved,
      });

      // Success alert
      await ctx.alerts.sendSuccess({
        pixelIndex,
        colorName: historyEntry.color,
        shade: result.shade,
        warmth: result.warmth,
      });
      return;
    }

    // --- Resolved: safety net for Arweave retry ---
    case "resolved": {
      if (!pixelState.hasArweaveTxid) {
        const x = pixelIndex % gridWidth;
        const y = Math.floor(pixelIndex / gridWidth);
        const canvasPixels = await chain.getAllResolvedPixels(seasonNumber, pixelIndex);
        const historyEntries = await ctx.history.read();
        const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, config.seasonStyleSummary);
        const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, historyEntries);
        const fullPrompt = buildFullPrompt(systemPrompt, userMessage);

        const txid = await uploadToArweave(
          fullPrompt,
          config.oracleKeypair,
          config.solanaRpcUrl
        ).catch((err) => {
          logger.warn({
            event: "arweave_upload_failed",
            pixelIndex,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        });
        if (txid) {
          await chain.setArweaveTxid(seasonNumber, pixelIndex, txid).catch((err) => {
            logger.warn({
              event: "arweave_txid_write_failed",
              pixelIndex,
              txid,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
        logger.info({ event: "tick_action", action: "arweave_upload", pixelIndex });
        return;
      }
      // Round fully complete
      logger.info({ event: "tick_noop", reason: "round_complete", pixelIndex });
      return;
    }

    default:
      logger.warn({ event: "tick_unknown_status", pixelIndex, status: pixelState.status });
      return;
  }
}
