/**
 * Cron scheduler for the Pixel Predict oracle service.
 *
 * Runs runRound every 30 minutes (at minute 0 and 30 of every hour).
 * Includes overlap protection to prevent concurrent round executions
 * if a round takes longer than the 30-minute window.
 *
 * Exports:
 * - startScheduler(ctx): void — start the cron job and return
 */

import * as cron from "node-cron";
import type { OracleContext } from "./round";
import { runRound } from "./round";
import { logger } from "./logger";

/**
 * Start the oracle's cron scheduler.
 *
 * Schedule: '0,30 * * * *' — runs at minute 0 and 30 of every hour.
 *
 * Overlap protection: if a round is still running when the next cron tick fires,
 * the tick is skipped with a warning log. This prevents two rounds from running
 * simultaneously if the previous round's resolution takes longer than 30 minutes.
 *
 * @param ctx - Oracle context with all injected dependencies
 */
export function startScheduler(ctx: OracleContext): void {
  let roundInProgress = false;

  cron.schedule("0,30 * * * *", async () => {
    if (roundInProgress) {
      logger.warn({ event: "round_overlap_skipped" });
      return;
    }

    roundInProgress = true;
    try {
      await runRound(ctx);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({
        event: "round_failed",
        error: errMsg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      await ctx.alerts.sendRetryWarning().catch(() => {});
    } finally {
      roundInProgress = false;
    }
  });

  logger.info({ event: "scheduler_started", schedule: "0,30 * * * *" });
}
