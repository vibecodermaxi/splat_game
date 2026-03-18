/**
 * Core round lifecycle state machine for the Pixel Predict oracle service.
 *
 * Exports:
 * - sleep(ms): simple await-based delay
 * - OracleContext: aggregates all dependencies for a round
 * - callClaudeWithFallback: 3-tier failure cascade (3x30s, 6x5min, VRF)
 * - runRound: full round lifecycle (open → wait → lock → wait → resolve → log)
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
 * Simple Promise-based delay. Used for retry back-off in callClaudeWithFallback
 * and for timing in runRound (betting window, lockout window).
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
// runRound — full round lifecycle
// ---------------------------------------------------------------------------

const BETTING_WINDOW_MS = 28 * 60_000; // 28 minutes
const LOCK_WINDOW_MS = 2 * 60_000;     // 2 minutes

/**
 * Execute a complete round lifecycle for the current pixel:
 *
 *   1. Read season state from chain
 *   2. Compute pixel coordinates
 *   3. Read canvas state (all resolved pixels up to this pixel)
 *   4. Read round history
 *   5. Build system prompt, user message, full prompt
 *   6. Hash prompt (commit for on-chain storage)
 *   7. Open round on-chain (current pixel)
 *   8. Pre-open next round (N+1) if not last pixel
 *   9. Wait 28 minutes (betting window)
 *  10. Lock round on-chain (skip if already locked)
 *  11. Wait 2 minutes (lockout window)
 *  12. Resolve via callClaudeWithFallback
 *  13. Post result on-chain (skipped if VRF path — VRF path posts itself)
 *  14. Update round history
 *  15. Log round result
 *  16. Send success alert
 *
 * @param ctx Oracle context with all injected dependencies
 */
export async function runRound(ctx: OracleContext): Promise<void> {
  const sleepFn = ctx._testHooks?.sleep ?? sleep;

  // 1. Read season state
  const seasonState = await ctx.chain.getSeasonState(ctx.config.currentSeason);
  const { seasonNumber, gridWidth, gridHeight, currentPixelIndex } = seasonState;
  const pixelIndex = currentPixelIndex;

  // 2. Compute pixel coordinates
  const x = pixelIndex % gridWidth;
  const y = Math.floor(pixelIndex / gridWidth);

  // 3. Read canvas state — all resolved pixels up to current pixel
  const canvasPixels = await ctx.chain.getAllResolvedPixels(seasonNumber, pixelIndex);

  // 4. Read round history
  const history = await ctx.history.read();

  // 5. Build prompts
  const systemPrompt = buildSystemPrompt(
    gridWidth,
    gridHeight,
    ctx.config.seasonStyleSummary
  );
  const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, history);
  const fullPrompt = buildFullPrompt(systemPrompt, userMessage);

  // 6. Hash prompt
  const promptHash = hashPrompt(fullPrompt);

  // 7. Open current round on-chain
  await ctx.chain.openRoundForSeason(seasonNumber, pixelIndex, Array.from(promptHash));

  // 8. Pre-open next round (N+1) if not the last pixel
  const totalPixels = gridWidth * gridHeight;
  if (pixelIndex + 1 < totalPixels) {
    try {
      // Build a placeholder prompt hash for N+1 — real prompt constructed when that round runs
      const placeholderText = `placeholder-${seasonNumber}-${pixelIndex + 1}`;
      const placeholderHash = createHash("sha256")
        .update(Buffer.from(placeholderText, "utf8"))
        .digest();
      await ctx.chain.openRoundForSeason(
        seasonNumber,
        pixelIndex + 1,
        Array.from(placeholderHash)
      );
    } catch {
      // N+1 may already exist — this is expected and not an error
      logger.info({
        event: "preopen_next_skipped",
        seasonNumber,
        pixelIndex: pixelIndex + 1,
        reason: "already exists or other non-fatal error",
      });
    }
  }

  // 9. Wait 28 minutes (betting window)
  await sleepFn(BETTING_WINDOW_MS);

  // 10. Lock round — skip if already locked
  const pixelState = await ctx.chain.getPixelState(seasonNumber, pixelIndex);
  if (!pixelState || pixelState.status === "open") {
    await ctx.chain.lockRound(seasonNumber, pixelIndex);
  } else {
    logger.info({
      event: "lock_skipped",
      seasonNumber,
      pixelIndex,
      status: pixelState?.status ?? "unknown",
    });
  }

  // 11. Wait 2 minutes (lockout window)
  await sleepFn(LOCK_WINDOW_MS);

  // 12. Resolve via Claude (with failure cascade)
  const result = await callClaudeWithFallback(
    ctx,
    systemPrompt,
    userMessage,
    seasonNumber,
    pixelIndex
  );

  // 13. Post result on-chain (VRF path already posts itself in resolveViaVrf)
  if (!result.vrfResolved) {
    // result is a ClaudeResult with vrfResolved=false
    const claudeResult = result as Exclude<ResolutionResult, { vrfResolved: true }>;
    await ctx.chain.resolveRound(seasonNumber, pixelIndex, {
      colorIndex: claudeResult.colorIndex,
      colorName: claudeResult.colorName,
      shade: claudeResult.shade,
      warmth: claudeResult.warmth,
      reasoning: claudeResult.reasoning ?? "",
    });
  }

  // 13.5. Non-blocking Arweave upload (after on-chain resolution)
  const txid = await uploadToArweave(
    fullPrompt,
    ctx.config.oracleKeypair,
    ctx.config.solanaRpcUrl
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
    await ctx.chain.setArweaveTxid(seasonNumber, pixelIndex, txid).catch((err) => {
      logger.warn({
        event: "arweave_txid_write_failed",
        pixelIndex,
        txid,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 14. Update round history
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

  // 15. Log round result
  logger.info({
    event: "round_complete",
    seasonNumber,
    pixelIndex,
    x,
    y,
    colorIndex: result.colorIndex,
    color: historyEntry.color,
    shade: result.shade,
    warmth: result.warmth,
    vrfResolved: result.vrfResolved,
    reasoning: historyEntry.reasoning,
  });

  // 16. Send success alert
  await ctx.alerts.sendSuccess({
    pixelIndex,
    colorName: historyEntry.color,
    shade: result.shade,
    warmth: result.warmth,
  });
}
