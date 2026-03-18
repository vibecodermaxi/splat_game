"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { useGameStore } from "@/store/gameStore";
import { derivePixelPDA, deriveStatsPDA } from "@/lib/pda";
import { PROGRAM_ID } from "@/lib/constants";

/**
 * A single player bet entry resolved from on-chain BetAccount data.
 */
export interface BetHistoryEntry {
  pixelIndex: number;
  colorIndex: number;
  amount: number; // lamports
  claimed: boolean;
  seasonNumber: number;
  betPDA: string; // base58 PublicKey string
  pixelPDA: string; // base58 PublicKey string for claim accounts
  statsPDA: string; // base58 PublicKey string for claim accounts
}

/**
 * Player season statistics derived from the PlayerSeasonStats on-chain account.
 */
export interface PlayerStats {
  totalBets: number;
  totalVolume: number; // lamports
  correctPredictions: number;
  hitRate: string; // e.g. "42.5"
}

export interface UseBetHistoryResult {
  bets: BetHistoryEntry[];
  stats: PlayerStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches all BetAccount PDAs for the connected player using a memcmp filter on
 * the player pubkey field (byte offset 8 after 8-byte discriminator).
 *
 * Also fetches PlayerSeasonStats PDA to populate season-level stats.
 *
 * - Fetch is triggered on initial mount (if wallet connected) and on every refresh() call.
 * - Results are stored in local state — no polling.
 * - (program.account as any) cast is required for Anchor AccountNamespace<Idl> camelCase access.
 */
export function useBetHistory(): UseBetHistoryResult {
  const [bets, setBets] = useState<BetHistoryEntry[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const program = useAnchorProgram();
  const wallet = useWallet();
  const { seasonNumber } = useGameStore();

  const refresh = useCallback(async () => {
    if (!program || !wallet.publicKey) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all BetAccounts for the player via memcmp filter on player pubkey at offset 8
      const rawBetAccounts = await (program.account as any)["betAccount"].all([
        {
          memcmp: {
            offset: 8,
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      // Collect unique pixel PDAs to determine win/loss by checking PixelState
      const uniquePixelKeys: Map<string, PublicKey> = new Map();
      for (const acct of rawBetAccounts) {
        const { seasonNumber: sn, pixelIndex } = acct.account;
        const [pixelPDAKey] = derivePixelPDA(PROGRAM_ID, sn, pixelIndex);
        uniquePixelKeys.set(pixelPDAKey.toBase58(), pixelPDAKey);
      }

      // Fetch all unique PixelState accounts in a single batch
      const pixelPubkeys = Array.from(uniquePixelKeys.values());
      const pixelInfos = pixelPubkeys.length > 0
        ? await (program.account as any)["pixelState"].fetchMultiple(pixelPubkeys)
        : [];

      // Build a map from pixelPDA.toBase58() -> decoded PixelState
      const pixelStateMap: Map<string, { winningColor: number | null }> = new Map();
      for (let i = 0; i < pixelPubkeys.length; i++) {
        const decoded = pixelInfos[i];
        if (decoded) {
          // winningColor is an Option<u8> — Anchor decodes it as number | null
          const winningColor =
            typeof decoded.winningColor === "number" ? decoded.winningColor : null;
          pixelStateMap.set(pixelPubkeys[i].toBase58(), { winningColor });
        }
      }

      // Map raw accounts to BetHistoryEntry
      const entries: BetHistoryEntry[] = rawBetAccounts.map(
        (acct: {
          publicKey: PublicKey;
          account: {
            seasonNumber: number;
            pixelIndex: number;
            color: number;
            amount: { toNumber: () => number } | number;
            claimed: boolean;
          };
        }) => {
          const { seasonNumber: sn, pixelIndex, color, amount, claimed } = acct.account;

          const [pixelPDAKey] = derivePixelPDA(PROGRAM_ID, sn, pixelIndex);
          const [statsPDAKey] = deriveStatsPDA(PROGRAM_ID, sn, wallet.publicKey!);

          // amount is stored as BN in Anchor — convert to number
          const amountLamports =
            typeof amount === "object" && "toNumber" in amount
              ? amount.toNumber()
              : Number(amount);

          return {
            pixelIndex,
            colorIndex: color,
            amount: amountLamports,
            claimed,
            seasonNumber: sn,
            betPDA: acct.publicKey.toBase58(),
            pixelPDA: pixelPDAKey.toBase58(),
            statsPDA: statsPDAKey.toBase58(),
          } satisfies BetHistoryEntry;
        }
      );

      setBets(entries);

      // Fetch PlayerSeasonStats for the current season
      const [statsPDA] = deriveStatsPDA(PROGRAM_ID, seasonNumber, wallet.publicKey);
      try {
        const statsInfo = await program.provider.connection.getAccountInfo(statsPDA);
        if (statsInfo) {
          const decoded = program.coder.accounts.decode("PlayerSeasonStats", statsInfo.data) as {
            totalBets: number;
            totalVolume: bigint | { toNumber: () => number };
            correctPredictions: number;
          };

          const totalBets = decoded.totalBets;
          const totalVolume =
            typeof decoded.totalVolume === "bigint"
              ? Number(decoded.totalVolume)
              : typeof decoded.totalVolume === "object" && "toNumber" in decoded.totalVolume
              ? decoded.totalVolume.toNumber()
              : Number(decoded.totalVolume);

          const correctPredictions = decoded.correctPredictions;
          const hitRate =
            totalBets > 0
              ? ((correctPredictions / totalBets) * 100).toFixed(1)
              : "0.0";

          setStats({
            totalBets,
            totalVolume,
            correctPredictions,
            hitRate,
          });
        } else {
          setStats(null);
        }
      } catch {
        // Stats account may not exist yet — this is fine
        setStats(null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch bet history.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey, seasonNumber]);

  // Auto-fetch on mount if wallet is connected
  useEffect(() => {
    if (wallet.publicKey && program) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, program]);

  return { bets, stats, loading, error, refresh };
}
