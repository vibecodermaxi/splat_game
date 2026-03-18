/**
 * Entry point for the Pixel Predict oracle service.
 *
 * Responsibilities:
 * 1. Load configuration from environment variables
 * 2. Initialize all oracle modules (chain, alerts, history)
 * 3. Check chain state and recover from any crash state
 * 4. Reconstruct local round history if missing
 * 5. Start the cron scheduler for ongoing round management
 * 6. Register graceful shutdown and error handlers
 *
 * Recovery logic handles all possible round states on startup:
 *   - No round started → start scheduler normally
 *   - Round is Open → wait for remaining betting window, then lock + resolve
 *   - Round is Locked → immediately resume from resolve step
 *   - Round is Resolved (no Arweave txid) → attempt Arweave upload, then start scheduler
 *   - Round is Resolved (with Arweave txid) → start scheduler normally for next round
 */

import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "./config";
import { ChainClient } from "./chain";
import { createAlerts } from "./alerts";
import { RoundHistory } from "./history";
import { runRound, sleep, callClaudeWithFallback } from "./round";
import type { OracleContext } from "./round";
import { uploadToArweave } from "./arweave";
import { buildSystemPrompt, buildUserMessage, buildFullPrompt } from "./prompt";
import { startScheduler } from "./scheduler";
import { logger } from "./logger";

/**
 * Main oracle entry point.
 * Performs startup recovery, then starts the cron scheduler.
 */
