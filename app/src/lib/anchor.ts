import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "./idl.json";
import { PROGRAM_ID } from "./constants";

/**
 * Create an AnchorProvider from a connection and wallet.
 */
export function createAnchorProvider(
  connection: Connection,
  wallet: AnchorWallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

/**
 * Create a Program instance from a provider.
 * Uses the pixel_predict IDL and program ID from constants.
 */
export function createProgram(provider: AnchorProvider): Program {
  return new Program(idl as Idl, provider);
}
