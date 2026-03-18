import { Keypair } from "@solana/web3.js";
import { logger } from "./logger";

/**
 * Upload prompt text to Arweave via Irys (formerly Bundlr).
 *
 * Returns the 43-character Arweave transaction ID on success, or null on any failure.
 * Never blocks the round lifecycle — all errors are caught and logged.
 *
 * Timeout: 60 seconds (applied to the upload step).
 *
 * @param promptText - The full prompt text to archive
 * @param oracleKeypair - The oracle's Solana keypair (pays for upload with SOL)
 * @param rpcUrl - Solana RPC URL used by Irys to fund uploads
 * @returns Arweave transaction ID (43 chars) or null on failure
 */
export async function uploadToArweave(
  promptText: string,
  oracleKeypair: Keypair,
  rpcUrl: string
): Promise<string | null> {
  try {
    // @irys/upload-solana uses Builder pattern: Builder(Solana).withWallet(...).withRpc(...).mainnet().build()
    // Dynamic require used to avoid CommonJS/ESM conflicts at top level
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Solana } = require("@irys/upload-solana") as {
      default: unknown;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Builder } = require("@irys/upload") as {
      default: (
        tokenClass: unknown
      ) => {
        withWallet(wallet: unknown): {
          withRpc(url: string): {
            mainnet(): {
              build(): Promise<{
                upload(
                  data: Buffer,
                  opts?: { tags?: Array<{ name: string; value: string }> }
                ): Promise<{ id: string }>;
              }>;
            };
          };
        };
      };
    };

    // Build the Irys uploader — this connects to the Irys network
    const irys = await Builder(Solana)
      .withWallet(Array.from(oracleKeypair.secretKey))
      .withRpc(rpcUrl)
      .mainnet()
      .build();

    // Upload with 60-second timeout
    const result = await Promise.race([
      irys.upload(Buffer.from(promptText, "utf8"), {
        tags: [
          { name: "Content-Type", value: "text/plain" },
          { name: "App-Name", value: "PixelPredict" },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Arweave upload timeout")), 60_000)
      ),
    ]);

    const txId: string = (result as { id: string }).id;
    logger.info({
      event: "arweave_upload_success",
      txId,
      promptLength: promptText.length,
    });
    return txId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({
      event: "arweave_upload_failed",
      error: message,
      warning: "Arweave upload failed — round lifecycle continues without txid",
    });
    return null;
  }
}

export default uploadToArweave;
