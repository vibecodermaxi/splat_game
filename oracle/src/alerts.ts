import type { OracleConfig } from "./config";
import { logger } from "./logger";

/**
 * Alert notification interface for oracle monitoring events.
 *
 * Each method is fire-and-forget — errors are caught internally and
 * never bubble up to the caller. The oracle should never crash due to
 * a Telegram failure.
 */
export interface Alerts {
  /** Round resolved successfully with Claude's selection */
  sendSuccess(result: {
    pixelIndex: number;
    colorName: string;
    shade: number;
    warmth: number;
    poolSize?: number;
  }): Promise<void>;

  /** Claude API is failing; oracle has entered the retry cascade */
  sendRetryWarning(pixelIndex?: number): Promise<void>;

  /** VRF fallback triggered — Claude has been unavailable for 30+ minutes */
  sendVrfFallback(pixelIndex?: number): Promise<void>;

  /** Oracle process has restarted and is recovering from chain state */
  sendProcessRestart(): Promise<void>;

  /** Arweave upload failed for a pixel (non-blocking, informational) */
  sendArweaveFailure(pixelIndex: number, error: string): Promise<void>;
}

/**
 * No-op Alerts implementation used when Telegram is not configured.
 * All methods log a debug message and return immediately.
 */
class NoopAlerts implements Alerts {
  async sendSuccess(result: {
    pixelIndex: number;
    colorName: string;
    shade: number;
    warmth: number;
    poolSize?: number;
  }): Promise<void> {
    logger.info({
      event: "alert_noop",
      type: "success",
      pixelIndex: result.pixelIndex,
      colorName: result.colorName,
    });
  }

  async sendRetryWarning(pixelIndex?: number): Promise<void> {
    logger.info({ event: "alert_noop", type: "retry", pixelIndex });
  }

  async sendVrfFallback(pixelIndex?: number): Promise<void> {
    logger.info({ event: "alert_noop", type: "vrf", pixelIndex });
  }

  async sendProcessRestart(): Promise<void> {
    logger.info({ event: "alert_noop", type: "restart" });
  }

  async sendArweaveFailure(pixelIndex: number, error: string): Promise<void> {
    logger.info({ event: "alert_noop", type: "arweave", pixelIndex, error });
  }
}

/**
 * Telegram-backed Alerts implementation.
 * Wraps every sendMessage call in try/catch to prevent Telegram errors from
 * crashing the oracle or blocking the round lifecycle.
 */
class TelegramAlerts implements Alerts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bot: any;
  private chatId: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(bot: any, chatId: string) {
    this.bot = bot;
    this.chatId = chatId;
  }

  private async send(message: string, type: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message);
      logger.info({ event: "alert_sent", type });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ event: "alert_send_failed", type, error: errMsg });
    }
  }

  async sendSuccess(result: {
    pixelIndex: number;
    colorName: string;
    shade: number;
    warmth: number;
    poolSize?: number;
  }): Promise<void> {
    const msg = `Round ${result.pixelIndex} resolved: ${result.colorName} (shade ${result.shade}, warmth ${result.warmth})`;
    await this.send(msg, "success");
    logger.info({
      event: "alert_sent",
      type: "success",
      pixelIndex: result.pixelIndex,
      colorName: result.colorName,
    });
  }

  async sendRetryWarning(pixelIndex?: number): Promise<void> {
    const roundStr = pixelIndex !== undefined ? ` for round ${pixelIndex}` : "";
    const msg = `WARNING: Claude API failing. Entering retry cascade${roundStr}.`;
    await this.send(msg, "retry");
    logger.info({ event: "alert_sent", type: "retry", pixelIndex });
  }

  async sendVrfFallback(pixelIndex?: number): Promise<void> {
    const roundStr = pixelIndex !== undefined ? ` for round ${pixelIndex}` : "";
    const msg = `ALERT: VRF fallback triggered${roundStr}. Claude unavailable for 30+ minutes.`;
    await this.send(msg, "vrf");
    logger.info({ event: "alert_sent", type: "vrf", pixelIndex });
  }

  async sendProcessRestart(): Promise<void> {
    const msg = `Oracle process restarted. Recovering from chain state.`;
    await this.send(msg, "restart");
    logger.info({ event: "alert_sent", type: "restart" });
  }

  async sendArweaveFailure(pixelIndex: number, error: string): Promise<void> {
    const msg = `Arweave upload failed for pixel ${pixelIndex}: ${error}`;
    await this.send(msg, "arweave");
    logger.info({ event: "alert_sent", type: "arweave", pixelIndex, error });
  }
}

/**
 * Create an Alerts instance based on the oracle configuration.
 *
 * If `telegramBotToken` and `telegramChatId` are set, returns a live Telegram
 * implementation. Otherwise returns a no-op implementation that only logs.
 *
 * @param config - Oracle configuration (reads telegramBotToken, telegramChatId)
 * @returns Alerts instance (live Telegram or no-op)
 */
export function createAlerts(config: OracleConfig): Alerts {
  if (!config.telegramBotToken || !config.telegramChatId) {
    logger.warn({
      event: "alerts_noop_mode",
      warning: "Telegram not configured — alert notifications disabled",
    });
    return new NoopAlerts();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TelegramBot = require("node-telegram-bot-api") as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (token: string, options: { polling: boolean }): any;
    };
    const bot = new TelegramBot(config.telegramBotToken, { polling: false });
    logger.info({ event: "alerts_telegram_ready", chatId: config.telegramChatId });
    return new TelegramAlerts(bot, config.telegramChatId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({
      event: "alerts_telegram_init_failed",
      error: message,
      fallback: "Using no-op alerts",
    });
    return new NoopAlerts();
  }
}
