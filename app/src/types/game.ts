/**
 * Snapshot of a single pixel's on-chain state for frontend rendering.
 */
export interface PixelSnapshot {
  pixelIndex: number;
  colorIndex: number;
  shade: number;
  warmth: number;
  status: "open" | "locked" | "resolved";
  /** 16 values in lamports as number, indexed by colorIndex */
  colorPools: number[];
  totalPool: number;
  openedAtSeconds: number | null;
  winningColor: number | null;
  vrfResolved: boolean;
  /** [u8; 32] decoded as number array — the AI prompt hash committed before reveal. null for unresolved pixels. */
  promptHash: number[] | null;
  /** 43-char Arweave transaction ID string, null if hasArweaveTxid is false */
  arweaveTxid: string | null;
  /** Mirrors on-chain has_arweave_txid flag */
  hasArweaveTxid: boolean;
}

/**
 * Player's bet state for the current active pixel.
 */
export interface BetState {
  colorIndex: number;
  amount: number; // lamports
  claimed: boolean;
}

/**
 * Round state for display (timer, progress, etc.)
 */
export interface RoundState {
  seasonNumber: number;
  currentPixelIndex: number;
  timeRemainingSeconds: number | null;
}

/**
 * Full Zustand game state + actions.
 */
export interface GameState {
  // State
  seasonNumber: number;
  currentPixelIndex: number;
  pixels: Record<number, PixelSnapshot>;
  playerBet: BetState | null;
  wsConnected: boolean;

  // Actions
  setPixelState: (pixelIndex: number, data: PixelSnapshot) => void;
  setSeasonState: (seasonNumber: number, currentPixelIndex: number) => void;
  setPlayerBet: (bet: BetState | null) => void;
  setWsConnected: (connected: boolean) => void;
  clearForNewRound: () => void;
}
