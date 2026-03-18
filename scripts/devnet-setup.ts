/**
 * Devnet setup script — calls initialize_config and start_season
 * so the oracle can begin driving rounds.
 *
 * Usage: npx tsx scripts/devnet-setup.ts
 *
 * Requires oracle/.env to be configured with:
 *   SOLANA_RPC_URL, ORACLE_KEYPAIR, PROGRAM_ID
 */

import * as dotenv from "dotenv";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as path from "path";

// Load env from oracle/.env
dotenv.config({ path: path.resolve(__dirname, "../oracle/.env") });

async function main() {
  // Validate required env vars
  const requiredVars = ["SOLANA_RPC_URL", "ORACLE_KEYPAIR", "PROGRAM_ID"];
  const missing = requiredVars.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}\nEnsure oracle/.env is configured.`);
    process.exit(1);
  }

  // Parse keypair (admin = oracle for devnet)
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.ORACLE_KEYPAIR!))
  );
  const programId = new PublicKey(process.env.PROGRAM_ID!);
  const connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/pixel_predict.json");
  const idl = require(idlPath) as anchor.Idl;
  const program = new anchor.Program<anchor.Idl>(idl, provider);

  console.log("Program ID:", programId.toBase58());
  console.log("Admin/Oracle:", adminKeypair.publicKey.toBase58());

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  const seasonNumber = 1;
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(seasonNumber, 0);
  const [seasonPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("season"), seasonBuf],
    programId
  );

  // Check if config already exists
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log("Config PDA already exists, skipping initialize_config.");
  } else {
    console.log("Calling initialize_config...");
    const tx1 = await program.methods
      .initializeConfig(adminKeypair.publicKey)
      .accounts({
        config: configPda,
        admin: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("initialize_config tx:", tx1);
  }

  // Check if season already exists
  const seasonInfo = await connection.getAccountInfo(seasonPda);
  if (seasonInfo) {
    console.log("Season 1 already exists, skipping start_season.");
  } else {
    console.log("Calling start_season...");
    const tx2 = await program.methods
      .startSeason(seasonNumber, 10, 10)
      .accounts({
        seasonState: seasonPda,
        config: configPda,
        admin: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("start_season tx:", tx2);
  }

  console.log("\nDevnet setup complete!");
  console.log("Config PDA:", configPda.toBase58());
  console.log("Season PDA:", seasonPda.toBase58());
  console.log("\nYou can now start the oracle: cd oracle && npx tsx src/index.ts");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
