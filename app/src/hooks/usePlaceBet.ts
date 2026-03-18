"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { useGameStore } from "@/store/gameStore";
import { derivePixelPDA, deriveBetPDA, deriveStatsPDA } from "@/lib/pda";
import { PROGRAM_ID } from "@/lib/constants";

export interface PlaceBetResult {
  placeBet: (colorIndex: number, amountSol: number) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Transaction builder for the place_bet Anchor instruction.
 *
 * Features:
 * - Double-submit protection: ignores calls while isSubmitting = true
 * - Derives all PDAs (pixel, bet, stats) from store state
 * - Converts SOL amount to lamports via BN
 * - Updates store with optimistic player bet state on success
 * - Exposes error string and clearError for UI feedback
 */
export function usePlaceBet(): PlaceBetResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const program = useAnchorProgram();
  const wallet = useWallet();
  const { seasonNumber, currentPixelIndex, setPlayerBet } = useGameStore();

  const placeBet = useCallback(
    async (colorIndex: number, amountSol: number) => {
      // Guard: prevent double-submit (Pitfall 6)
      if (isSubmitting) return;

      // Guard: require wallet and program
      if (!program || !wallet.publicKey) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // Derive all PDAs
        const [pixelPDA] = derivePixelPDA(PROGRAM_ID, seasonNumber, currentPixelIndex);
        const [betPDA] = deriveBetPDA(PROGRAM_ID, seasonNumber, currentPixelIndex, wallet.publicKey);
        const [statsPDA] = deriveStatsPDA(PROGRAM_ID, seasonNumber, wallet.publicKey);

        // Convert amount to lamports as BN
        const amountLamports = new BN(Math.floor(amountSol * LAMPORTS_PER_SOL));

        // Submit on-chain transaction
        await (program.methods as any)
          .placeBet(colorIndex, amountLamports)
          .accounts({
            pixelState: pixelPDA,
            betAccount: betPDA,
            playerSeasonStats: statsPDA,
            player: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        // Optimistic UI update on success
        setPlayerBet({
          colorIndex,
          amount: Math.floor(amountSol * LAMPORTS_PER_SOL),
          claimed: false,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Transaction failed. Please try again.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, program, wallet.publicKey, seasonNumber, currentPixelIndex, setPlayerBet]
  );

  const clearError = useCallback(() => setError(null), []);

  return { placeBet, isSubmitting, error, clearError };
}
