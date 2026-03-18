/**
 * Switchboard VRF fallback path for the Pixel Predict oracle service.
 *
 * This module is triggered only after 30+ minutes of complete Claude failure
 * (3 fast retries + 6 delay retries). It creates a Switchboard On-Demand
 * randomness account, submits a commit+reveal request, polls for fulfillment,
 * and then calls resolveRoundVrf on-chain.
 *
 * The on-chain resolve_round_vrf instruction validates the Switchboard account:
 *   - Owner check (Switchboard program)
 *   - Discriminator check
 *   - Non-zero value check (fulfilled)
 * The oracle just needs to create the randomness account and wait for fulfillment.
 *
 * Switchboard On-Demand SDK v3 API (from package introspection):
 *   - Randomness.create(program, keypair, queuePubkey) → [Randomness, createIx]
 *   - randomness.commitIx(queuePubkey, authority) → instruction
 *   - Queue.DEFAULT_DEVNET_KEY / Queue.DEFAULT_MAINNET_KEY
 *   - Account layout: discriminator[8] + queue[32] + seed[32] + expiration_slot[8] + value[64]
 *   - Value at offset 80; all-zero = pending, non-zero = fulfilled
 *   - value[0] % 16 = winning color index
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { OracleContext } from "./round";
import type { ResolutionResult } from "./types";
import { logger } from "./logger";

// Switchboard program ID (from on-chain constants.rs and CONTEXT.md)
const SWITCHBOARD_PROGRAM_ID = new PublicKey(
  "RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh"
);

/** Maximum time to wait for VRF fulfillment: 5 minutes */
const VRF_POLL_MAX_MS = 5 * 60_000;
/** Polling interval for VRF fulfillment check: 10 seconds */
const VRF_POLL_INTERVAL_MS = 10_000;

/**
 * Switchboard RandomnessAccountData layout (from on-chain constants.rs):
 *   discriminator[8] + queue[32] + seed[32] + expiration_slot[8] + value[64]
 * Total: 144 bytes
 *
 * Value starts at offset 80 (8+32+32+8=80) and spans 64 bytes.
 * Value all-zero = pending; non-zero = fulfilled.
 * Winning color index = value[0] % 16
 */
const VALUE_OFFSET = 80;
const VALUE_LENGTH = 64;

/**
 * Resolve a round via Switchboard On-Demand VRF when Claude is unavailable.
 *
 * Flow:
 *   1. Load the Switchboard On-Demand program and default queue
 *   2. Create a new randomness account (ephemeral keypair) and submit commit+reveal
 *   3. Poll the randomness account data until value bytes are non-zero (fulfilled)
 *   4. Call ctx.chain.resolveRoundVrf with the randomness account pubkey
 *   5. Return ResolutionResult with vrfResolved=true, colorIndex = value[0] % 16
 *
 * @param ctx          Oracle context with chain client and config
 * @param seasonNumber Current season number
 * @param pixelIndex   Current pixel index
 * @returns ResolutionResult with vrfResolved=true
 */
