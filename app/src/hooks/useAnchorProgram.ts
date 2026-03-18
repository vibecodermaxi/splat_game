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
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    return new Program(idl as Idl, provider);
  }, [wallet, connection]);
}
