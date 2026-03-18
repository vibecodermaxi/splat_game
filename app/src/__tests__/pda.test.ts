// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  deriveConfigPDA,
  deriveSeasonPDA,
  derivePixelPDA,
  deriveBetPDA,
  deriveStatsPDA,
} from "@/lib/pda";
import { PROGRAM_ID } from "@/lib/constants";

describe("PDA derivation", () => {
  it("deriveConfigPDA returns a valid PublicKey", () => {
    const [pda, bump] = deriveConfigPDA(PROGRAM_ID);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("deriveSeasonPDA(programId, 1) returns a valid PublicKey different from config PDA", () => {
    const [configPda] = deriveConfigPDA(PROGRAM_ID);
    const [seasonPda, bump] = deriveSeasonPDA(PROGRAM_ID, 1);

    expect(seasonPda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(seasonPda.toBase58()).not.toBe(configPda.toBase58());
  });

  it("derivePixelPDA with different pixelIndex values returns different addresses", () => {
    const [pda0] = derivePixelPDA(PROGRAM_ID, 1, 0);
    const [pda1] = derivePixelPDA(PROGRAM_ID, 1, 1);
    const [pda99] = derivePixelPDA(PROGRAM_ID, 1, 99);

    expect(pda0.toBase58()).not.toBe(pda1.toBase58());
    expect(pda0.toBase58()).not.toBe(pda99.toBase58());
    expect(pda1.toBase58()).not.toBe(pda99.toBase58());
  });

  it("deriveBetPDA: different players produce different PDAs", () => {
    // Valid base58 Solana public keys (system program and token program IDs)
    const player1 = new PublicKey("11111111111111111111111111111111");
    const player2 = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    const [pda1] = deriveBetPDA(PROGRAM_ID, 1, 0, player1);
    const [pda2] = deriveBetPDA(PROGRAM_ID, 1, 0, player2);

    expect(pda1).toBeInstanceOf(PublicKey);
    expect(pda2).toBeInstanceOf(PublicKey);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it("deriveStatsPDA: different players produce different PDAs", () => {
    const player1 = new PublicKey("11111111111111111111111111111111");
    const player2 = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    const [statsPda1] = deriveStatsPDA(PROGRAM_ID, 1, player1);
    const [statsPda2] = deriveStatsPDA(PROGRAM_ID, 1, player2);

    expect(statsPda1).toBeInstanceOf(PublicKey);
    expect(statsPda2).toBeInstanceOf(PublicKey);
    expect(statsPda1.toBase58()).not.toBe(statsPda2.toBase58());
  });

  it("derivePixelPDA and deriveBetPDA return different PDAs for same season+pixel", () => {
    const player = new PublicKey("11111111111111111111111111111111");
    const [pixelPda] = derivePixelPDA(PROGRAM_ID, 1, 5);
    const [betPda] = deriveBetPDA(PROGRAM_ID, 1, 5, player);

    expect(pixelPda.toBase58()).not.toBe(betPda.toBase58());
  });
});
