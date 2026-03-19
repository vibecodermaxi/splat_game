"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "./useAnchorProgram";
import { useGameStore } from "@/store/gameStore";
import { PROGRAM_ID } from "@/lib/constants";
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
  const totalPool = typeof decoded.totalPool === "bigint"
    ? Number(decoded.totalPool)
    : (decoded.totalPool as number) ?? 0;

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
    colorPools: colorPools.map((v) => (typeof v === "bigint" ? Number(v) : v)),
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
export function useSeasonData(initialSeasonNumber: number = 1): UseSeasonDataResult {
  const { connection } = useConnection();
  const program = useAnchorProgram();
  const wallet = useAnchorWallet();
  // Get stable references to store actions (won't change between renders)
  const setSeasonState = useGameStore((s) => s.setSeasonState);
  const setPixelState = useGameStore((s) => s.setPixelState);
  const setPlayerBet = useGameStore((s) => s.setPlayerBet);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch season + pixel data (public, no wallet needed) — runs ONCE when program is available
  useEffect(() => {
    if (hasFetched) return;

    let cancelled = false;

    async function fetchPublicData() {
      setLoading(true);
      setError(null);

      try {
        // --- 1. Fetch SeasonState ---
        const seasonNumber = initialSeasonNumber;
        const [seasonPDA] = deriveSeasonPDA(PROGRAM_ID, seasonNumber);
        console.log("[useSeasonData] RPC endpoint:", connection.rpcEndpoint);
        console.log("[useSeasonData] Program ID:", PROGRAM_ID.toBase58());
        console.log("[useSeasonData] Season PDA derived:", seasonPDA.toBase58(), "for season", seasonNumber);
        const seasonAccountInfo = await connection.getAccountInfo(seasonPDA);
        console.log("[useSeasonData] getAccountInfo result:", seasonAccountInfo ? `${seasonAccountInfo.data.length} bytes` : "null");
        if (!seasonAccountInfo || cancelled) {
          console.warn("[useSeasonData] Season account not found on-chain for season", seasonNumber);
          return;
        }

        // Decode using program coder if available, otherwise use raw AccountInfo
        if (!program) {
          console.log("[useSeasonData] No program yet — setting season number only");
          if (!cancelled) setSeasonState(seasonNumber, 0);
          return;
        }

        // Try program.coder first, fall back to manual decode
        let decodedSeason: { currentPixelIndex: number; seasonNumber: number };
        try {
          decodedSeason = program.coder.accounts.decode("SeasonState", seasonAccountInfo.data) as {
            currentPixelIndex: number;
            seasonNumber: number;
          };
        } catch (decodeErr) {
          console.warn("[useSeasonData] program.coder.decode failed, trying manual decode:", decodeErr);
          // Manual decode: skip 8-byte discriminator, then read fields per IDL
          // SeasonState layout: disc(8) + season_number(u16) + grid_width(u8) + grid_height(u8) + current_pixel_index(u16) + ...
          const data = seasonAccountInfo.data;
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
          const sn = view.getUint16(8, true);  // offset 8, little-endian
          // grid_width(1) + grid_height(1) at offset 10-11
          const cpi = view.getUint16(12, true); // offset 12
          decodedSeason = { seasonNumber: sn, currentPixelIndex: cpi };
          console.log("[useSeasonData] Manual decode:", decodedSeason);
        }

        const currentPixelIndex = decodedSeason.currentPixelIndex;
        console.log("[useSeasonData] Loaded season", seasonNumber, "pixel", currentPixelIndex);
        if (!cancelled) {
          setSeasonState(seasonNumber, currentPixelIndex);
        }

        // --- 2. Batch-fetch all pixel states (0 to currentPixelIndex) ---
        const pixelIndices = Array.from({ length: currentPixelIndex + 1 }, (_, i) => i);
        const pixelPDAs = pixelIndices.map((i) => derivePixelPDA(PROGRAM_ID, seasonNumber, i)[0]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pixelAccounts = await (program.account as any)["pixelState"].fetchMultiple(pixelPDAs);

        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pixelAccounts as any[]).forEach((decoded: unknown, idx: number) => {
          if (decoded) {
            const snapshot = decodePixelState(decoded as Record<string, unknown>, pixelIndices[idx]);
            setPixelState(pixelIndices[idx], snapshot);
          }
        });
        if (!cancelled) setHasFetched(true);
      } catch (err) {
        console.error("[useSeasonData] Failed to load:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load season data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchPublicData();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, connection, hasFetched]);

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
