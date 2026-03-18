import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./idl.json";
import type { OracleConfig } from "./config";
import type { ClaudeResult, PixelData } from "./types";
import { COLOR_NAMES } from "./types";
import { logger } from "./logger";

// The PixelPredict type lives outside oracle/src/ (in target/types/pixel_predict.ts),
// which conflicts with rootDir: "src" in tsconfig. We use anchor.Idl for the program
// type to stay within rootDir boundaries. The IDL is loaded from the local copy at ./idl.json.

// Switchboard On-Demand VRF program ID
const SWITCHBOARD_RANDOMNESS_PROGRAM_ID = new PublicKey(
  "RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh"
);

// Status enum values matching on-chain PixelState status
const PIXEL_STATUS_RESOLVED = "resolved";

/**
 * Typed representation of the on-chain SeasonState account data.
 */
export interface SeasonStateData {
  seasonNumber: number;
  gridWidth: number;
  gridHeight: number;
  currentPixelIndex: number;
  status: string;
  totalVolume: bigint;
  totalBets: bigint;
}

/**
 * Typed representation of the on-chain PixelState account data.
 */
export interface PixelStateData {
  seasonNumber: number;
  pixelIndex: number;
  x: number;
  y: number;
  status: string;
  colorPools: bigint[];
  winningColor: number | null;
  shade: number | null;
  warmth: number | null;
  promptHash: number[];
  arweaveTxid: number[];
  hasArweaveTxid: boolean;
  vrfResolved: boolean;
  openedAt: bigint | null;
  lockedAt: bigint | null;
  resolvedAt: bigint | null;
}

/**
 * ChainClient wraps all Solana/Anchor interactions for the oracle service.
 *
 * Responsibilities:
 * - Load the Anchor IDL and create the typed Program client
 * - Derive PDAs for config, season, and pixel accounts
 * - Read SeasonState and PixelState accounts
 * - Call oracle instructions: openRound, lockRound, resolveRound, resolveRoundVrf, setArweaveTxid
 */
export class ChainClient {
  private program: anchor.Program<anchor.Idl>;
  private connection: Connection;
  private oracleWallet: anchor.Wallet;
  private programId: PublicKey;
  private treasuryWallet: PublicKey;
  private jackpotWallet: PublicKey;

  constructor(config: OracleConfig) {
    this.programId = new PublicKey(config.programId);
    this.treasuryWallet = new PublicKey(config.treasuryWallet);
    this.jackpotWallet = new PublicKey(config.jackpotWallet);

    // Create connection and wallet
    this.connection = new Connection(config.solanaRpcUrl, "confirmed");
    this.oracleWallet = new anchor.Wallet(config.oracleKeypair);

    // Create Anchor provider and program client
    const provider = new anchor.AnchorProvider(
      this.connection,
      this.oracleWallet,
      { commitment: "confirmed" }
    );
    this.program = new anchor.Program<anchor.Idl>(idl, provider);
  }

  // ---------------------------------------------------------------------------
  // PDA Derivation (static — no connection needed)
  // ---------------------------------------------------------------------------