export async function resolveViaVrf(
  ctx: OracleContext,
  seasonNumber: number,
  pixelIndex: number
): Promise<ResolutionResult> {
  logger.info({
    event: "vrf_fallback_start",
    seasonNumber,
    pixelIndex,
    switchboardProgramId: SWITCHBOARD_PROGRAM_ID.toBase58(),
  });

  // Access the connection from the chain client via duck typing
  // ChainClient stores connection as a private field — expose via bracket notation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chainInternal = ctx.chain as unknown as Record<string, any>;
  const connection: Connection = chainInternal["connection"];
  const oracleWallet: anchor.Wallet = chainInternal["oracleWallet"];

  if (!connection || !oracleWallet) {
    throw new Error(
      "resolveViaVrf: cannot access ChainClient internals (connection, oracleWallet). " +
      "Ensure ChainClient has been initialized."
    );
  }

  // Load the Switchboard On-Demand IDL and program
  // Dynamic require to avoid breaking non-VRF paths if SDK is not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sb = require("@switchboard-xyz/on-demand") as typeof import("@switchboard-xyz/on-demand");

  // Build an Anchor provider using the oracle's wallet and existing connection.
  // The Switchboard SDK bundles its own @coral-xyz/anchor-31 which has a different
  // Program type than our project's @coral-xyz/anchor. We use `any` to bridge the
  // type mismatch — runtime behavior is identical since both are the same library.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new anchor.AnchorProvider(
    connection,
    oracleWallet,
    { commitment: "confirmed" }
  );

  // Load the Switchboard On-Demand program via its published IDL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sbProgram: any;

  try {
    // Attempt to load the on-demand program using the SDK helper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = sb as Record<string, any>;
    if (typeof sbAny["loadSwitchboardOnDemand"] === "function") {
      sbProgram = await sbAny["loadSwitchboardOnDemand"](provider);
    } else if (typeof sbAny["getProgramId"] === "function") {
      const programId = sbAny["getProgramId"](provider);
      sbProgram = await anchor.Program.at(programId, provider);
    } else {
      // Fallback: load at the known Switchboard program ID
      sbProgram = await anchor.Program.at(SWITCHBOARD_PROGRAM_ID, provider);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({
      event: "vrf_load_program_error",
      error: msg,
      note: "Attempting Randomness.create directly",
    });
    // Use the oracle's existing anchor program as a proxy for program identity
    sbProgram = await anchor.Program.at(SWITCHBOARD_PROGRAM_ID, provider);
  }

  // Determine the queue pubkey (devnet vs mainnet)
  const { Queue } = sb;
  const isDevnet =
    ctx.config.solanaRpcUrl.includes("devnet") ||
    ctx.config.solanaRpcUrl.includes("testnet");
  const queuePubkey = isDevnet ? Queue.DEFAULT_DEVNET_KEY : Queue.DEFAULT_MAINNET_KEY;

  logger.info({
    event: "vrf_queue_selected",
    queuePubkey: queuePubkey.toBase58(),
    isDevnet,
  });

  // Create the randomness account using the SDK
  const { Randomness } = sb;
  const randomnessKeypair = Keypair.generate();

  const [randomnessAccount, createIx] = await Randomness.create(
    sbProgram,
    randomnessKeypair,
    queuePubkey
  );

  const randomnessPubkey: PublicKey = randomnessAccount.pubkey;

  logger.info({
    event: "vrf_randomness_account_created",
    seasonNumber,
    pixelIndex,
    randomnessAccount: randomnessPubkey.toBase58(),
  });

  // Build the commit instruction
  const commitIx = await randomnessAccount.commitIx(
    queuePubkey,
    oracleWallet.publicKey
  );

  // Send create + commit in a single transaction
  const createCommitTx = new Transaction().add(createIx, commitIx);
  try {
    const sig = await sendAndConfirmTransaction(connection, createCommitTx, [
      oracleWallet.payer,
      randomnessKeypair,
    ]);
    logger.info({
      event: "vrf_commit_sent",
      randomnessAccount: randomnessPubkey.toBase58(),
      signature: sig,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({
      event: "vrf_commit_failed",
      randomnessAccount: randomnessPubkey.toBase58(),
      error: msg,
    });
    throw new Error(`VRF commit transaction failed: ${msg}`);
  }

  // Poll the randomness account until value bytes are non-zero (fulfilled)
  const startTime = Date.now();
  let colorIndex = 0;
  let fulfilled = false;

  while (Date.now() - startTime < VRF_POLL_MAX_MS) {
    try {
      const accountInfo = await connection.getAccountInfo(randomnessPubkey);
      if (accountInfo && accountInfo.data.length >= VALUE_OFFSET + VALUE_LENGTH) {
        const valueBytes = accountInfo.data.slice(VALUE_OFFSET, VALUE_OFFSET + VALUE_LENGTH);
        // Check if any byte is non-zero (fulfilled)
        const isNonZero = Array.from(valueBytes).some((b) => b !== 0);
        if (isNonZero) {
          colorIndex = valueBytes[0] % 16;
          fulfilled = true;
          logger.info({
            event: "vrf_fulfilled",
            randomnessAccount: randomnessPubkey.toBase58(),
            colorIndex,
            elapsedMs: Date.now() - startTime,
          });
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ event: "vrf_poll_error", error: msg });
    }

    // Wait before next poll
    await new Promise<void>((resolve) => setTimeout(resolve, VRF_POLL_INTERVAL_MS));
  }

  if (!fulfilled) {
    throw new Error(
      `VRF randomness account ${randomnessPubkey.toBase58()} was not fulfilled within ` +
      `${VRF_POLL_MAX_MS / 60_000} minutes. ` +
      `Season ${seasonNumber} pixel ${pixelIndex} cannot be resolved via VRF.`
    );
  }

  // Call the on-chain resolveRoundVrf instruction — on-chain validates the account
  await ctx.chain.resolveRoundVrf(seasonNumber, pixelIndex, randomnessPubkey);

  logger.info({
    event: "vrf_resolved",
    seasonNumber,
    pixelIndex,
    colorIndex,
    randomnessAccount: randomnessPubkey.toBase58(),
  });

  return {
    colorIndex,
    shade: 50,
    warmth: 50,
    vrfResolved: true,
  };
}
