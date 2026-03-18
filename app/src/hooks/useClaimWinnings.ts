"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import type { BetHistoryEntry } from "@/hooks/useBetHistory";

export interface UseClaimWinningsResult {
  claimSingle: (bet: BetHistoryEntry) => Promise<boolean>;
  claimAll: (bets: BetHistoryEntry[]) => Promise<number>;
  isClaiming: boolean;
  claimProgress: string | null;
  error: string | null;
  clearError: () => void;
}

/**
 * Transaction hook for claim_winnings Anchor instruction.
 *
 * Features:
 * - claimSingle: submits one claim_winnings instruction for a single bet.
 * - claimAll: loops sequentially (for...of, NOT Promise.all) through claimable bets.
 *   Sequential execution is REQUIRED because all claims write the same PlayerSeasonStats PDA.
 *   Parallel submission causes "account already in use" errors on Solana.
 * - Double-submit protection: calls are ignored while isClaiming = true.
 * - claimProgress string updated during claimAll (e.g., "Claiming 2 of 5...").
 */
export function useClaimWinnings(): UseClaimWinningsResult {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimProgress, setClaimProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const program = useAnchorProgram();
  const wallet = useWallet();

  const clearError = useCallback(() => setError(null), []);

  const claimSingle = useCallback(
    async (bet: BetHistoryEntry): Promise<boolean> => {
      // Double-submit protection
      if (isClaiming) return false;
      if (!program || !wallet.publicKey) return false;

      setIsClaiming(true);
      setError(null);

      try {
        await (program.methods as any)
          .claimWinnings()
          .accounts({
            pixelState: new PublicKey(bet.pixelPDA),
            betAccount: new PublicKey(bet.betPDA),
            playerSeasonStats: new PublicKey(bet.statsPDA),
            player: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Claim transaction failed. Please try again.";
        setError(message);
        return false;
      } finally {
        setIsClaiming(false);
        setClaimProgress(null);
      }
    },
    [isClaiming, program, wallet.publicKey]
  );

  const claimAll = useCallback(
    async (bets: BetHistoryEntry[]): Promise<number> => {
      // Double-submit protection
      if (isClaiming) return 0;
      if (!program || !wallet.publicKey) return 0;
      if (bets.length === 0) return 0;

      setIsClaiming(true);
      setError(null);
      let successCount = 0;

      try {
        // Sequential execution required — all claims write PlayerSeasonStats PDA.
        // Using for...of (not Promise.all) to avoid "account already in use" errors.
        for (let i = 0; i < bets.length; i++) {
          const bet = bets[i];
          setClaimProgress(`Claiming ${i + 1} of ${bets.length}...`);

          try {
            await (program.methods as any)
              .claimWinnings()
              .accounts({
                pixelState: new PublicKey(bet.pixelPDA),
                betAccount: new PublicKey(bet.betPDA),
                playerSeasonStats: new PublicKey(bet.statsPDA),
                player: wallet.publicKey,
                systemProgram: SystemProgram.programId,
              })
              .rpc({ commitment: "confirmed" });

            successCount++;
          } catch (err: unknown) {
            // Log individual failures but continue with remaining bets
            const message =
              err instanceof Error
                ? err.message
                : `Failed to claim bet for pixel #${bet.pixelIndex}.`;
            console.error(`Claim failed for pixel #${bet.pixelIndex}:`, message);
            // Set error but don't stop the loop
            setError(message);
          }
        }
      } finally {
        setIsClaiming(false);
        setClaimProgress(null);
      }

      return successCount;
    },
    [isClaiming, program, wallet.publicKey]
  );

  return { claimSingle, claimAll, isClaiming, claimProgress, error, clearError };
}