  /**
   * Derive the config PDA.
   * Seeds: ["config"]
   */
  static deriveConfigPDA(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      programId
    );
  }

  /**
   * Derive the season state PDA.
   * Seeds: ["season", seasonNumber (2-byte little-endian)]
   */
  static deriveSeasonPDA(
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
   * Derive the pixel state PDA.
   * Seeds: ["pixel", seasonNumber (2-byte LE), pixelIndex (2-byte LE)]
   */
  static derivePixelPDA(
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

  // ---------------------------------------------------------------------------
  // Instance-level helpers to derive PDAs using the config program ID
  // ---------------------------------------------------------------------------

  private getConfigPDA(): PublicKey {
    return ChainClient.deriveConfigPDA(this.programId)[0];
  }

  private getSeasonPDA(seasonNumber: number): PublicKey {
    return ChainClient.deriveSeasonPDA(this.programId, seasonNumber)[0];
  }

  private getPixelPDA(seasonNumber: number, pixelIndex: number): PublicKey {
    return ChainClient.derivePixelPDA(this.programId, seasonNumber, pixelIndex)[0];
  }

  // ---------------------------------------------------------------------------
  // Account Readers
  // ---------------------------------------------------------------------------

  /**
   * Fetch the SeasonState account for a given season number.
   * Returns typed data or throws if not found.
   */
  async getSeasonState(seasonNumber: number): Promise<SeasonStateData> {
    const seasonPda = this.getSeasonPDA(seasonNumber);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (this.program.account as any).seasonState.fetch(seasonPda);
      return {
        seasonNumber: account.seasonNumber,
        gridWidth: account.gridWidth,
        gridHeight: account.gridHeight,
        currentPixelIndex: account.currentPixelIndex,
        status: Object.keys(account.status)[0],
        totalVolume: account.totalVolume,
        totalBets: account.totalBets,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        event: "get_season_state_failed",
        seasonNumber,
        error: message,
      });
      throw new Error(`Failed to fetch SeasonState for season ${seasonNumber}: ${message}`);
    }
  }

  /**
   * Fetch the PixelState account for a given season + pixel index.
   * Returns typed data, or null if the account does not exist.
   */
  async getPixelState(
    seasonNumber: number,
    pixelIndex: number
  ): Promise<PixelStateData | null> {
    const pixelPda = this.getPixelPDA(seasonNumber, pixelIndex);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (this.program.account as any).pixelState.fetch(pixelPda);
      return {
        seasonNumber: account.seasonNumber,
        pixelIndex: account.pixelIndex,
        x: account.x,
        y: account.y,
        status: Object.keys(account.status)[0],
        colorPools: account.colorPools,
        winningColor: account.winningColor ?? null,
        shade: account.shade ?? null,
        warmth: account.warmth ?? null,
        promptHash: Array.from(account.promptHash),
        arweaveTxid: Array.from(account.arweaveTxid),
        hasArweaveTxid: account.hasArweaveTxid,
        vrfResolved: account.vrfResolved,
        openedAt: account.openedAt ?? null,
        lockedAt: account.lockedAt ?? null,
        resolvedAt: account.resolvedAt ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Account not found is expected for pixels not yet opened
      if (message.includes("Account does not exist") || message.includes("could not find account")) {
        return null;
      }
      logger.error({
        event: "get_pixel_state_failed",
        seasonNumber,
        pixelIndex,
        error: message,
      });
      throw new Error(
        `Failed to fetch PixelState for season ${seasonNumber} pixel ${pixelIndex}: ${message}`
      );
    }
  }

  /**
   * Fetch all resolved pixels for a season, up to maxIndex.
   * Returns PixelData array with color names resolved from COLOR_NAMES.
   */
  async getAllResolvedPixels(
    seasonNumber: number,
    maxIndex: number
  ): Promise<PixelData[]> {
    const results: PixelData[] = [];
    for (let i = 0; i < maxIndex; i++) {
      try {
        const pixel = await this.getPixelState(seasonNumber, i);
        if (
          pixel !== null &&
          pixel.status === PIXEL_STATUS_RESOLVED &&
          pixel.winningColor !== null &&
          pixel.shade !== null &&
          pixel.warmth !== null
        ) {
          results.push({
            x: pixel.x,
            y: pixel.y,
            color: COLOR_NAMES[pixel.winningColor] ?? "Unknown",
            shade: pixel.shade,
            warmth: pixel.warmth,
          });
        }
      } catch {
        // Skip pixels that fail to load — log and continue
        logger.warn({
          event: "get_resolved_pixel_failed",
          seasonNumber,
          pixelIndex: i,
        });
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Oracle Instructions
  // ---------------------------------------------------------------------------

  /**
   * Call open_round to start a new pixel's betting window.
   * @param pixelIndex - The pixel to open (current or current+1 for pre-open)
   * @param promptHash - SHA-256 hash of the full prompt (32-byte array for commit-reveal)
   */
  async openRound(
    pixelIndex: number,
    promptHash: number[]
  ): Promise<string> {
    const seasonPda = this.getSeasonPDA(await this._getCurrentSeasonNumber());
    const pixelPda = this.getPixelPDA(await this._getCurrentSeasonNumber(), pixelIndex);
    const configPda = this.getConfigPDA();
    try {
      const tx = await this.program.methods
        .openRound(pixelIndex, promptHash as unknown as number[] & { length: 32 })
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          config: configPda,
          oracle: this.oracleWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      logger.info({ event: "open_round", pixelIndex, tx });
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ event: "open_round_failed", pixelIndex, error: message });
      throw new Error(`openRound failed for pixelIndex ${pixelIndex}: ${message}`);
    }
  }

  /**
   * Call lock_round to end the betting window and lock the round for resolution.
   * This is a permissionless crank — anyone can call it once the betting window expires.
   */
  async lockRound(seasonNumber: number, pixelIndex: number): Promise<string> {
    try {
      const tx = await this.program.methods
        .lockRound(seasonNumber, pixelIndex)
        .accounts({
          pixelState: this.getPixelPDA(seasonNumber, pixelIndex),
          caller: this.oracleWallet.publicKey,
        })
        .rpc();
      logger.info({ event: "lock_round", seasonNumber, pixelIndex, tx });
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ event: "lock_round_failed", seasonNumber, pixelIndex, error: message });
      throw new Error(
        `lockRound failed for season ${seasonNumber} pixel ${pixelIndex}: ${message}`
      );
    }
  }

  /**
   * Call resolve_round with Claude's color choice.
   * Posts winning_color, shade, warmth on-chain with vrf_resolved=false.
   */
  async resolveRound(
    seasonNumber: number,
    pixelIndex: number,
    result: ClaudeResult
  ): Promise<string> {
    const seasonPda = this.getSeasonPDA(seasonNumber);
    const pixelPda = this.getPixelPDA(seasonNumber, pixelIndex);
    const configPda = this.getConfigPDA();
    try {
      const tx = await this.program.methods
        .resolveRound(
          result.colorIndex,
          result.shade,
          result.warmth,
          false // vrf_resolved = false for Claude-driven resolution
        )
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          config: configPda,
          oracle: this.oracleWallet.publicKey,
          treasury: this.treasuryWallet,
          jackpot: this.jackpotWallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      logger.info({
        event: "resolve_round",
        seasonNumber,
        pixelIndex,
        colorIndex: result.colorIndex,
        colorName: result.colorName,
        shade: result.shade,
        warmth: result.warmth,
        tx,
      });
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ event: "resolve_round_failed", seasonNumber, pixelIndex, error: message });
      throw new Error(
        `resolveRound failed for season ${seasonNumber} pixel ${pixelIndex}: ${message}`
      );
    }
  }

  /**
   * Call resolve_round_vrf — VRF fallback path when Claude is unavailable.
   * Reads the fulfilled Switchboard randomness account on-chain.
   */
  async resolveRoundVrf(
    seasonNumber: number,
    pixelIndex: number,
    randomnessAccount: PublicKey
  ): Promise<string> {
    const seasonPda = this.getSeasonPDA(seasonNumber);
    const pixelPda = this.getPixelPDA(seasonNumber, pixelIndex);
    const configPda = this.getConfigPDA();
    try {
      const tx = await this.program.methods
        .resolveRoundVrf()
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          config: configPda,
          oracle: this.oracleWallet.publicKey,
          treasury: this.treasuryWallet,
          jackpot: this.jackpotWallet,
          randomnessAccount,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      logger.info({
        event: "resolve_round_vrf",
        seasonNumber,
        pixelIndex,
        randomnessAccount: randomnessAccount.toBase58(),
        tx,
      });
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        event: "resolve_round_vrf_failed",
        seasonNumber,
        pixelIndex,
        error: message,
      });
      throw new Error(
        `resolveRoundVrf failed for season ${seasonNumber} pixel ${pixelIndex}: ${message}`
      );
    }
  }

  /**
   * Call set_arweave_txid to write the Arweave transaction ID on-chain.
   * Must be called after uploading the prompt text to Arweave.
   * @param seasonNumber - Season number (for PDA seeds)
   * @param pixelIndex - Pixel index (for PDA seeds)
   * @param txid - 43-character Arweave transaction ID string
   */
  async setArweaveTxid(
    seasonNumber: number,
    pixelIndex: number,
    txid: string
  ): Promise<string> {
    if (txid.length !== 43) {
      throw new Error(
        `Arweave txid must be exactly 43 characters, got ${txid.length}: "${txid}"`
      );
    }
    // Encode the 43-char ASCII string as a [u8; 43] byte array
    const txidBytes = Array.from(Buffer.from(txid, "ascii")) as number[] & { length: 43 };

    const pixelPda = this.getPixelPDA(seasonNumber, pixelIndex);
    const configPda = this.getConfigPDA();
    try {
      const tx = await this.program.methods
        .setArweaveTxid(seasonNumber, pixelIndex, txidBytes)
        .accounts({
          pixelState: pixelPda,
          config: configPda,
          oracle: this.oracleWallet.publicKey,
        })
        .rpc();
      logger.info({
        event: "set_arweave_txid",
        seasonNumber,
        pixelIndex,
        txid,
        tx,
      });
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        event: "set_arweave_txid_failed",
        seasonNumber,
        pixelIndex,
        txid,
        error: message,
      });
      throw new Error(
        `setArweaveTxid failed for season ${seasonNumber} pixel ${pixelIndex}: ${message}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Convenience helper used by openRound to avoid threading seasonNumber through.
   * Reads the config's currentSeason — the caller manages this context.
   * Exposed as a simple method to allow override in tests.
   *
   * Note: openRound in practice receives the season number from its caller (the
   * lifecycle manager), but we provide this as a protected helper for internal use.
   */
  protected async _getCurrentSeasonNumber(): Promise<number> {
    // In a real invocation, the lifecycle manager always knows the season number.
    // This default implementation is overridden in tests or by subclasses.
    throw new Error(
      "_getCurrentSeasonNumber() must be provided by the caller context. " +
        "Use openRoundForSeason(seasonNumber, pixelIndex, promptHash) instead."
    );
  }

  /**
   * Open a round with explicit season number — preferred API for lifecycle manager.
   */
  async openRoundForSeason(
    seasonNumber: number,
    pixelIndex: number,
    promptHash: number[]
  ): Promise<string> {
    const seasonPda = this.getSeasonPDA(seasonNumber);
    const pixelPda = this.getPixelPDA(seasonNumber, pixelIndex);
    const configPda = this.getConfigPDA();
    try {
      const tx = await this.program.methods
        .openRound(pixelIndex, promptHash as unknown as number[] & { length: 32 })
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          config: configPda,
          oracle: this.oracleWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      logger.info({ event: "open_round", seasonNumber, pixelIndex, tx });
      return tx;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({
        event: "open_round_failed",
        seasonNumber,
        pixelIndex,
        error: message,
      });
      throw new Error(
        `openRoundForSeason failed for season ${seasonNumber} pixel ${pixelIndex}: ${message}`
      );
    }
  }
}
