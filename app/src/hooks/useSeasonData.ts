"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "./useAnchorProgram";
import { useGameStore } from "@/store/gameStore";
import { PROGRAM_ID, CURRENT_SEASON } from "@/lib/constants";
import { deriveSeasonPDA, derivePixelPDA, deriveBetPDA } from "@/lib/pda";
import type { PixelSnapshot, BetState } from "@/types/game";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

/** Maps decoded Anchor PixelState to our PixelSnapshot shape */
function decodePixelState(decoded: Record<string, unknown>, pixelIndex: number): PixelSnapshot {
  // RoundStatus enum from Anchor: { open: {} } | { locked: {} } | { resolved: {} }
  const statusRaw = decoded.status as { open?: object; locked?: object; resolved?: object };
  let status: "open" | "locked" | "resolved" = "open";
  if (statusRaw.locked !== undefined) status = "locked";
  else if (statusRaw.resolved !== undefined) status = "resolved";

  const colorPools = decoded.colorPools as (number | bigint)[] | null ?? new Array(16).fill(0);
  const rawTotalPool = decoded.totalPool;
  const totalPool = typeof rawTotalPool === "bigint"
    ? Number(rawTotalPool)
    : typeof rawTotalPool === "number"
    ? rawTotalPool
    : rawTotalPool && typeof (rawTotalPool as any).toNumber === "function"
    ? (rawTotalPool as any).toNumber()
    : 0;

  const shade = decoded.shade as number | null ?? 50;
  const warmth = decoded.warmth as number | null ?? 50;
  const winningColor = decoded.winningColor as number | null ?? null;
  // colorIndex is the AI's winning color for resolved pixels, or 0 for non-resolved
  const colorIndex = winningColor !== null ? winningColor : 0;

  const openedAt = decoded.openedAt as bigint | number | null;
  const openedAtSeconds = openedAt !== null ? Number(openedAt) : null;

  // Decode commit-reveal proof fields — only available for resolved pixels
  let promptHash: number[] | null = null;
  let arweaveTxid: string | null = null;
  let hasArweaveTxid = false;

  if (status === "resolved") {
    const rawPromptHash = decoded.promptHash as number[] | null;
    promptHash = Array.isArray(rawPromptHash) ? rawPromptHash : null;

    hasArweaveTxid = (decoded.hasArweaveTxid as boolean) ?? false;
    if (hasArweaveTxid) {
      const txidBytes = decoded.arweaveTxid as number[] | null;
      arweaveTxid = Array.isArray(txidBytes)
        ? String.fromCharCode(...txidBytes)
        : null;
    }
  }

  return {
    pixelIndex,
    colorIndex,
    shade,
    warmth,
    status,
    colorPools: colorPools.map((v) => {
      if (typeof v === "bigint") return Number(v);
      if (typeof v === "number") return v;
      // BN objects from Anchor have toNumber()
      if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
      return Number(v) || 0;
    }),
    totalPool,
    openedAtSeconds,
    winningColor,
    vrfResolved: (decoded.vrfResolved as boolean) ?? false,
    promptHash,
    arweaveTxid,
    hasArweaveTxid,
  };
}

interface UseSeasonDataResult {
  loading: boolean;
  error: string | null;
}

/**
 * On mount, fetches the current SeasonState and all pixel states
 * (0 to currentPixelIndex inclusive), then updates the Zustand store.
 *
 * Also fetches the player's BetAccount for the active pixel if wallet is connected.
 */
export function useSeasonData(initialSeasonNumber: number = CURRENT_SEASON): UseSeasonDataResult {
  const { connection } = useConnection();
  const program = useAnchorProgram();
  const wallet = useAnchorWallet();
  // Get stable references to store actions (won't change between renders)
  const setSeasonState = useGameStore((s) => s.setSeasonState);
  const setPixelState = useGameStore((s) => s.setPixelState);
  const setPlayerBet = useGameStore((s) => s.setPlayerBet);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch season + pixel data, then poll every 10s for updates
  useEffect(() => {
    if (!program) return;

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchData() {
      try {
        const seasonNumber = initialSeasonNumber;
        const [seasonPDA] = deriveSeasonPDA(PROGRAM_ID, seasonNumber);
        const seasonAccountInfo = await connection.getAccountInfo(seasonPDA);
        if (!seasonAccountInfo || cancelled) return;

        // Manual decode (browser Anchor coder has issues)
        const data = seasonAccountInfo.data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const sn = view.getUint16(8, true);
        const cpi = view.getUint16(12, true);

        if (!cancelled) {
          useGameStore.getState().setSeasonState(sn, cpi);
        }

        // Batch-fetch all pixel states (0 to currentPixelIndex)
        const pixelIndices = Array.from({ length: cpi + 1 }, (_, i) => i);
        const pixelPDAs = pixelIndices.map((i) => derivePixelPDA(PROGRAM_ID, sn, i)[0]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pixelAccounts = await (program!.account as any)["pixelState"].fetchMultiple(pixelPDAs);

        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pixelAccounts as any[]).forEach((decoded: unknown, idx: number) => {
          if (decoded) {
            const snapshot = decodePixelState(decoded as Record<string, unknown>, pixelIndices[idx]);
            useGameStore.getState().setPixelState(pixelIndices[idx], snapshot);
          }
        });
      } catch (err) {
        if (!cancelled) {
          console.error("[useSeasonData] Fetch error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Initial fetch
    fetchData();

    // Poll every 10 seconds for round state changes
    pollInterval = setInterval(fetchData, 10_000);

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  // Fetch player's BetAccount (requires wallet)
  useEffect(() => {
    if (!program || !wallet?.publicKey) return;

    const seasonNumber = initialSeasonNumber;
    const currentPixelIndex = useGameStore.getState().currentPixelIndex;

    let cancelled = false;

    async function fetchBet() {
      try {
        const [betPDA] = deriveBetPDA(
          PROGRAM_ID,
          seasonNumber,
          currentPixelIndex,
          wallet!.publicKey!
        );
        const betInfo = await connection.getAccountInfo(betPDA);
        if (betInfo && !cancelled) {
          const decodedBet = program!.coder.accounts.decode("BetAccount", betInfo.data) as {
            color: number;
            amount: bigint | number;
            claimed: boolean;
          };
          const betState: BetState = {
            colorIndex: decodedBet.color,
            amount: typeof decodedBet.amount === "bigint"
              ? Number(decodedBet.amount)
              : decodedBet.amount,
            claimed: decodedBet.claimed,
          };
          setPlayerBet(betState);
        } else if (!cancelled) {
          setPlayerBet(null);
        }
      } catch {
        if (!cancelled) setPlayerBet(null);
      }
    }

    void fetchBet();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, wallet?.publicKey]);

  return { loading, error };
}
