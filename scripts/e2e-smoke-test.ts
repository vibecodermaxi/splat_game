/**
 * E2E Smoke Test — Full game loop on devnet
 *
 * Tests the complete bet-to-claim cycle:
 *   open_round → place_bet → lock_round → resolve_round → claim_winnings
 *
 * Usage: npx tsx scripts/e2e-smoke-test.ts [--help]
 *
 * Requires oracle/.env to be configured with:
 *   SOLANA_RPC_URL, ORACLE_KEYPAIR, PROGRAM_ID
 *
 * The script uses the oracle keypair as both oracle authority and player.
 * This is fine for smoke testing — the oracle wallet has devnet SOL.
 *
 * Run time: ~3-5 minutes on devnet (waiting for betting window + lock window).
 */

import * as dotenv from "dotenv";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as path from "path";
import * as crypto from "crypto";

// Load env from oracle/.env (same pattern as devnet-setup.ts)
dotenv.config({ path: path.resolve(__dirname, "../oracle/.env") });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAMPORTS_PER_SOL = 1_000_000_000;
const BET_AMOUNT_LAMPORTS = 50_000_000; // 0.05 SOL
const BET_COLOR_INDEX = 0; // Red
const SEASON_NUMBER = 1;
const POLL_INTERVAL_MS = 5_000; // 5 seconds
const MAX_WAIT_MS = 12 * 60 * 1000; // 12 minute overall timeout (5-min round = ~4 min bet + ~1 min lock + claim)

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { help: boolean } {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }

  for (const arg of args) {
    if (!["--help", "-h"].includes(arg)) {
      console.error(`Unknown argument: ${arg}\nRun with --help for usage.`);
      process.exit(1);
    }
  }

  return { help: false };
}

function printHelp(): void {
  console.log(`
Usage: npx tsx scripts/e2e-smoke-test.ts [options]

Options:
  --help    Print this usage message and exit

Description:
  Semi-automated E2E smoke test for the Splat game loop on Solana devnet.
  Runs the full cycle: open_round → place_bet → lock_round → resolve_round → claim_winnings.
  Uses the oracle keypair from oracle/.env as both oracle authority and player.
  Prints "PASS" on success, "FAIL: <reason>" on failure.
  Exits with code 0 on PASS, 1 on FAIL.

Requirements:
  - oracle/.env must be configured with SOLANA_RPC_URL, ORACLE_KEYPAIR, PROGRAM_ID
  - The oracle wallet must have at least 0.1 SOL for the bet + fees
  - The program must be initialized (run scripts/devnet-setup.ts first)

Expected run time: 3-5 minutes on devnet.
`.trim());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function u16ToBuffer(n: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(n, 0);
  return buf;
}

function lamportsToSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

// ---------------------------------------------------------------------------
// PDA Derivation
// ---------------------------------------------------------------------------

function deriveConfigPDA(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  return pda;
}

function deriveSeasonPDA(programId: PublicKey, seasonNumber: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("season"), u16ToBuffer(seasonNumber)],
    programId
  );
  return pda;
}

function derivePixelPDA(
  programId: PublicKey,
  seasonNumber: number,
  pixelIndex: number
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pixel"), u16ToBuffer(seasonNumber), u16ToBuffer(pixelIndex)],
    programId
  );
  return pda;
}

function deriveBetPDA(
  programId: PublicKey,
  seasonNumber: number,
  pixelIndex: number,
  player: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      u16ToBuffer(seasonNumber),
      u16ToBuffer(pixelIndex),
      player.toBuffer(),
    ],
    programId
  );
  return pda;
}

