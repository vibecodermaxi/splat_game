import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG"
);

export const GRID_SIZE = 20;
export const TOTAL_PIXELS = 400;

// Timing constants (in seconds) — configurable via env var
// Set NEXT_PUBLIC_ROUND_DURATION_SECONDS in app/.env.local (default: 1800 = 30 min)
export const ROUND_DURATION_SECONDS = parseInt(
  process.env.NEXT_PUBLIC_ROUND_DURATION_SECONDS || "1800",
  10
);
// Lockout = last 2 minutes of round (matches oracle's lockWindowMinutes)
export const LOCKOUT_SECONDS = 120;
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
