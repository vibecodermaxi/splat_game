"use client";

import { useEffect, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "./useAnchorProgram";
import { useGameStore } from "@/store/gameStore";
import { PROGRAM_ID } from "@/lib/constants";
import { deriveSeasonPDA, derivePixelPDA } from "@/lib/pda";
import { WS_PING_INTERVAL_MS, POLLING_FALLBACK_INTERVAL_MS } from "@/lib/constants";
import type { PixelSnapshot } from "@/types/game";

/** Maps decoded Anchor PixelState to PixelSnapshot */
function decodePixelStateToSnapshot(decoded: Record<string, unknown>, pixelIndex: number): PixelSnapshot {
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

interface UseHeliusSocketParams {
  /** Active pixel PDA — null if not yet known */
  pixelPDA: PublicKey | null;
  /** Season PDA — always required */
  seasonPDA: PublicKey;
  /** Season number for decoding new pixel PDAs on round transitions */
  seasonNumber: number;
}

/**
 * Subscribes to PixelState and SeasonState account changes via Helius WebSocket.
 *
 * Features:
 * - 60-second ping via connection.getSlot() to prevent Helius 10-min timeout
 * - Polling fallback at 15-second interval when WebSocket disconnects
 * - Tab visibility change re-fetches immediately to prevent stale data
 * - All subscriptions and intervals cleaned up on unmount
 */
export function useHeliusSocket({
  pixelPDA,
  seasonPDA,
  seasonNumber,
}: UseHeliusSocketParams): void {
  const { connection } = useConnection();
  const program = useAnchorProgram();
  const { setPixelState, setSeasonState, setWsConnected } = useGameStore();

  // Track subscription IDs and interval handles for cleanup
  const pixelSubIdRef = useRef<number | null>(null);
  const seasonSubIdRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsConnectedRef = useRef(false);

  const clearPolling = () => {
    if (pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const startPolling = (pda: PublicKey, pixelIdx: number, prog: NonNullable<typeof program>) => {
    clearPolling();
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const accountInfo = await connection.getAccountInfo(pda);
        if (accountInfo) {
          const decoded = prog.coder.accounts.decode("PixelState", accountInfo.data) as Record<string, unknown>;
          const snapshot = decodePixelStateToSnapshot(decoded, pixelIdx);
          setPixelState(pixelIdx, snapshot);
        }
      } catch {
        // Polling failure — silently retry on next tick
      }
    }, POLLING_FALLBACK_INTERVAL_MS);
  };

  const fetchSeasonState = async (prog: NonNullable<typeof program>) => {
    try {
      const accountInfo = await connection.getAccountInfo(seasonPDA);
      if (accountInfo) {
        const decoded = prog.coder.accounts.decode("SeasonState", accountInfo.data) as {
          seasonNumber: number;
          currentPixelIndex: number;
        };
        setSeasonState(decoded.seasonNumber, decoded.currentPixelIndex);
      }
    } catch {
      // Non-fatal — will retry on next event
    }
  };

  useEffect(() => {
    if (!program || !pixelPDA) {
      return;
    }

    const prog = program;
    // We need pixelIndex to update the store — derive from the PDA by checking the store
    // For simplicity, use the store's currentPixelIndex at subscription setup time
    const currentPixelIndex = useGameStore.getState().currentPixelIndex;

    // --- Subscribe to PixelState ---
    const pixelSubId = connection.onAccountChange(
      pixelPDA,
      (info) => {
        try {
          const decoded = prog.coder.accounts.decode("PixelState", info.data) as Record<string, unknown>;
          const snapshot = decodePixelStateToSnapshot(decoded, currentPixelIndex);
          setPixelState(currentPixelIndex, snapshot);

          // Mark WS as connected on first successful callback
          if (!wsConnectedRef.current) {
            wsConnectedRef.current = true;
            setWsConnected(true);
            clearPolling(); // WS is working — stop polling
          }

          // If pixel just resolved, re-fetch SeasonState to get new currentPixelIndex
          if (snapshot.status === "resolved") {
            void fetchSeasonState(prog);
          }
        } catch {
          // Decode failure — ignore this event
        }
      },
      "confirmed"
    );
    pixelSubIdRef.current = pixelSubId;

    // --- Subscribe to SeasonState ---
    const seasonSubId = connection.onAccountChange(
      seasonPDA,
      (info) => {
        try {
          const decoded = prog.coder.accounts.decode("SeasonState", info.data) as {
            seasonNumber: number;
            currentPixelIndex: number;
          };
          setSeasonState(decoded.seasonNumber, decoded.currentPixelIndex);

          if (!wsConnectedRef.current) {
            wsConnectedRef.current = true;
            setWsConnected(true);
            clearPolling();
          }
        } catch {
          // Ignore decode failure
        }
      },
      "confirmed"
    );
    seasonSubIdRef.current = seasonSubId;

    // --- 60-second ping to keep Helius WebSocket alive ---
    pingIntervalRef.current = setInterval(() => {
      void connection.getSlot().catch(() => {
        // Ping failure means WS may be dead — activate polling fallback
        if (wsConnectedRef.current) {
          wsConnectedRef.current = false;
          setWsConnected(false);
          startPolling(pixelPDA, currentPixelIndex, prog);
        }
      });
    }, WS_PING_INTERVAL_MS);

    // --- Tab visibility change: re-fetch on tab becoming visible ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Immediately re-fetch to prevent stale data from browser throttling
        void fetchSeasonState(prog);
        connection.getAccountInfo(pixelPDA).then((accountInfo) => {
          if (accountInfo) {
            try {
              const decoded = prog.coder.accounts.decode("PixelState", accountInfo.data) as Record<string, unknown>;
              const snapshot = decodePixelStateToSnapshot(decoded, currentPixelIndex);
              setPixelState(currentPixelIndex, snapshot);
            } catch {
              // Ignore
            }
          }
        }).catch(() => {
          // Non-fatal
        });

        // Reset ping interval to ensure fresh start
        if (pingIntervalRef.current !== null) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          void connection.getSlot().catch(() => {
            if (wsConnectedRef.current) {
              wsConnectedRef.current = false;
              setWsConnected(false);
              startPolling(pixelPDA, currentPixelIndex, prog);
            }
          });
        }, WS_PING_INTERVAL_MS);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // --- Cleanup ---
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (pixelSubIdRef.current !== null) {
        void connection.removeAccountChangeListener(pixelSubIdRef.current);
        pixelSubIdRef.current = null;
      }
      if (seasonSubIdRef.current !== null) {
        void connection.removeAccountChangeListener(seasonSubIdRef.current);
        seasonSubIdRef.current = null;
      }
      if (pingIntervalRef.current !== null) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      clearPolling();
    };
  }, [program, pixelPDA, seasonPDA, connection, setPixelState, setSeasonState, setWsConnected]);
}