function derivePlayerStatsPDA(
  programId: PublicKey,
  seasonNumber: number,
  player: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stats"), u16ToBuffer(seasonNumber), player.toBuffer()],
    programId
  );
  return pda;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { help } = parseArgs();

  if (help) {
    printHelp();
    process.exit(0);
  }

  const startEpoch = Date.now();

  // ---------------------------------------------------------------------------
  // 1. Setup phase
  // ---------------------------------------------------------------------------
  console.log("E2E Smoke Test Starting...");

  // Validate required env vars
  const requiredVars = ["SOLANA_RPC_URL", "ORACLE_KEYPAIR", "PROGRAM_ID"];
  const missing = requiredVars.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.log(`FAIL: Missing env vars: ${missing.join(", ")}\nEnsure oracle/.env is configured.`);
    process.exit(1);
  }

  // Parse keypair
  let oracleKeypair: Keypair;
  try {
    oracleKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(process.env.ORACLE_KEYPAIR!))
    );
  } catch (err) {
    console.log(`FAIL: Could not parse ORACLE_KEYPAIR: ${err}`);
    process.exit(1);
  }

  const programId = new PublicKey(process.env.PROGRAM_ID!);
  const rpcUrl = process.env.SOLANA_RPC_URL!;

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(oracleKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load IDL
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require("../oracle/src/idl.json") as anchor.Idl;
  const program = new anchor.Program<anchor.Idl>(idl, provider);

  // Record initial balance
  const initialBalanceLamports = await connection.getBalance(oracleKeypair.publicKey);
  console.log(
    `Oracle wallet: ${oracleKeypair.publicKey.toBase58()}`
  );
  console.log(`Initial balance: ${lamportsToSol(initialBalanceLamports)} SOL`);

  if (initialBalanceLamports < 100_000_000) {
    console.log(
      `FAIL: Insufficient balance. Need at least 0.1 SOL, have ${lamportsToSol(initialBalanceLamports)} SOL.`
    );
    console.log(`Run: solana airdrop 2 ${oracleKeypair.publicKey.toBase58()} --url ${rpcUrl}`);
    process.exit(1);
  }

  // Helper: check timeout
  function checkTimeout(step: string): void {
    if (Date.now() - startEpoch > MAX_WAIT_MS) {
      console.log(`FAIL: Timeout after 5 minutes during "${step}"`);
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Check season state
  // ---------------------------------------------------------------------------
  checkTimeout("check season state");

  const seasonPda = deriveSeasonPDA(programId, SEASON_NUMBER);
  const configPda = deriveConfigPDA(programId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seasonState: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seasonState = await (program.account as any).seasonState.fetch(seasonPda);
  } catch (err) {
    console.log(
      `FAIL: Could not fetch SeasonState for season ${SEASON_NUMBER}. Run scripts/devnet-setup.ts first.\nError: ${err}`
    );
    process.exit(1);
  }

  const currentPixelIndex: number = seasonState.currentPixelIndex;
  console.log(`Season ${SEASON_NUMBER}, pixel index: ${currentPixelIndex}`);

  // ---------------------------------------------------------------------------
  // 3. Open a round (if needed)
  // ---------------------------------------------------------------------------
  checkTimeout("open round");

  const pixelPda = derivePixelPDA(programId, SEASON_NUMBER, currentPixelIndex);

  const pixelInfo = await connection.getAccountInfo(pixelPda);

  if (!pixelInfo) {
    // No pixel state — open the round
    // Generate a deterministic prompt hash for testing
    const promptHash = Array.from(
      crypto.createHash("sha256").update(`smoke-test-season-${SEASON_NUMBER}-pixel-${currentPixelIndex}`).digest()
    ) as number[] & { length: 32 };

    try {
      await program.methods
        .openRound(currentPixelIndex, promptHash as unknown as number[] & { length: 32 })
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          config: configPda,
          oracle: oracleKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`Round opened for pixel ${currentPixelIndex}`);
    } catch (err) {
      console.log(`FAIL: open_round failed: ${err}`);
      process.exit(1);
    }
  } else {
    // Pixel state exists — check its status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pixelState: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pixelState = await (program.account as any).pixelState.fetch(pixelPda);
    } catch (err) {
      console.log(`FAIL: Could not fetch PixelState: ${err}`);
      process.exit(1);
    }

    const statusKey = Object.keys(pixelState.status)[0];

    if (statusKey === "resolved") {
      console.log(
        `Pixel ${currentPixelIndex} is already resolved. The season may have advanced.`
      );
      console.log(
        `Re-fetch season state to get updated currentPixelIndex and re-run the script.`
      );
      console.log(
        `FAIL: Pixel ${currentPixelIndex} already resolved — re-run to pick up next pixel.`
      );
      process.exit(1);
    } else {
      console.log(`Round already open for pixel ${currentPixelIndex} (status: ${statusKey})`);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Place a bet
  // ---------------------------------------------------------------------------
  checkTimeout("place bet");

  const betPda = deriveBetPDA(
    programId,
    SEASON_NUMBER,
    currentPixelIndex,
    oracleKeypair.publicKey
  );
  const playerStatsPda = derivePlayerStatsPDA(
    programId,
    SEASON_NUMBER,
    oracleKeypair.publicKey
  );

  // Check if bet already exists (idempotent re-run protection)
  const existingBetInfo = await connection.getAccountInfo(betPda);
  if (!existingBetInfo) {
    try {
      await program.methods
        .placeBet(currentPixelIndex, BET_COLOR_INDEX, new anchor.BN(BET_AMOUNT_LAMPORTS))
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          betAccount: betPda,
          playerSeasonStats: playerStatsPda,
          player: oracleKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      console.log(`FAIL: place_bet failed: ${err}`);
      process.exit(1);
    }
  }

  // Verify BetAccount exists on-chain
  const betAccountInfo = await connection.getAccountInfo(betPda);
  if (!betAccountInfo) {
    console.log(`FAIL: BetAccount PDA not found after place_bet`);
    process.exit(1);
  }

  console.log(`Bet placed: ${lamportsToSol(BET_AMOUNT_LAMPORTS)} SOL on Red for pixel ${currentPixelIndex}`);

  // ---------------------------------------------------------------------------
  // 5. Lock the round (wait for betting window to close)
  // ---------------------------------------------------------------------------
  checkTimeout("lock round");

  console.log(`Waiting for betting window to close before locking...`);

  let locked = false;
  const lockStart = Date.now();
  const LOCK_WAIT_MAX_MS = 6 * 60 * 1000; // 6 minutes max wait (betting window is 80% of round)

  while (!locked) {
    checkTimeout("lock round (polling)");

    if (Date.now() - lockStart > LOCK_WAIT_MAX_MS) {
      console.log(`FAIL: Timed out waiting to lock round after 4 minutes`);
      process.exit(1);
    }

    try {
      await program.methods
        .lockRound(SEASON_NUMBER, currentPixelIndex)
        .accounts({
          pixelState: pixelPda,
          caller: oracleKeypair.publicKey,
        })
        .rpc();
      locked = true;
      console.log(`Round locked for pixel ${currentPixelIndex}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Check if we need to wait longer
      if (
        msg.includes("cannot be locked") ||
        msg.includes("BettingWindowOpen") ||
        msg.includes("LockoutNotReached") ||
        msg.includes("too early") ||
        msg.includes("0x1775") || // Anchor error codes
        msg.includes("6005") ||
        msg.includes("6019")
      ) {
        process.stdout.write(".");
        await sleep(POLL_INTERVAL_MS);
      } else {
        console.log(`\nFAIL: lock_round failed unexpectedly: ${msg}`);
        process.exit(1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Resolve the round (wait for lock window to close)
  // ---------------------------------------------------------------------------
  checkTimeout("resolve round");

  console.log(`Waiting for lock window to close before resolving...`);

  let resolved = false;
  const resolveStart = Date.now();
  const RESOLVE_WAIT_MAX_MS = 4 * 60 * 1000; // 4 minutes max wait for resolve

  const treasuryWallet = new PublicKey("6vTe3xRjB4Hv4fN4WQ5xtcF21Ed12DFPoNwHJTZDUg5v");
  const jackpotWallet = new PublicKey("HrfnbCNRzvekRkdUJGzvmEu478F43uk7weReNDPqv2TB");

  while (!resolved) {
    checkTimeout("resolve round (polling)");

    if (Date.now() - resolveStart > RESOLVE_WAIT_MAX_MS) {
      console.log(`FAIL: Timed out waiting to resolve round after 4 minutes`);
      process.exit(1);
    }

    try {
      await program.methods
        .resolveRound(
          BET_COLOR_INDEX, // winning_color = Red (same as our bet, so we win)
          2,               // shade
          3,               // warmth
          false            // vrf_resolved = false (Claude-driven)
        )
        .accounts({
          seasonState: seasonPda,
          pixelState: pixelPda,
          config: configPda,
          oracle: oracleKeypair.publicKey,
          treasury: treasuryWallet,
          jackpot: jackpotWallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      resolved = true;
      console.log(`Round resolved: Red wins for pixel ${currentPixelIndex}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Check if lock window is still open
      if (
        msg.includes("LockWindowOpen") ||
        msg.includes("cannot be resolved") ||
        msg.includes("too early") ||
        msg.includes("0x1776") ||
        msg.includes("6006")
      ) {
        process.stdout.write(".");
        await sleep(POLL_INTERVAL_MS);
      } else {
        console.log(`\nFAIL: resolve_round failed unexpectedly: ${msg}`);
        process.exit(1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Claim winnings
  // ---------------------------------------------------------------------------
  checkTimeout("claim winnings");

  try {
    await program.methods
      .claimWinnings()
      .accounts({
        pixelState: pixelPda,
        betAccount: betPda,
        playerSeasonStats: playerStatsPda,
        player: oracleKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`Winnings claimed for pixel ${currentPixelIndex}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If already claimed, that is fine (idempotent re-run)
    if (msg.includes("AlreadyClaimed") || msg.includes("already claimed")) {
      console.log(`Winnings already claimed for pixel ${currentPixelIndex} (idempotent)`);
    } else {
      console.log(`FAIL: claim_winnings failed: ${msg}`);
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Verify final state
  // ---------------------------------------------------------------------------
  checkTimeout("verify final state");

  const finalBalanceLamports = await connection.getBalance(oracleKeypair.publicKey);

  // Fetch and verify BetAccount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalBetState: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    finalBetState = await (program.account as any).betAccount.fetch(betPda);
  } catch (err) {
    console.log(`FAIL: Could not fetch final BetAccount state: ${err}`);
    process.exit(1);
  }

  // Fetch and verify PixelState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalPixelState: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    finalPixelState = await (program.account as any).pixelState.fetch(pixelPda);
  } catch (err) {
    console.log(`FAIL: Could not fetch final PixelState: ${err}`);
    process.exit(1);
  }

  const betClaimed: boolean = finalBetState.claimed;
  const pixelStatus: string = Object.keys(finalPixelState.status)[0];

  const feeDiff = initialBalanceLamports - finalBalanceLamports;
  console.log(
    `Initial: ${lamportsToSol(initialBalanceLamports)} SOL, Final: ${lamportsToSol(finalBalanceLamports)} SOL, Fees: ${lamportsToSol(feeDiff)} SOL`
  );

  // Verify checks
  const failures: string[] = [];

  if (!betClaimed) {
    failures.push("BetAccount.claimed is false — winnings not marked as claimed");
  }

  if (pixelStatus !== "resolved") {
    failures.push(`PixelState.status is "${pixelStatus}", expected "resolved"`);
  }

  // Net cost should be small (just fees, since we won 95% of our own bet back)
  // We expect to lose some SOL to fees and rake, but not more than 0.01 SOL
  const MAX_EXPECTED_NET_LOSS_LAMPORTS = 10_000_000; // 0.01 SOL
  if (feeDiff > MAX_EXPECTED_NET_LOSS_LAMPORTS) {
    failures.push(
      `Net loss of ${lamportsToSol(feeDiff)} SOL exceeds expected 0.01 SOL — possible claim failure`
    );
  }

  if (failures.length > 0) {
    console.log(`FAIL: ${failures.join("; ")}`);
    process.exit(1);
  }

  console.log("PASS");
  process.exit(0);
}

main().catch((err) => {
  console.log(`FAIL: Unhandled error: ${err}`);
  process.exit(1);
});
