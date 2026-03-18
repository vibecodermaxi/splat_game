"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { useGameStore } from "@/store/gameStore";
import { derivePixelPDA } from "@/lib/pda";
import { PROGRAM_ID, POOL_REFRESH_INTERVAL_MS } from "@/lib/constants";

/**
 * Compute payout multiplier for a color given its pool and total pool.
 * Returns "---" when either value is zero (no bets yet).
 * Formula: (totalPool * (1 - RAKE)) / colorPool, where RAKE = 5%
 */
export function computeMultiplier(colorPool: number, totalPool: number): string {
  if (colorPool === 0 || totalPool === 0) return "---";
  return `${((totalPool * 0.95) / colorPool).toFixed(1)}x`;
}

/**
 * Compute pool percentage for a given color.
 * Returns "0%" when totalPool is zero.
 */
export function computePoolPercent(colorPool: number, totalPool: number): string {
  if (totalPool === 0) return "0%";
  return `${((colorPool / totalPool) * 100).toFixed(0)}%`;
}

/**
 * Pool data refresh hook — 60-second cadence (intentional anti-sniping design).
 *
 * Fetches color pool data from on-chain PixelState account:
 * - On mount: fetches immediately
 * - Every 60 seconds: re-fetches (POOL_REFRESH_INTERVAL_MS = 60_000)
 * - On tab visibility change to visible: re-fetches immediately and resets interval
 *
 * DO NOT reduce the 60-second interval — it prevents last-second copycat sniping.
 */
export function useColorPools() {
  const program = useAnchorProgram();
  const { seasonNumber, currentPixelIndex, setPixelState, pixels } = useGameStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPools = useCallback(async () => {
    if (!program) return;

    try {
      const [pixelPDA] = derivePixelPDA(PROGRAM_ID, seasonNumber, currentPixelIndex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pixelState = await (program.account as any).pixelState.fetch(pixelPDA);

      // Convert BN[] to number[] (safe for SOL amounts under 9007 SOL)
      const colorPools: number[] = (pixelState.colorPools as Array<{ toNumber: () => number }>).map(
        (bn) => bn.toNumber()
      );
      const totalPool = colorPools.reduce((sum, v) => sum + v, 0);

      // Get existing pixel snapshot or build a minimal one
      const existing = pixels[currentPixelIndex];
      setPixelState(currentPixelIndex, {
        pixelIndex: currentPixelIndex,
        colorIndex: existing?.colorIndex ?? 0,
        shade: existing?.shade ?? 50,
        warmth: existing?.warmth ?? 50,
        status: existing?.status ?? "open",
        colorPools,
        totalPool,
        openedAtSeconds: existing?.openedAtSeconds ?? null,
        winningColor: existing?.winningColor ?? null,
        vrfResolved: existing?.vrfResolved ?? false,
        promptHash: existing?.promptHash ?? null,
        arweaveTxid: existing?.arweaveTxid ?? null,
        hasArweaveTxid: existing?.hasArweaveTxid ?? false,
      });
    } catch {
      // Silently ignore fetch errors — stale data is acceptable
    }
  }, [program, seasonNumber, currentPixelIndex, pixels, setPixelState]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(fetchPools, POOL_REFRESH_INTERVAL_MS);
  }, [fetchPools]);

  useEffect(() => {
    // Initial fetch on mount
    fetchPools();
    startInterval();

    // Re-fetch on tab visibility change to visible, reset interval
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchPools();
        startInterval();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchPools, startInterval]);

  return { computeMultiplier, computePoolPercent };
}
