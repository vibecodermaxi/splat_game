import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { LiteSVM, Clock } from "litesvm";
import { LiteSVMProvider, fromWorkspace } from "anchor-litesvm";
import type { PixelPredict } from "../target/types/pixel_predict";

// Program constants matching on-chain values
export const MIN_BET = 10_000_000;        // 0.01 SOL
export const MAX_BET = 10_000_000_000;    // 10 SOL
export const BETTING_WINDOW = 1680;       // 28 minutes in seconds

export interface TestEnvironment {
  svm: LiteSVM;
  provider: LiteSVMProvider;
  program: anchor.Program<PixelPredict>;
  admin: Keypair;
  oracle: Keypair;
  player1: Keypair;
  player2: Keypair;
  player3: Keypair;
}

/**
 * Set up the LiteSVM test environment with the pixel-predict program loaded.
 * Creates keypairs for admin, oracle, and 3 players, and airdrops 100 SOL each.
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  // Load the program from the workspace (reads Anchor.toml, loads .so files)
  const svm = fromWorkspace("./");

  // Generate keypairs for all participants
  const admin = Keypair.generate();
  const oracle = Keypair.generate();
  const player1 = Keypair.generate();
  const player2 = Keypair.generate();
  const player3 = Keypair.generate();

  // Airdrop 100 SOL to all keypairs
  const airdropAmount = BigInt(100 * 1_000_000_000); // 100 SOL in lamports
  svm.airdrop(admin.publicKey, airdropAmount);
  svm.airdrop(oracle.publicKey, airdropAmount);
  svm.airdrop(player1.publicKey, airdropAmount);
  svm.airdrop(player2.publicKey, airdropAmount);
  svm.airdrop(player3.publicKey, airdropAmount);

  // Create LiteSVMProvider with admin as the default payer/wallet
  const provider = new LiteSVMProvider(svm, new anchor.Wallet(admin));
  anchor.setProvider(provider);

  // Load the program IDL
  const idl = require("../target/idl/pixel_predict.json");
  const program = new anchor.Program<PixelPredict>(idl, provider);

  return { svm, provider, program, admin, oracle, player1, player2, player3 };
}

// --- PDA Derivation Helpers ---

/**
 * Derive the config PDA address
 * Seeds: ["config"]
 */
export function findConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

/**
 * Derive the season state PDA address
 * Seeds: ["season", seasonNumber (2-byte little-endian)]
 */
export function findSeasonPDA(
  programId: PublicKey,
  seasonNumber: number
): [PublicKey, number] {
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(seasonNumber, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("season"), seasonBuf],
    programId
  );
}

/**
 * Derive the pixel state PDA address
 * Seeds: ["pixel", seasonNumber (2-byte LE), pixelIndex (2-byte LE)]
 */
export function findPixelPDA(
  programId: PublicKey,
  seasonNumber: number,
  pixelIndex: number
): [PublicKey, number] {
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(seasonNumber, 0);
  const pixelBuf = Buffer.alloc(2);
  pixelBuf.writeUInt16LE(pixelIndex, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pixel"), seasonBuf, pixelBuf],
    programId
  );
}

/**
 * Derive the bet account PDA address
 * Seeds: ["bet", seasonNumber (2-byte LE), pixelIndex (2-byte LE), player pubkey]
 */
export function findBetPDA(
  programId: PublicKey,
  seasonNumber: number,
  pixelIndex: number,
  player: PublicKey
): [PublicKey, number] {
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(seasonNumber, 0);
  const pixelBuf = Buffer.alloc(2);
  pixelBuf.writeUInt16LE(pixelIndex, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), seasonBuf, pixelBuf, player.toBuffer()],
    programId
  );
}

/**
 * Derive the player season stats PDA address
 * Seeds: ["stats", seasonNumber (2-byte LE), player pubkey]
 */
export function findStatsPDA(
  programId: PublicKey,
  seasonNumber: number,
  player: PublicKey
): [PublicKey, number] {
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(seasonNumber, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stats"), seasonBuf, player.toBuffer()],
    programId
  );
}

// --- Switchboard On-Demand v3 VRF Helpers ---

/**
 * Switchboard On-Demand randomness program ID.
 * The on-chain program that creates and fulfills RandomnessAccountData accounts.
 */
