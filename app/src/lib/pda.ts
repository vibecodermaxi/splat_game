import { PublicKey } from "@solana/web3.js";

/**
 * Derive the Config PDA.
 * Seeds: ["config"]
 */
export function deriveConfigPDA(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

/**
 * Derive the Season PDA.
 * Seeds: ["season", u16LE(seasonNumber)]
 */
export function deriveSeasonPDA(
  programId: PublicKey,
  seasonNumber: number
): [PublicKey, number] {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(seasonNumber);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("season"), buf],
    programId
  );
}

/**
 * Derive the Pixel PDA.
 * Seeds: ["pixel", u16LE(seasonNumber), u16LE(pixelIndex)]
 */
export function derivePixelPDA(
  programId: PublicKey,
  seasonNumber: number,
  pixelIndex: number
): [PublicKey, number] {
  const sBuf = Buffer.alloc(2);
  sBuf.writeUInt16LE(seasonNumber);
  const pBuf = Buffer.alloc(2);
  pBuf.writeUInt16LE(pixelIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pixel"), sBuf, pBuf],
    programId
  );
}

/**
 * Derive the Bet PDA.
 * Seeds: ["bet", u16LE(seasonNumber), u16LE(pixelIndex), player.toBuffer()]
 */
export function deriveBetPDA(
  programId: PublicKey,
  seasonNumber: number,
  pixelIndex: number,
  player: PublicKey
): [PublicKey, number] {
  const sBuf = Buffer.alloc(2);
  sBuf.writeUInt16LE(seasonNumber);
  const pBuf = Buffer.alloc(2);
  pBuf.writeUInt16LE(pixelIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), sBuf, pBuf, player.toBuffer()],
    programId
  );
}

/**
 * Derive the Stats PDA.
 * Seeds: ["stats", u16LE(seasonNumber), player.toBuffer()]
 */
export function deriveStatsPDA(
  programId: PublicKey,
  seasonNumber: number,
  player: PublicKey
): [PublicKey, number] {
  const sBuf = Buffer.alloc(2);
  sBuf.writeUInt16LE(seasonNumber);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stats"), sBuf, player.toBuffer()],
    programId
  );
}
