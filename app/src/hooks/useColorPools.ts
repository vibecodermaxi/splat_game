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
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const currentPixelIndex = useGameStore((s) => s.currentPixelIndex);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!program || seasonNumber === 0) return;

    const fetchPools = async () => {
      try {
        const [pixelPDA] = derivePixelPDA(PROGRAM_ID, seasonNumber, currentPixelIndex);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pixelState = await (program.account as any).pixelState.fetch(pixelPDA);

        const colorPools: number[] = (pixelState.colorPools as Array<{ toNumber: () => number }>).map(
          (bn) => bn.toNumber()
        );
        const totalPool = colorPools.reduce((sum, v) => sum + v, 0);

        const existing = useGameStore.getState().pixels[currentPixelIndex];
        useGameStore.getState().setPixelState(currentPixelIndex, {
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
        // Silently ignore — stale data is acceptable
      }
    };

    // Fetch once on mount, then every 60s
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPools();
    }

    intervalRef.current = setInterval(fetchPools, POOL_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // Only re-run when program becomes available or pixel changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, seasonNumber, currentPixelIndex]);

  return { computeMultiplier, computePoolPercent };
}
