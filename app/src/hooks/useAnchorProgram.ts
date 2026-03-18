"use client";

import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";
import { PROGRAM_ID } from "@/lib/constants";

/**
 * Returns a memoized Anchor Program instance when a wallet is connected,
 * or null when disconnected.
 *
 * Uses useAnchorWallet (not useWallet) because Anchor requires a wallet
 * that can sign transactions synchronously.
 */
export function useAnchorProgram(): Program | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) {
      console.warn("[useAnchorProgram] No wallet connected");
      return null;
    }

    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });

      const program = new Program(idl as Idl, provider);
      console.log("[useAnchorProgram] Program ready:", program.programId.toBase58());
      return program;
    } catch (err) {
      console.error("[useAnchorProgram] Failed to create Program:", err);
      return null;
    }
  }, [wallet, connection]);
}
