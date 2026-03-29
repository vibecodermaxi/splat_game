/**
 * Ticker scheduler for the Pixel Predict oracle service.
 *
 * Replaces the old cron-based scheduler with a simple setInterval ticker.
 * First tick runs immediately on startup (zero dead time on restart).
 *
 * Exports:
 * - startTicker(ctx): void — start the ticker and return
 */

import type { OracleContext } from "./round";
import { tick } from "./round";
import { logger } from "./logger";

/**
 * Start the oracle's polling ticker.
 *
 * Interval is derived from ctx.config.tickIntervalMs (set from TICK_INTERVAL_SECONDS env var).
 * Default: 90 seconds.
 *
 * First tick runs immediately — no dead time on restart.
 * Overlap protection is handled by the _tickBusy flag inside tick().
 *
 * @param ctx - Oracle context with all injected dependencies
 */
export function startTicker(ctx: OracleContext): void {
  const intervalMs = ctx.config.tickIntervalMs;

  const runTick = () => {
    tick(ctx).catch((err) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({
        event: "tick_failed",
        error: errMsg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      ctx.alerts.sendRetryWarning().catch(() => {});
    });
  };

  // First tick immediately
  runTick();

  // Recurring ticks
  setInterval(runTick, intervalMs);

  logger.info({ event: "ticker_started", intervalMs });
}
