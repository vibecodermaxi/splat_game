import * as dotenv from "dotenv";
import { Keypair } from "@solana/web3.js";

/**
 * Typed configuration object for the oracle service.
 * All values are loaded and validated from environment variables at startup.
 */
export interface OracleConfig {
  solanaRpcUrl: string;
  oracleKeypair: Keypair;
  anthropicApiKey: string;
  programId: string;
  treasuryWallet: string;
  jackpotWallet: string;
  currentSeason: number;
  seasonStyleSummary: string;
  telegramBotToken: string | undefined;
  telegramChatId: string | undefined;
  roundDurationMinutes: number;    // Total round duration (default 30)
  bettingWindowMinutes: number;    // Betting window (derived: roundDuration - 2)
  lockWindowMinutes: number;       // Lock window (always 2 minutes)
  tickIntervalMs: number;          // Ticker interval in milliseconds (default 90s)
}

/**
 * Load and validate all required environment variables.
 * Calls dotenv.config() for local development (.env file support).
 * Exits the process immediately with a clear error message if any required vars are missing.
 */
export function loadConfig(): OracleConfig {
  // Load .env file for local development
  dotenv.config();

  // Check for all required environment variables
  const required = [
    "SOLANA_RPC_URL",
    "ORACLE_KEYPAIR",
    "ANTHROPIC_API_KEY",
    "PROGRAM_ID",
    "CURRENT_SEASON",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[oracle] Fatal: Missing required environment variables:\n  ${missing.join("\n  ")}\n\nSee .env.example for reference.`
    );
    process.exit(1);
  }

  // Parse the oracle keypair from JSON array format
  let oracleKeypair: Keypair;
  try {
    const rawKeypair = JSON.parse(process.env.ORACLE_KEYPAIR!.trim());
    if (!Array.isArray(rawKeypair) || rawKeypair.length !== 64) {
      throw new Error(
        `ORACLE_KEYPAIR must be a JSON array of 64 bytes, got array of length ${Array.isArray(rawKeypair) ? rawKeypair.length : "non-array"}`
      );
    }
    oracleKeypair = Keypair.fromSecretKey(Uint8Array.from(rawKeypair));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[oracle] Fatal: Failed to parse ORACLE_KEYPAIR. Ensure it is a JSON array of 64 bytes (e.g., from 'solana-keygen' output).\n  Error: ${message}`
    );
    process.exit(1);
  }

  // Parse season number
  const currentSeason = parseInt(process.env.CURRENT_SEASON!, 10);
  if (isNaN(currentSeason) || currentSeason < 1) {
    console.error(
      `[oracle] Fatal: CURRENT_SEASON must be a positive integer, got: ${process.env.CURRENT_SEASON}`
    );
    process.exit(1);
  }

  // Parse round duration — optional, defaults to 30 minutes
  const roundDurationMinutes = parseInt(process.env.ROUND_DURATION_MINUTES || "30", 10);
  if (isNaN(roundDurationMinutes) || roundDurationMinutes < 3) {
    console.error("[oracle] Fatal: ROUND_DURATION_MINUTES must be >= 3");
    process.exit(1);
  }
  const lockWindowMinutes = 1;
  const bettingWindowMinutes = roundDurationMinutes - lockWindowMinutes;
  const tickIntervalMs =
    parseInt(process.env.TICK_INTERVAL_SECONDS || "90", 10) * 1000;

  // Optional Telegram configuration — warn but do not exit if missing
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || undefined;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || undefined;
  if (!telegramBotToken || !telegramChatId) {
    console.warn(
      "[oracle] Warning: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — monitoring alerts disabled."
    );
  }

  return {
    solanaRpcUrl: process.env.SOLANA_RPC_URL!,
    oracleKeypair,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    programId: process.env.PROGRAM_ID!,
    treasuryWallet: process.env.TREASURY_WALLET || "6vTe3xRjB4Hv4fN4WQ5xtcF21Ed12DFPoNwHJTZDUg5v",
    jackpotWallet: process.env.JACKPOT_WALLET || "HrfnbCNRzvekRkdUJGzvmEu478F43uk7weReNDPqv2TB",
    currentSeason,
    seasonStyleSummary:
      process.env.SEASON_STYLE_SUMMARY ||
      `Paint a fantasy world divided into 4 elemental quadrants. Each quadrant has its own palette of 3 colors:

- Top-left (rows 0-4, cols 0-4): FIRE region. Use Red, Orange, Yellow.
- Top-right (rows 0-4, cols 5-9): WATER region. Use Blue, Purple, White.
- Bottom-left (rows 5-9, cols 0-4): EARTH region. Use Green, Yellow, Black.
- Bottom-right (rows 5-9, cols 5-9): VOID region. Use Black, Purple, White.

Within each quadrant, distribute the 3 colors roughly evenly — do not let any single color dominate. The exact placement of each color within a quadrant should feel organic and varied, not gridded.

Where two quadrants meet (along the dividing lines), allow some bleeding: a fire pixel might leak into the water region, an earth pixel might leak into the void. These boundary surprises should happen on roughly 1 in 4 boundary pixels.

Wild card rule: roughly 1 in 8 pixels anywhere on the canvas should be a "rift" pixel — pick a color from a DIFFERENT quadrant's palette than the one this pixel belongs to. Spread these throughout. Rifts make the canvas feel alive and unpredictable.`,
    telegramBotToken,
    telegramChatId,
    roundDurationMinutes,
    bettingWindowMinutes,
    lockWindowMinutes,
    tickIntervalMs,
  };
}