export async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Load configuration
  // -------------------------------------------------------------------------
  const config = loadConfig();

  // Timing windows derived from config (not hardcoded)
  const BETTING_WINDOW_MS = config.bettingWindowMinutes * 60_000;
  const LOCK_WINDOW_MS = config.lockWindowMinutes * 60_000;

  // -------------------------------------------------------------------------
  // 2. Initialize all modules
  // -------------------------------------------------------------------------
  const chain = new ChainClient(config);
  const alerts = createAlerts(config);
  const history = new RoundHistory();
  const ctx: OracleContext = { config, chain, alerts, history };

  logger.info({
    event: "oracle_starting",
    season: config.currentSeason,
    oracle: config.oracleKeypair.publicKey.toBase58(),
  });

  // -------------------------------------------------------------------------
  // 3. Recovery check — read chain state to determine current round status
  // -------------------------------------------------------------------------
  const seasonState = await chain.getSeasonState(config.currentSeason);
  const currentPixel = seasonState.currentPixelIndex;
  const pixelState = await chain.getPixelState(config.currentSeason, currentPixel).catch(() => null);

  logger.info({
    event: "recovery_check",
    seasonNumber: config.currentSeason,
    currentPixel,
    pixelStatus: pixelState?.status ?? "none",
  });

  if (pixelState === null) {
    // No round started — start scheduler normally
    logger.info({ event: "recovery_no_round", action: "starting_scheduler" });
  } else if (pixelState.status === "open") {
    // Round is open — calculate remaining betting window
    const openedAt = pixelState.openedAt ? Number(pixelState.openedAt) * 1000 : Date.now();
    const elapsed = Date.now() - openedAt;
    const remaining = BETTING_WINDOW_MS - elapsed;

    if (remaining > 0) {
      // Still within betting window — wait for remainder, then lock and resolve
      logger.info({
        event: "recovery_open_waiting",
        pixelIndex: currentPixel,
        remainingMs: remaining,
        action: "waiting_then_locking",
      });
      await sleep(remaining);
    } else {
      logger.info({
        event: "recovery_open_expired",
        pixelIndex: currentPixel,
        action: "locking_immediately",
      });
    }

    // Lock the round
    await chain.lockRound(config.currentSeason, currentPixel).catch((err) => {
      logger.warn({
        event: "recovery_lock_failed",
        pixelIndex: currentPixel,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Wait the lock window before resolving
    await sleep(LOCK_WINDOW_MS);

    // Resolve via Claude with fallback
    const canvasPixels = await chain.getAllResolvedPixels(config.currentSeason, currentPixel);
    const historyEntries = await history.read();
    const { gridWidth, gridHeight } = seasonState;
    const x = currentPixel % gridWidth;
    const y = Math.floor(currentPixel / gridWidth);
    const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, config.seasonStyleSummary);
    const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, historyEntries);
    const fullPrompt = buildFullPrompt(systemPrompt, userMessage);

    const result = await callClaudeWithFallback(ctx, systemPrompt, userMessage, config.currentSeason, currentPixel);

    if (!result.vrfResolved) {
      const claudeResult = result as Exclude<typeof result, { vrfResolved: true }>;
      await chain.resolveRound(config.currentSeason, currentPixel, {
        colorIndex: claudeResult.colorIndex,
        colorName: claudeResult.colorName,
        shade: claudeResult.shade,
        warmth: claudeResult.warmth,
        reasoning: claudeResult.reasoning ?? "",
      });
    }

    // Arweave upload after resolution
    const txid = await uploadToArweave(fullPrompt, config.oracleKeypair, config.solanaRpcUrl).catch(() => null);
    if (txid) {
      await chain.setArweaveTxid(config.currentSeason, currentPixel, txid).catch((err) => {
        logger.warn({
          event: "recovery_arweave_txid_failed",
          pixelIndex: currentPixel,
          txid,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    logger.info({ event: "recovery_open_resolved", pixelIndex: currentPixel });
  } else if (pixelState.status === "locked") {
    // Round is locked — immediately resume from resolve step
    logger.info({
      event: "recovery_locked",
      pixelIndex: currentPixel,
      action: "resolving_immediately",
    });

    const canvasPixels = await chain.getAllResolvedPixels(config.currentSeason, currentPixel);
    const historyEntries = await history.read();
    const { gridWidth, gridHeight } = seasonState;
    const x = currentPixel % gridWidth;
    const y = Math.floor(currentPixel / gridWidth);
    const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, config.seasonStyleSummary);
    const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, historyEntries);
    const fullPrompt = buildFullPrompt(systemPrompt, userMessage);

    const result = await callClaudeWithFallback(ctx, systemPrompt, userMessage, config.currentSeason, currentPixel);

    if (!result.vrfResolved) {
      const claudeResult = result as Exclude<typeof result, { vrfResolved: true }>;
      await chain.resolveRound(config.currentSeason, currentPixel, {
        colorIndex: claudeResult.colorIndex,
        colorName: claudeResult.colorName,
        shade: claudeResult.shade,
        warmth: claudeResult.warmth,
        reasoning: claudeResult.reasoning ?? "",
      });
    }

    // Arweave upload after resolution
    const txid = await uploadToArweave(fullPrompt, config.oracleKeypair, config.solanaRpcUrl).catch(() => null);
    if (txid) {
      await chain.setArweaveTxid(config.currentSeason, currentPixel, txid).catch((err) => {
        logger.warn({
          event: "recovery_arweave_txid_failed",
          pixelIndex: currentPixel,
          txid,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    logger.info({ event: "recovery_locked_resolved", pixelIndex: currentPixel });
  } else if (pixelState.status === "resolved") {
    // Round is resolved — check if Arweave txid is set; if not, try upload
    if (!pixelState.hasArweaveTxid) {
      logger.info({
        event: "recovery_resolved_no_arweave",
        pixelIndex: currentPixel,
        action: "attempting_arweave_upload",
      });

      // Rebuild the full prompt so we can upload it
      const canvasPixels = await chain.getAllResolvedPixels(config.currentSeason, currentPixel);
      const historyEntries = await history.read();
      const { gridWidth, gridHeight } = seasonState;
      const x = currentPixel % gridWidth;
      const y = Math.floor(currentPixel / gridWidth);
      const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, config.seasonStyleSummary);
      const userMessage = buildUserMessage(canvasPixels, x, y, gridWidth, gridHeight, historyEntries);
      const fullPrompt = buildFullPrompt(systemPrompt, userMessage);

      const txid = await uploadToArweave(fullPrompt, config.oracleKeypair, config.solanaRpcUrl).catch(() => null);
      if (txid) {
        await chain.setArweaveTxid(config.currentSeason, currentPixel, txid).catch((err) => {
          logger.warn({
            event: "recovery_arweave_txid_failed",
            pixelIndex: currentPixel,
            txid,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } else {
      logger.info({
        event: "recovery_resolved_with_arweave",
        pixelIndex: currentPixel,
        action: "starting_scheduler",
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Send process restart alert
  // -------------------------------------------------------------------------
  await alerts.sendProcessRestart().catch(() => {});

  // -------------------------------------------------------------------------
  // 5. Reconstruct history if round_history.json is missing
  // -------------------------------------------------------------------------
  const historyPath = path.join(process.cwd(), "round_history.json");
  if (!fs.existsSync(historyPath)) {
    logger.info({
      event: "history_missing",
      action: "reconstructing_from_chain",
      currentPixel,
    });
    await history.reconstruct(chain, config.currentSeason, currentPixel).catch((err) => {
      logger.warn({
        event: "history_reconstruct_failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // -------------------------------------------------------------------------
  // 6. Start the cron scheduler
  // -------------------------------------------------------------------------
  startScheduler(ctx);

  // -------------------------------------------------------------------------
  // 7. Graceful shutdown handlers
  // -------------------------------------------------------------------------
  process.on("SIGTERM", () => {
    logger.info({ event: "oracle_shutdown", signal: "SIGTERM" });
    process.exit(0);
  });
  process.on("SIGINT", () => {
    logger.info({ event: "oracle_shutdown", signal: "SIGINT" });
    process.exit(0);
  });

  // -------------------------------------------------------------------------
  // 8. Uncaught error handlers
  // -------------------------------------------------------------------------
  process.on("uncaughtException", (err) => {
    logger.error({
      event: "uncaught_exception",
      error: err.message,
      stack: err.stack,
    });
    process.exitCode = 1;
  });
  process.on("unhandledRejection", (reason) => {
    logger.error({
      event: "unhandled_rejection",
      reason: String(reason),
    });
  });
}

// Self-executing entry point
main().catch((err) => {
  logger.error({
    event: "startup_fatal",
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
