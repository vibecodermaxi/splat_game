import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG"
);

export const GRID_SIZE = 10;
export const TOTAL_PIXELS = 100;

/**
 * v2 active palette: 8 of the 16 on-chain color indices.
 *
 * The contract still has 16 color pools per pixel for backwards compatibility
 * with existing seasons, but the oracle only ever picks from these 8 and the
 * frontend only lets players bet on these 8. The remaining 8 pools stay empty.
 *
 * Indices map to the canonical COLOR_NAMES array in lib/color.ts:
 *   0=Red, 1=Orange, 2=Yellow, 4=Green, 7=Blue, 9=Purple, 14=Black, 15=White
 */
export const BETTABLE_COLOR_INDICES = [0, 1, 2, 4, 7, 9, 14, 15] as const;

// Current season — configurable via env var for deployment
export const CURRENT_SEASON = parseInt(
  process.env.NEXT_PUBLIC_CURRENT_SEASON || "1",
  10
);

// Timing constants (in seconds) — configurable via env var
// Set NEXT_PUBLIC_ROUND_DURATION_SECONDS in app/.env.local (default: 1800 = 30 min)
export const ROUND_DURATION_SECONDS = parseInt(
  process.env.NEXT_PUBLIC_ROUND_DURATION_SECONDS || "1800",
  10
);
// Lockout = last 1 minute of round (matches oracle's lockWindowMinutes)
export const LOCKOUT_SECONDS = 60;
export const BETTING_WINDOW_SECONDS = ROUND_DURATION_SECONDS - LOCKOUT_SECONDS;

// Polling / WebSocket intervals (in milliseconds)
// IMPORTANT: 60-second pool update cadence is intentional anti-sniping design — do NOT reduce
export const POOL_REFRESH_INTERVAL_MS = 60_000;
export const POLLING_FALLBACK_INTERVAL_MS = 15_000; // 15 seconds on WS disconnect
export const WS_PING_INTERVAL_MS = 60_000; // prevents Helius 10-min timeout

// Bet constraints
export const MIN_BET_SOL = 0.01;
export const MAX_BET_SOL = 10;
export const QUICK_BET_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1];

// Economics
export const RAKE_PERCENT = 5;
