/**
 * Entry point for the Pixel Predict oracle service.
 *
 * Responsibilities:
 * 1. Load configuration from environment variables
 * 2. Initialize all oracle modules (chain, alerts, history)
 * 3. Start health server
 * 4. Reconstruct local round history if missing
 * 5. Start the polling ticker (first tick runs immediately — IS the recovery)
 * 6. Register graceful shutdown and error handlers
 */

import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "./config";
import { ChainClient } from "./chain";
import { createAlerts } from "./alerts";
import { RoundHistory } from "./history";
import type { OracleContext } from "./round";
import { startTicker } from "./scheduler";
import { logger } from "./logger";
import { startHealthServer } from "./health";

/**
 * Main oracle entry point.
 * No recovery flow — the ticker's first tick reads chain state and picks up
 * wherever the round left off.
 */
export async function main(): Promise<void> {
  // 1. Load configuration
  const config = loadConfig();

  // 2. Initialize all modules
  const chain = new ChainClient(config);
  const alerts = createAlerts(config);
  const history = new RoundHistory();
  const ctx: OracleContext = { config, chain, alerts, history };

  logger.info({
    event: "oracle_starting",
    season: config.currentSeason,
    oracle: config.oracleKeypair.publicKey.toBase58(),
    tickIntervalMs: config.tickIntervalMs,
  });

  // Warn loudly if RIGGED_COLOR is active — skips Claude, always picks one color
  if (process.env.RIGGED_COLOR !== undefined) {
    logger.warn({
      event: "rigged_color_active",
      colorIndex: parseInt(process.env.RIGGED_COLOR, 10),
      warning: "RIGGED_COLOR is set — Claude is BYPASSED. Remove from .env for production.",
    });
  }

  // 3. Start health server (Railway health checks pass immediately)
  startHealthServer();

  // 4. Send process restart alert
  await alerts.sendProcessRestart().catch(() => {});

  // 5. Reconstruct history if round_history.json is missing
  const historyPath = path.join(process.cwd(), "round_history.json");
  if (!fs.existsSync(historyPath)) {
    const seasonState = await chain.getSeasonState(config.currentSeason);
    logger.info({
      event: "history_missing",
      action: "reconstructing_from_chain",
      currentPixel: seasonState.currentPixelIndex,
    });
    await history.reconstruct(chain, config.currentSeason, seasonState.currentPixelIndex).catch((err) => {
      logger.warn({
        event: "history_reconstruct_failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 6. Start the ticker (first tick runs immediately — zero dead time on restart)
  startTicker(ctx);

  // 7. Graceful shutdown handlers
  process.on("SIGTERM", () => {
    logger.info({ event: "oracle_shutdown", signal: "SIGTERM" });
    process.exit(0);
  });
  process.on("SIGINT", () => {
    logger.info({ event: "oracle_shutdown", signal: "SIGINT" });
    process.exit(0);
  });

  // 8. Uncaught error handlers
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
