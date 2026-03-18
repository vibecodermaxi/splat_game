"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { COLOR_NAMES, BASE_HEX, computePixelColor } from "@/lib/color";

export interface ResolvedPixel {
  pixelIndex: number;
  winningColor: number;
  winningColorHex: string;
  winningColorName: string;
}

export interface Resolution {
  type: "win" | "loss";
  winningColor: number;
  winningColorName: string;
  payoutSol?: number;
}

export interface UseResolutionResult {
  resolution: Resolution | null;
  resolvedPixel: ResolvedPixel | null;
  clearResolution: () => void;
}

/**
 * Detects status → "resolved" transitions on the active pixel and computes win/loss.
 *
 * Watches: activePixelData.status (via prevStatusRef)
 * On "resolved" transition:
 *   - Sets resolvedPixel with winningColor and hex
 *   - Determines win/loss based on playerBet.colorIndex vs winningColor
 *   - Computes estimated payout for wins: (amount / colorPools[winningColor]) * totalPool * 0.95
 *   - Schedules clearForNewRound after 2.5s total animation duration
 */
export function useResolution(): UseResolutionResult {
  const currentPixelIndex = useGameStore((s) => s.currentPixelIndex);
  const pixels = useGameStore((s) => s.pixels);
  const playerBet = useGameStore((s) => s.playerBet);
  const clearForNewRound = useGameStore((s) => s.clearForNewRound);

  const activePixelData = pixels[currentPixelIndex] ?? null;

  const [resolvedPixel, setResolvedPixel] = useState<ResolvedPixel | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);

  const prevStatusRef = useRef<string | null>(null);
  // Track previous pixel index so we reset when the pixel changes
  const prevPixelIndexRef = useRef<number>(currentPixelIndex);

  useEffect(() => {
    const currentStatus = activePixelData?.status ?? null;
    const prevStatus = prevStatusRef.current;

    // If pixel index changed, reset tracking
    if (currentPixelIndex !== prevPixelIndexRef.current) {
      prevStatusRef.current = currentStatus;
      prevPixelIndexRef.current = currentPixelIndex;
      return;
    }

    // Detect transition to "resolved"
    if (
      currentStatus === "resolved" &&
      prevStatus !== "resolved" &&
      prevStatus !== null
    ) {
      const winningColorIdx = activePixelData?.winningColor ?? null;

      if (winningColorIdx !== null) {
        const winningColorName = COLOR_NAMES[winningColorIdx] ?? "Unknown";
        const baseHex = BASE_HEX[winningColorName];
        const shade = activePixelData?.shade ?? 50;
        const warmth = activePixelData?.warmth ?? 50;

        let winningColorHex = baseHex;
        try {
          winningColorHex = computePixelColor(winningColorIdx, shade, warmth);
        } catch {
          winningColorHex = baseHex;
        }

        const resolved: ResolvedPixel = {
          pixelIndex: currentPixelIndex,
          winningColor: winningColorIdx,
          winningColorHex,
          winningColorName,
        };
        setResolvedPixel(resolved);

        // Determine win/loss
        const isWin =
          playerBet !== null && playerBet.colorIndex === winningColorIdx;

        let payoutSol: number | undefined;
        if (isWin && playerBet && activePixelData) {
          const colorPool = activePixelData.colorPools[winningColorIdx] ?? 0;
          const totalPool = activePixelData.totalPool;
          if (colorPool > 0) {
            // payout in lamports → convert to SOL
            const payoutLamports =
              (playerBet.amount / colorPool) * totalPool * 0.95;
            payoutSol = payoutLamports / 1e9;
          }
        }

        setResolution({
          type: isWin ? "win" : "loss",
          winningColor: winningColorIdx,
          winningColorName,
          payoutSol,
        });

        // Clear for next round after 2.5s (resolution animations complete by then)
        const timer = setTimeout(() => {
          clearForNewRound();
        }, 2500);

        return () => clearTimeout(timer);
      }
    }

    prevStatusRef.current = currentStatus;
  }, [
    activePixelData,
    currentPixelIndex,
    playerBet,
    clearForNewRound,
  ]);

  const clearResolution = () => {
    setResolution(null);
    setResolvedPixel(null);
  };

  return { resolution, resolvedPixel, clearResolution };
}
