import { create } from "zustand";
import type { GameState, PixelSnapshot, BetState } from "@/types/game";

export const useGameStore = create<GameState>()((set) => ({
  // Initial state
  seasonNumber: 0,
  currentPixelIndex: 0,
  pixels: {},
  playerBet: null,
  wsConnected: false,

  // Upsert a pixel's state into the canvas record
  setPixelState: (pixelIndex: number, data: PixelSnapshot) =>
    set((state) => ({
      pixels: {
        ...state.pixels,
        [pixelIndex]: data,
      },
    })),

  // Update season-level tracking
  setSeasonState: (seasonNumber: number, currentPixelIndex: number) =>
    set({ seasonNumber, currentPixelIndex }),

  // Set or clear the current player's bet
  setPlayerBet: (bet: BetState | null) => set({ playerBet: bet }),

  // Track WebSocket connection state
  setWsConnected: (connected: boolean) => set({ wsConnected: connected }),

  // Reset per-round state; preserve canvas pixels for history
  clearForNewRound: () => set({ playerBet: null }),
}));