export const SWITCHBOARD_RANDOMNESS_PROGRAM_ID = new PublicKey("RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh");

/**
 * Switchboard RandomnessAccountData discriminator.
 * sha256("account:RandomnessAccountData")[0..8]
 */
export const SWITCHBOARD_RANDOMNESS_DISCRIMINATOR = Buffer.from([42, 196, 232, 166, 126, 135, 235, 168]);

// Keep ORAO alias for backward compatibility in existing tests
export const ORAO_VRF_PROGRAM_ID = SWITCHBOARD_RANDOMNESS_PROGRAM_ID;

/**
 * Create a mock Switchboard On-Demand v3 RandomnessAccountData account in LiteSVM for testing.
 *
 * Switchboard RandomnessAccountData layout:
 * - 8 bytes:  discriminator (sha256("account:RandomnessAccountData")[0..8])
 * - 32 bytes: queue: Pubkey
 * - 32 bytes: seed: [u8; 32]
 * - 8 bytes:  expiration_slot: u64 (little-endian)
 * - 64 bytes: value: [u8; 64]  (all-zero = pending, non-zero = fulfilled)
 *
 * Total: 144 bytes minimum
 *
 * @param svm - LiteSVM instance
 * @param address - The account pubkey to create
 * @param valueBytes - 64-byte value (non-zero = fulfilled, all-zero = pending)
 * @param seed - Optional 32-byte seed (defaults to zeros)
 * @returns The account pubkey
 */
export function createMockSwitchboardRandomnessAccount(
  svm: LiteSVM,
  address: PublicKey,
  valueBytes: Uint8Array,
  seed?: Uint8Array
): PublicKey {
  const discriminator = SWITCHBOARD_RANDOMNESS_DISCRIMINATOR;
  const queue = Buffer.alloc(32, 0);          // queue: Pubkey (zeros for testing)
  const seedBytes = seed ? Buffer.from(seed) : Buffer.alloc(32, 0);
  const expirationSlot = Buffer.alloc(8, 0);  // expiration_slot: u64 (zeros = no expiry in test)
  const value = Buffer.from(valueBytes);

  const data = Buffer.concat([discriminator, queue, seedBytes, expirationSlot, value]);

  // Minimum rent-exempt balance for this account size
  const lamports = BigInt(1_000_000_000); // 1 SOL (well above rent)

  svm.setAccount(address, {
    lamports,
    data,
    owner: SWITCHBOARD_RANDOMNESS_PROGRAM_ID,
    executable: false,
  });

  return address;
}

/**
 * Alias for backward compatibility — delegates to createMockSwitchboardRandomnessAccount.
 * Existing tests that called createMockOraoRandomnessAccount continue to work.
 */
export function createMockOraoRandomnessAccount(
  svm: LiteSVM,
  address: PublicKey,
  randomnessBytes: Uint8Array,
  seed?: Uint8Array
): PublicKey {
  return createMockSwitchboardRandomnessAccount(svm, address, randomnessBytes, seed);
}

// --- Time Helpers ---

/**
 * Advance the LiteSVM clock by the specified number of seconds.
 * Reads the current clock, adds seconds, then writes it back.
 * Uses the Clock NAPI class constructor as required by litesvm.
 *
 * Also rotates the blockhash to prevent "AlreadyProcessed" errors when
 * the same instruction is called again after a time advance (e.g., lock_round
 * test calls the same lockRound instruction before and after time advance).
 */
export function advanceTime(svm: LiteSVM, seconds: number): void {
  const clock = svm.getClock();
  // ~0.4 seconds per slot on Solana mainnet
  const newSlot = clock.slot + BigInt(Math.floor(seconds / 0.4));
  const newTimestamp = clock.unixTimestamp + BigInt(seconds);
  const newClock = new Clock(
    newSlot,
    clock.epochStartTimestamp,
    clock.epoch,
    clock.leaderScheduleEpoch,
    newTimestamp
  );
  svm.setClock(newClock);
  // Expire the current blockhash so subsequent identical-looking transactions
  // get a new blockhash and thus a unique signature (avoids AlreadyProcessed errors).
  svm.expireBlockhash();
}
