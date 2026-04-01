"use client";

import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import idl from "@/lib/idl.json";
import { PROGRAM_ID } from "@/lib/constants";

/** Dummy wallet that satisfies AnchorProvider for read-only (no signing) usage. */
const READ_ONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    throw new Error("Read-only: wallet not connected");
  },
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
    throw new Error("Read-only: wallet not connected");
  },
};

/**
 * Returns a memoized Anchor Program instance.
 *
 * When a wallet is connected it uses the real wallet so transactions can be
 * signed.  When no wallet is connected it creates a read-only Program backed
 * by a dummy wallet — sufficient for fetching on-chain account data so
 * visitors can see the game without connecting a wallet.
 */
export function useAnchorProgram(): Program {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      wallet ?? READ_ONLY_WALLET,
      { commitment: "confirmed" },
    );

    const program = new Program(idl as Idl, provider);
    return program;
  }, [wallet, connection]);
}
