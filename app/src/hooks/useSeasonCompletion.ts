"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "./useAnchorProgram";
import { PROGRAM_ID } from "@/lib/constants";
import { deriveSeasonPDA } from "@/lib/pda";

export interface SeasonCompletionState {
  seasonStatus: "active" | "completed" | "intermission";
  completedAtSeconds: number | null;
  intermissionEndsSeconds: number | null;
  seasonNumber: number;
}

interface UseSeasonCompletionResult {
  state: SeasonCompletionState;
  loading: boolean;
  refresh: () => void;
}

const DEFAULT_STATE: SeasonCompletionState = {
  seasonStatus: "active",
  completedAtSeconds: null,
  intermissionEndsSeconds: null,
  seasonNumber: 1,
};

/**
 * Hook that fetches the SeasonState account and decodes the season status.
 * Detects when a season is completed or in intermission.
 *
 * - Fetches on mount and exposes a refresh() callback for manual refresh.
 * - Reads completedAt (camelCase from Anchor decoder) to compute intermissionEndsSeconds.
 */
export function useSeasonCompletion(seasonNumber: number = 1): UseSeasonCompletionResult {
  const { connection } = useConnection();
  const program = useAnchorProgram();

  const [state, setState] = useState<SeasonCompletionState>({
    ...DEFAULT_STATE,
    seasonNumber,
  });
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    // We can still fetch with a read-only connection even without a wallet
    let cancelled = false;

    async function fetchSeasonStatus() {
      setLoading(true);

      try {
        const [seasonPDA] = deriveSeasonPDA(PROGRAM_ID, seasonNumber);
        const accountInfo = await connection.getAccountInfo(seasonPDA);

        if (!accountInfo || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Need the Anchor coder — if program is null (no wallet), fall back gracefully
        if (!program) {
          if (!cancelled) setLoading(false);
          return;
        }

        const decoded = program.coder.accounts.decode("SeasonState", accountInfo.data) as {
          seasonNumber: number;
          currentPixelIndex: number;
          status: { active?: object; completed?: object; intermission?: object };
          completedAt: bigint | number | null;
        };

        if (cancelled) return;

        // Decode status enum
        const statusRaw = decoded.status;
        let seasonStatus: "active" | "completed" | "intermission" = "active";
        if (statusRaw.completed !== undefined) seasonStatus = "completed";
        else if (statusRaw.intermission !== undefined) seasonStatus = "intermission";

        // Decode completedAt — Anchor uses camelCase (Pitfall 5)
        const completedAt = decoded.completedAt;
        const completedAtSeconds =
          completedAt !== null && completedAt !== undefined
            ? Number(completedAt)
            : null;

        const intermissionEndsSeconds =
          completedAtSeconds !== null ? completedAtSeconds + 12 * 3600 : null;

        setState({
          seasonStatus,
          completedAtSeconds,
          intermissionEndsSeconds,
          seasonNumber: decoded.seasonNumber ?? seasonNumber,
        });
      } catch {
        // Season account doesn't exist yet — treat as active
        if (!cancelled) {
          setState({ ...DEFAULT_STATE, seasonNumber });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSeasonStatus();

    return () => {
      cancelled = true;
    };
  }, [program, connection, seasonNumber, refreshTick]);

  return { state, loading, refresh };
}
