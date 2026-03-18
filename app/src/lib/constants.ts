import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG"
);

export const GRID_SIZE = 10;
export const TOTAL_PIXELS = 100;

// Timing constants (in seconds)
export const ROUND_DURATION_SECONDS = 1800; // 30 minutes
export const LOCKOUT_SECONDS = 120; // final 2 minutes
export const BETTING_WINDOW_SECONDS = 1680; // 28 minutes

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
