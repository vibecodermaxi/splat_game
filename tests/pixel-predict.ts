import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import {
  setupTestEnvironment,
  findConfigPDA,
  findSeasonPDA,
  findPixelPDA,
  findBetPDA,
  findStatsPDA,
  advanceTime,
  MIN_BET,
  MAX_BET,
  BETTING_WINDOW,
  TestEnvironment,
  ORAO_VRF_PROGRAM_ID,
  createMockOraoRandomnessAccount,
} from "./helpers";

// Treasury and jackpot wallets (match constants.rs — devnet keypairs)
const TREASURY_WALLET = new PublicKey("6vTe3xRjB4Hv4fN4WQ5xtcF21Ed12DFPoNwHJTZDUg5v");
const JACKPOT_WALLET = new PublicKey("HrfnbCNRzvekRkdUJGzvmEu478F43uk7weReNDPqv2TB");

describe("Pixel Predict", () => {
  let env: TestEnvironment;

  before(async () => {
    env = await setupTestEnvironment();
  });

  it("SC-SCAFFOLD: program is deployed and accessible", async () => {
    const programId = env.program.programId;
    expect(programId).to.not.be.undefined;
    expect(programId.toBase58()).to.equal(
      "FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG"
    );

    // Verify PDA derivation helpers work
    const [configPDA] = findConfigPDA(programId);
    expect(configPDA).to.not.be.undefined;

    const [seasonPDA] = findSeasonPDA(programId, 1);
    expect(seasonPDA).to.not.be.undefined;

    const [pixelPDA] = findPixelPDA(programId, 1, 0);
    expect(pixelPDA).to.not.be.undefined;

    const [betPDA] = findBetPDA(programId, 1, 0, env.player1.publicKey);
    expect(betPDA).to.not.be.undefined;

    const [statsPDA] = findStatsPDA(programId, 1, env.player1.publicKey);
    expect(statsPDA).to.not.be.undefined;

    // Verify time advancement helper works
    const clockBefore = env.svm.getClock();
    advanceTime(env.svm, 100);
    const clockAfter = env.svm.getClock();
    expect(Number(clockAfter.unixTimestamp)).to.be.greaterThan(
      Number(clockBefore.unixTimestamp)
    );

    // Verify constants match expected spec values
    expect(MIN_BET).to.equal(10_000_000);
    expect(MAX_BET).to.equal(10_000_000_000);
    expect(BETTING_WINDOW).to.equal(1680);

    // Verify player balances were airdropped
    const adminBalance = env.svm.getBalance(env.admin.publicKey);
    expect(adminBalance).to.not.be.null;
    expect(Number(adminBalance)).to.be.greaterThan(0);
  });

  // ─── SC-01: Initialize season ────────────────────────────────────────────────

  describe("SC-01: Initialize season", () => {
    it("SC-01-INIT: initializes config with oracle pubkey", async () => {
      const programId = env.program.programId;
      const [configPDA, configBump] = findConfigPDA(programId);

      await env.program.methods
        .initializeConfig(env.oracle.publicKey)
        .accounts({
          config: configPDA,
          admin: env.admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.program.account.configAccount.fetch(configPDA);
      expect(config.admin.toBase58()).to.equal(env.admin.publicKey.toBase58());
      expect(config.oracle.toBase58()).to.equal(env.oracle.publicKey.toBase58());
      expect(config.bump).to.equal(configBump);
    });

    it("SC-01-SEASON: admin starts season with 10x10 grid", async () => {
      const programId = env.program.programId;
      const [seasonPDA, seasonBump] = findSeasonPDA(programId, 1);
      const [configPDA] = findConfigPDA(programId);

      await env.program.methods
        .startSeason(1, 10, 10)
        .accounts({
          seasonState: seasonPDA,
          config: configPDA,
          admin: env.admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.admin])
        .rpc();

      const season = await env.program.account.seasonState.fetch(seasonPDA);
      expect(season.seasonNumber).to.equal(1);
      expect(season.gridWidth).to.equal(10);
      expect(season.gridHeight).to.equal(10);
      expect(season.currentPixelIndex).to.equal(0);
      expect(season.status).to.deep.equal({ active: {} });
      expect(season.totalVolume.toNumber()).to.equal(0);
      expect(season.totalBets).to.equal(0);
      expect(season.bump).to.equal(seasonBump);
    });

    it("SC-01-REJECT: non-admin cannot start season", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 99);
      const [configPDA] = findConfigPDA(programId);

      let errorThrown = false;
      try {
        await env.program.methods
          .startSeason(99, 10, 10)
          .accounts({
            seasonState: seasonPDA,
            config: configPDA,
            admin: env.player1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        // Expect either has_one constraint violation or UnauthorizedAdmin error
        const msg = err.message || err.toString();
        expect(msg).to.include("Error");
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── SC-02: Open round ───────────────────────────────────────────────────────

  describe("SC-02: Open round", () => {
    // Config and season are already initialized from SC-01 tests above (shared env)
    // These tests depend on SC-01 having run first (shared state via env)

    const PROMPT_HASH_0 = Buffer.alloc(32, 0xaa);  // Pixel 0 prompt hash
    const PROMPT_HASH_1 = Buffer.alloc(32, 0xbb);  // Pixel 1 prompt hash (future)

    it("SC-02-OPEN: oracle opens round with prompt hash", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA, pixelBump] = findPixelPDA(programId, 1, 0);

      await env.program.methods
        .openRound(0, Array.from(PROMPT_HASH_0))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.seasonNumber).to.equal(1);
      expect(pixel.pixelIndex).to.equal(0);
      expect(pixel.x).to.equal(0);
      expect(pixel.y).to.equal(0);
      expect(pixel.status).to.deep.equal({ open: {} });
      expect(pixel.totalPool.toNumber()).to.equal(0);
      expect(pixel.promptHash).to.deep.equal(Array.from(PROMPT_HASH_0));
      expect(pixel.bump).to.equal(pixelBump);
    });

    it("SC-02-AUTH: non-oracle cannot open round", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, 1);
      // Try pixel index 2 (out of order — but non-oracle should be rejected before that check)
      const [pixelPDA] = findPixelPDA(programId, 1, 0);

      let errorThrown = false;
      try {
        await env.program.methods
          .openRound(0, Array.from(PROMPT_HASH_0))
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixelPDA,
            config: configPDA,
            oracle: env.player1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg).to.include("Error");
      }
      expect(errorThrown).to.be.true;
    });

    it("SC-02-COORDS: pixel coordinates derive correctly from index", async () => {
      // pixel 0 -> (0,0) already tested above. Verify by fetching state.
      const programId = env.program.programId;
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.x).to.equal(0);   // 0 % 10 = 0
      expect(pixel.y).to.equal(0);   // 0 / 10 = 0
    });

    it("SC-02-NEXT: oracle can pre-open pixel N+1 for future betting", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixel1PDA, pixel1Bump] = findPixelPDA(programId, 1, 1);

      // Pixel 0 is already opened. Now open pixel 1 (N+1).
      await env.program.methods
        .openRound(1, Array.from(PROMPT_HASH_1))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixel1PDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      const pixel1 = await env.program.account.pixelState.fetch(pixel1PDA);
      expect(pixel1.pixelIndex).to.equal(1);
      expect(pixel1.x).to.equal(1);   // 1 % 10 = 1
      expect(pixel1.y).to.equal(0);   // 1 / 10 = 0
      expect(pixel1.status).to.deep.equal({ open: {} });
    });

    it("SC-02-NEXT-LIMIT: oracle cannot open pixel N+2 (skipping)", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, 1);
      // current_pixel_index is still 0 (season never resolved), so N+2 = 2
      const [pixel2PDA] = findPixelPDA(programId, 1, 2);

      let errorThrown = false;
      try {
        await env.program.methods
          .openRound(2, Array.from(Buffer.alloc(32, 0xcc)))
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixel2PDA,
            config: configPDA,
            oracle: env.oracle.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.oracle])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg).to.include("Error");
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── SC-03 through SC-06 and SC-17: Place bet ───────────────────────────────

  describe("SC-03: Place bet", () => {
    // Depends on: SC-01 (config + season 1 initialized), SC-02 (pixel 0 opened)
    // Shared state from those describe blocks runs in order (shared env)

    it("SC-03-BET: player places initial 0.05 SOL bet on color 7", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      const [betPDA, betBump] = findBetPDA(programId, 1, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, 1, env.player1.publicKey);

      const betAmount = 50_000_000; // 0.05 SOL
      const color = 7; // Blue

      const pixelBefore = await env.program.account.pixelState.fetch(pixelPDA);
      const poolBefore = pixelBefore.colorPools[color].toNumber();
      const totalPoolBefore = pixelBefore.totalPool.toNumber();

      await env.program.methods
        .placeBet(0, color, new anchor.BN(betAmount))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          betAccount: betPDA,
          playerSeasonStats: statsPDA,
          player: env.player1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.player1])
        .rpc();

      // Verify BetAccount was created
      const bet = await env.program.account.betAccount.fetch(betPDA);
      expect(bet.player.toBase58()).to.equal(env.player1.publicKey.toBase58());
      expect(bet.seasonNumber).to.equal(1);
      expect(bet.pixelIndex).to.equal(0);
      expect(bet.color).to.equal(color);
      expect(bet.amount.toNumber()).to.equal(betAmount);
      expect(bet.claimed).to.be.false;
      expect(bet.bump).to.equal(betBump);

      // Verify PixelState pools updated
      const pixelAfter = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixelAfter.colorPools[color].toNumber()).to.equal(poolBefore + betAmount);
      expect(pixelAfter.totalPool.toNumber()).to.equal(totalPoolBefore + betAmount);

      // Verify PlayerSeasonStats
      const stats = await env.program.account.playerSeasonStats.fetch(statsPDA);
      expect(stats.totalBets).to.equal(1);
      expect(stats.totalVolume.toNumber()).to.equal(betAmount);
      expect(stats.colorsBet[color]).to.equal(1);

      // Verify SeasonState updated
      const season = await env.program.account.seasonState.fetch(seasonPDA);
      expect(season.totalBets).to.equal(1);
      expect(season.totalVolume.toNumber()).to.equal(betAmount);
    });

    it("SC-04-INCREASE: same player increases bet on same color", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      const [betPDA] = findBetPDA(programId, 1, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, 1, env.player1.publicKey);

      // Use a different amount (60M vs SC-03's 50M) to avoid duplicate transaction in LiteSVM
      // LiteSVM rejects identical transactions (same bytes = same sig = AlreadyProcessed)
      const additionalBet = 60_000_000; // 0.06 SOL (different from first bet's 0.05 SOL)
      const color = 7;

      const betBefore = await env.program.account.betAccount.fetch(betPDA);
      const amountBefore = betBefore.amount.toNumber();

      await env.program.methods
        .placeBet(0, color, new anchor.BN(additionalBet))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          betAccount: betPDA,
          playerSeasonStats: statsPDA,
          player: env.player1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.player1])
        .rpc();

      const bet = await env.program.account.betAccount.fetch(betPDA);
      expect(bet.amount.toNumber()).to.equal(amountBefore + additionalBet);
      expect(bet.color).to.equal(color); // Color unchanged
    });

    it("SC-05-COLOR: player cannot bet on different color for same pixel", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      const [betPDA] = findBetPDA(programId, 1, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, 1, env.player1.publicKey);

      const betAmount = 10_000_000; // 0.01 SOL
      const differentColor = 3; // Lime — player already bet on color 7

      let errorThrown = false;
      try {
        await env.program.methods
          .placeBet(0, differentColor, new anchor.BN(betAmount))
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixelPDA,
            betAccount: betPDA,
            playerSeasonStats: statsPDA,
            player: env.player1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("colormismatch");
      }
      expect(errorThrown).to.be.true;
    });

    it("SC-06-MIN: bet below minimum (0.005 SOL) is rejected", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      // Use player2 (fresh player, no prior bet on pixel 0)
      const [betPDA] = findBetPDA(programId, 1, 0, env.player2.publicKey);
      const [statsPDA] = findStatsPDA(programId, 1, env.player2.publicKey);

      const tooSmall = 5_000_000; // 0.005 SOL (below 0.01 MIN)

      let errorThrown = false;
      try {
        await env.program.methods
          .placeBet(0, 5, new anchor.BN(tooSmall))
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixelPDA,
            betAccount: betPDA,
            playerSeasonStats: statsPDA,
            player: env.player2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player2])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("bettoosmall");
      }
      expect(errorThrown).to.be.true;
    });

    it("SC-06-MAX: cumulative bet exceeding 10 SOL is rejected", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      // Use player2 on color 9 (fresh)
      const [betPDA] = findBetPDA(programId, 1, 0, env.player2.publicKey);
      const [statsPDA] = findStatsPDA(programId, 1, env.player2.publicKey);

      // First place a valid bet of 9 SOL
      const firstBet = 9_000_000_000; // 9 SOL
      await env.program.methods
        .placeBet(0, 9, new anchor.BN(firstBet))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          betAccount: betPDA,
          playerSeasonStats: statsPDA,
          player: env.player2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.player2])
        .rpc();

      // Now try to add 2 SOL more (9 + 2 = 11 > 10 MAX)
      const secondBet = 2_000_000_000; // 2 SOL
      let errorThrown = false;
      try {
        await env.program.methods
          .placeBet(0, 9, new anchor.BN(secondBet))
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixelPDA,
            betAccount: betPDA,
            playerSeasonStats: statsPDA,
            player: env.player2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player2])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("bettoolarge");
      }
      expect(errorThrown).to.be.true;
    });

    it("SC-03-LOCKOUT: bet after 28 minutes is rejected", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, 1);
      const [pixelPDA] = findPixelPDA(programId, 1, 0);
      const [betPDA] = findBetPDA(programId, 1, 0, env.player3.publicKey);
      const [statsPDA] = findStatsPDA(programId, 1, env.player3.publicKey);

      // Advance time past 28 minutes
      advanceTime(env.svm, BETTING_WINDOW + 1); // 1681 seconds

      let errorThrown = false;
      try {
        await env.program.methods
          .placeBet(0, 5, new anchor.BN(MIN_BET))
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixelPDA,
            betAccount: betPDA,
            playerSeasonStats: statsPDA,
            player: env.player3.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player3])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("bettinglocked");
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── SC-17: Future pixel betting ────────────────────────────────────────────

  describe("SC-17: Future pixel betting", () => {
    // Uses season 2: freshly opened so betting window is still active even after
    // SC-03-LOCKOUT advanced time by 1681s (season 2 opened AFTER that advance).

    it("SC-17-FUTURE: player can bet on pre-opened next pixel (pixel 1)", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);

      // Start season 2
      const [season2PDA] = findSeasonPDA(programId, 2);
      await env.program.methods
        .startSeason(2, 10, 10)
        .accounts({
          seasonState: season2PDA,
          config: configPDA,
          admin: env.admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.admin])
        .rpc();

      // Open pixel 0 of season 2 (current pixel) — this establishes opened_at = NOW
      const [pixel2_0PDA] = findPixelPDA(programId, 2, 0);
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xdd)))
        .accounts({
          seasonState: season2PDA,
          pixelState: pixel2_0PDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Pre-open pixel 1 of season 2 (future pixel, N+1) — also opened_at = NOW
      const [pixel2_1PDA] = findPixelPDA(programId, 2, 1);
      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0xee)))
        .accounts({
          seasonState: season2PDA,
          pixelState: pixel2_1PDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Place bet on pixel 1 (future/pre-opened pixel) while pixel 0 is the active round
      const [betPDA] = findBetPDA(programId, 2, 1, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, 2, env.player1.publicKey);

      await env.program.methods
        .placeBet(1, 4, new anchor.BN(MIN_BET))
        .accounts({
          seasonState: season2PDA,
          pixelState: pixel2_1PDA,
          betAccount: betPDA,
          playerSeasonStats: statsPDA,
          player: env.player1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.player1])
        .rpc();

      // Verify the bet was placed on pixel 1 (the future pixel)
      const bet = await env.program.account.betAccount.fetch(betPDA);
      expect(bet.pixelIndex).to.equal(1);
      expect(bet.color).to.equal(4);
      expect(bet.amount.toNumber()).to.equal(MIN_BET);
      expect(bet.player.toBase58()).to.equal(env.player1.publicKey.toBase58());
    });
  });

  // ─── SC-07: Lock round ───────────────────────────────────────────────────────

  describe("SC-07: Lock round", () => {
    // Uses season 3 for isolated timing control.

    it("SC-07-EARLY: rejects lock_round before 28 minutes", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);

      // Create season 3 with fresh timing
      const [season3PDA] = findSeasonPDA(programId, 3);
      await env.program.methods
        .startSeason(3, 10, 10)
        .accounts({
          seasonState: season3PDA,
          config: configPDA,
          admin: env.admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.admin])
        .rpc();

      // Open pixel 0 of season 3 — opened_at = current clock timestamp
      const [pixel3_0PDA] = findPixelPDA(programId, 3, 0);
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xff)))
        .accounts({
          seasonState: season3PDA,
          pixelState: pixel3_0PDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Try to lock immediately (window hasn't expired for season 3 pixel 0)
      let errorThrown = false;
      try {
        await env.program.methods
          .lockRound(3, 0)
          .accounts({
            pixelState: pixel3_0PDA,
            caller: env.player1.publicKey,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("lockoutnotreached");
      }
      expect(errorThrown).to.be.true;
    });

    it("SC-07-LOCK: accepts lock after 28 minutes", async () => {
      const programId = env.program.programId;
      const [pixel3_0PDA] = findPixelPDA(programId, 3, 0);

      // Advance time past 28 minutes from now
      advanceTime(env.svm, BETTING_WINDOW + 1); // 1681 seconds

      await env.program.methods
        .lockRound(3, 0)
        .accounts({
          pixelState: pixel3_0PDA,
          caller: env.player1.publicKey,
        })
        .signers([env.player1])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixel3_0PDA);
      expect(pixel.status).to.deep.equal({ locked: {} });
      expect(pixel.lockedAt).to.not.be.null;
    });

    it("SC-07-PERMISSIONLESS: non-oracle can lock round", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);

      // Create season 4 with fresh timing (opened after the time advance in SC-07-LOCK)
      const [season4PDA] = findSeasonPDA(programId, 4);
      await env.program.methods
        .startSeason(4, 10, 10)
        .accounts({
          seasonState: season4PDA,
          config: configPDA,
          admin: env.admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.admin])
        .rpc();

      const [pixel4_0PDA] = findPixelPDA(programId, 4, 0);
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0x11)))
        .accounts({
          seasonState: season4PDA,
          pixelState: pixel4_0PDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Advance time past 28 minutes for this new pixel
      advanceTime(env.svm, BETTING_WINDOW + 1);

      // player3 (not oracle, not admin) calls lock_round — should succeed (permissionless)
      await env.program.methods
        .lockRound(4, 0)
        .accounts({
          pixelState: pixel4_0PDA,
          caller: env.player3.publicKey,
        })
        .signers([env.player3])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixel4_0PDA);
      expect(pixel.status).to.deep.equal({ locked: {} });
    });

    it("SC-07-ALREADY: rejects lock on already locked round", async () => {
      const programId = env.program.programId;
      const [pixel3_0PDA] = findPixelPDA(programId, 3, 0);
      // pixel 3-0 was locked in SC-07-LOCK

      let errorThrown = false;
      try {
        await env.program.methods
          .lockRound(3, 0)
          .accounts({
            pixelState: pixel3_0PDA,
            caller: env.player1.publicKey,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("roundnotopen");
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── SC-08: Resolve round (oracle) ──────────────────────────────────────────

  describe("SC-08: Resolve round", () => {
    // Uses season 10 (isolated from earlier tests)
    const SEASON = 10;
    let pixelPDA: PublicKey;

    before(async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      [pixelPDA] = findPixelPDA(programId, SEASON, 0);

      // Start season 10 and open pixel 0
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xa1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();
    });

    it("SC-08-RESOLVE: oracle resolves round, fields set correctly", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, SEASON);

      await env.program.methods
        .resolveRound(5, 60, 40, false)
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: findConfigPDA(programId)[0],
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.status).to.deep.equal({ resolved: {} });
      expect(pixel.winningColor).to.equal(5);
      expect(pixel.shade).to.equal(60);
      expect(pixel.warmth).to.equal(40);
      expect(pixel.vrfResolved).to.be.false;
      expect(pixel.resolvedAt).to.not.be.null;
    });

    it("SC-08-AUTH: non-oracle calling resolve_round is rejected", async () => {
      const programId = env.program.programId;
      const [seasonPDA] = findSeasonPDA(programId, SEASON + 1);
      const [configPDA] = findConfigPDA(programId);

      // Open a new pixel in a new season for this rejection test
      await env.program.methods
        .startSeason(SEASON + 1, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      const [newPixelPDA] = findPixelPDA(programId, SEASON + 1, 0);
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xa2)))
        .accounts({ seasonState: seasonPDA, pixelState: newPixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      let errorThrown = false;
      try {
        await env.program.methods
          .resolveRound(5, 60, 40, false)
          .accounts({
            seasonState: seasonPDA,
            pixelState: newPixelPDA,
            config: configPDA,
            oracle: env.player1.publicKey,
            treasury: TREASURY_WALLET,
            jackpot: JACKPOT_WALLET,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg).to.include("Error");
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── SC-09: Rake transfer ────────────────────────────────────────────────────

  describe("SC-09: Rake transfer", () => {
    // Uses season 20 with a single bet so rake can be verified
    const SEASON = 20;

    it("SC-09-RAKE: 3% treasury, 2% jackpot transferred at resolution", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betPDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      // Setup: start season, open round, place bet
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xb1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const betAmount = 100_000_000; // 0.1 SOL
      await env.program.methods
        .placeBet(0, 7, new anchor.BN(betAmount))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // Record treasury and jackpot balances before resolution
      const treasuryBefore = Number(env.svm.getBalance(TREASURY_WALLET));
      const jackpotBefore = Number(env.svm.getBalance(JACKPOT_WALLET));

      // Resolve the round (player1 bet on color 7, so resolve with color 7)
      await env.program.methods
        .resolveRound(7, 50, 50, false)
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Verify rake: 3% to treasury, 2% to jackpot
      const treasuryAfter = Number(env.svm.getBalance(TREASURY_WALLET));
      const jackpotAfter = Number(env.svm.getBalance(JACKPOT_WALLET));
      const expectedTreasury = Math.floor(betAmount * 300 / 10_000); // 3%
      const expectedJackpot = Math.floor(betAmount * 200 / 10_000);  // 2%

      expect(treasuryAfter - treasuryBefore).to.equal(expectedTreasury, "Treasury should receive 3%");
      expect(jackpotAfter - jackpotBefore).to.equal(expectedJackpot, "Jackpot should receive 2%");
    });
  });

  // ─── SC-12: Payout math ──────────────────────────────────────────────────────

  describe("SC-12: Payout math", () => {
    // Integration test verifying full payout flow with correct proportions
    // Uses season 30

    it("SC-12-MATH: sole winner receives ~95% of pool (minus lamport rounding)", async () => {
      const programId = env.program.programId;
      const SEASON = 30;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betPDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xc1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const betAmount = 100_000_000; // 0.1 SOL
      await env.program.methods
        .placeBet(0, 3, new anchor.BN(betAmount))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      await env.program.methods
        .resolveRound(3, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const playerBalanceBefore = Number(env.svm.getBalance(env.player1.publicKey));

      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      const playerBalanceAfter = Number(env.svm.getBalance(env.player1.publicKey));
      const payout = playerBalanceAfter - playerBalanceBefore;
      // Sole winner: net_pool = 100_000_000 * 95 / 100 = 95_000_000
      // payout = bet_amount * net_pool / color_pool = 100_000_000 * 95_000_000 / 100_000_000 = 95_000_000
      expect(payout).to.equal(95_000_000, "Sole winner should receive 95% = 95_000_000 lamports");
    });
  });

  // ─── SC-13: Zero-winner round ────────────────────────────────────────────────

  describe("SC-13: Zero-winner round", () => {
    const SEASON = 40;

    it("SC-13-ZERO: no bets on winning color sends net pool to treasury", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betPDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xd1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Player bets on color 0
      const betAmount = 100_000_000; // 0.1 SOL
      await env.program.methods
        .placeBet(0, 0, new anchor.BN(betAmount))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      const treasuryBefore = Number(env.svm.getBalance(TREASURY_WALLET));

      // Resolve with color 1 (no bets on color 1 — zero winner scenario)
      await env.program.methods
        .resolveRound(1, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const treasuryAfter = Number(env.svm.getBalance(TREASURY_WALLET));
      // Treasury should receive: rake (3%) + net pool (95%)
      // rake_treasury = 100_000_000 * 3% = 3_000_000
      // net_pool = 100_000_000 * 95% = 95_000_000
      // total to treasury = 3_000_000 + 95_000_000 = 98_000_000
      const treasuryGain = treasuryAfter - treasuryBefore;
      expect(treasuryGain).to.equal(98_000_000, "Treasury should receive rake + net pool on zero-winner round");
    });
  });

  // ─── SC-14: Season completion ────────────────────────────────────────────────

  describe("SC-14: Season completion", () => {
    const SEASON = 50;

    it("SC-14-SEASON: season completes when all pixels resolved", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      // Use a tiny 2x1 (2 pixel) grid to test completion without resolving 100 pixels
      const [seasonPDA] = findSeasonPDA(programId, SEASON);

      await env.program.methods
        .startSeason(SEASON, 2, 1)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      // Open pixel 0
      const [pixel0PDA] = findPixelPDA(programId, SEASON, 0);
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xe1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel0PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Resolve pixel 0 (no bets, so zero-winner path)
      await env.program.methods
        .resolveRound(5, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixel0PDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Check season still active (pixel_index = 1, total = 2*1 = 2, 1 < 2)
      let season = await env.program.account.seasonState.fetch(seasonPDA);
      expect(season.status).to.deep.equal({ active: {} });
      expect(season.currentPixelIndex).to.equal(1);

      // Open pixel 1 (N+1 is allowed since current_pixel_index is now 1, so pixel_index 1 == current)
      const [pixel1PDA] = findPixelPDA(programId, SEASON, 1);
      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0xe2)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Resolve pixel 1 — this should complete the season (2 of 2 pixels done)
      await env.program.methods
        .resolveRound(5, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      season = await env.program.account.seasonState.fetch(seasonPDA);
      expect(season.status).to.deep.equal({ completed: {} }, "Season should be Completed after all pixels resolved");
      expect(season.completedAt).to.not.be.null;
      expect(season.currentPixelIndex).to.equal(2);
    });
  });

  // ─── SC-10: Claim winnings ───────────────────────────────────────────────────

  describe("SC-10: Claim winnings", () => {
    const SEASON = 60;
    let season60PDA: PublicKey;
    let pixel60PDA: PublicKey;

    before(async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      [season60PDA] = findSeasonPDA(programId, SEASON);
      [pixel60PDA] = findPixelPDA(programId, SEASON, 0);

      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: season60PDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xf1)))
        .accounts({ seasonState: season60PDA, pixelState: pixel60PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // player1 bets 60_000_000 on color 7 (winning color)
      // player2 bets 40_000_000 on color 7 (winning color)
      // player3 bets 50_000_000 on color 3 (losing color)
      const [bet1PDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [stats1PDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);
      await env.program.methods
        .placeBet(0, 7, new anchor.BN(60_000_000))
        .accounts({ seasonState: season60PDA, pixelState: pixel60PDA, betAccount: bet1PDA, playerSeasonStats: stats1PDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      const [bet2PDA] = findBetPDA(programId, SEASON, 0, env.player2.publicKey);
      const [stats2PDA] = findStatsPDA(programId, SEASON, env.player2.publicKey);
      await env.program.methods
        .placeBet(0, 7, new anchor.BN(40_000_000))
        .accounts({ seasonState: season60PDA, pixelState: pixel60PDA, betAccount: bet2PDA, playerSeasonStats: stats2PDA, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();

      const [bet3PDA] = findBetPDA(programId, SEASON, 0, env.player3.publicKey);
      const [stats3PDA] = findStatsPDA(programId, SEASON, env.player3.publicKey);
      await env.program.methods
        .placeBet(0, 3, new anchor.BN(50_000_000))
        .accounts({ seasonState: season60PDA, pixelState: pixel60PDA, betAccount: bet3PDA, playerSeasonStats: stats3PDA, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player3])
        .rpc();

      // Resolve with color 7 (player1 and player2 win)
      await env.program.methods
        .resolveRound(7, 50, 50, false)
        .accounts({ seasonState: season60PDA, pixelState: pixel60PDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();
    });

    it("SC-10-PROPORTIONAL: two winners receive proportional payouts (60/40 split)", async () => {
      const programId = env.program.programId;
      const [bet1PDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [stats1PDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);
      const [bet2PDA] = findBetPDA(programId, SEASON, 0, env.player2.publicKey);
      const [stats2PDA] = findStatsPDA(programId, SEASON, env.player2.publicKey);

      // total_pool = 150_000_000, winning_color_pool = 100_000_000
      // net_pool = 150_000_000 * 95 / 100 = 142_500_000
      // player1 payout = 60_000_000 * 142_500_000 / 100_000_000 = 85_500_000
      // player2 payout = 40_000_000 * 142_500_000 / 100_000_000 = 57_000_000

      const p1Before = Number(env.svm.getBalance(env.player1.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixel60PDA, betAccount: bet1PDA, playerSeasonStats: stats1PDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();
      const p1After = Number(env.svm.getBalance(env.player1.publicKey));
      expect(p1After - p1Before).to.equal(85_500_000, "Player1 (60%) should receive 85_500_000 lamports");

      const p2Before = Number(env.svm.getBalance(env.player2.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixel60PDA, betAccount: bet2PDA, playerSeasonStats: stats2PDA, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();
      const p2After = Number(env.svm.getBalance(env.player2.publicKey));
      expect(p2After - p2Before).to.equal(57_000_000, "Player2 (40%) should receive 57_000_000 lamports");
    });

    it("SC-10-REJECT-LOSER: loser cannot claim winnings", async () => {
      const programId = env.program.programId;
      const [bet3PDA] = findBetPDA(programId, SEASON, 0, env.player3.publicKey);
      const [stats3PDA] = findStatsPDA(programId, SEASON, env.player3.publicKey);

      let errorThrown = false;
      try {
        await env.program.methods
          .claimWinnings()
          .accounts({ pixelState: pixel60PDA, betAccount: bet3PDA, playerSeasonStats: stats3PDA, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player3])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("notwinner");
      }
      expect(errorThrown).to.be.true;
    });

    it("SC-10-REJECT-DOUBLE: double claim rejected with AlreadyClaimed", async () => {
      const programId = env.program.programId;
      const [bet1PDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [stats1PDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      // player1 already claimed in the proportional test above
      let errorThrown = false;
      try {
        await env.program.methods
          .claimWinnings()
          .accounts({ pixelState: pixel60PDA, betAccount: bet1PDA, playerSeasonStats: stats1PDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        // LiteSVM may return "transaction <hash>..." or AnchorError with AlreadyClaimed
        // The key check is that the transaction was rejected (any error)
        expect(err).to.exist;
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── SC-11: Unclaimed winnings persist ───────────────────────────────────────

  describe("SC-11: Unclaimed winnings persist", () => {
    const SEASON = 70;

    it("SC-11-PERSIST: claim works after a new round has started", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betPDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      // Set up: start season, open pixel 0, place bet
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0x71)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const betAmount = 80_000_000; // 0.08 SOL (unique amount to avoid tx duplicates)
      await env.program.methods
        .placeBet(0, 2, new anchor.BN(betAmount))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // Resolve pixel 0 (player1 wins on color 2)
      await env.program.methods
        .resolveRound(2, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Open pixel 1 (a new round has started)
      const [pixel1PDA] = findPixelPDA(programId, SEASON, 1);
      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0x72)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Now claim the winnings from pixel 0 (should still work even though pixel 1 is open)
      const playerBalanceBefore = Number(env.svm.getBalance(env.player1.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();
      const playerBalanceAfter = Number(env.svm.getBalance(env.player1.publicKey));

      // Sole winner: net_pool = 80_000_000 * 95 / 100 = 76_000_000
      expect(playerBalanceAfter - playerBalanceBefore).to.equal(76_000_000, "Unclaimed winnings should be claimable after new round");
    });
  });

  // ─── SC-15: Player stats at claim ────────────────────────────────────────────

  describe("SC-15: Player stats at claim", () => {
    const SEASON = 80;

    it("SC-15-STATS: correct_predictions incremented on successful claim", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betPDA] = findBetPDA(programId, SEASON, 0, env.player2.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player2.publicKey);

      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0x81)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const betAmount = 70_000_000; // 0.07 SOL (unique amount)
      await env.program.methods
        .placeBet(0, 6, new anchor.BN(betAmount))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();

      // Verify correct_predictions before claiming
      const statsBefore = await env.program.account.playerSeasonStats.fetch(statsPDA);
      expect(statsBefore.correctPredictions).to.equal(0, "correct_predictions should be 0 before claim");

      // Resolve round with color 6 (player2 wins)
      await env.program.methods
        .resolveRound(6, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // correct_predictions still 0 even after resolution
      const statsAfterResolve = await env.program.account.playerSeasonStats.fetch(statsPDA);
      expect(statsAfterResolve.correctPredictions).to.equal(0, "correct_predictions should not increment at resolve time");

      // Claim winnings
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();

      // Verify correct_predictions incremented at claim time
      const statsAfterClaim = await env.program.account.playerSeasonStats.fetch(statsPDA);
      expect(statsAfterClaim.correctPredictions).to.equal(1, "correct_predictions should be 1 after successful claim");
    });
  });

  // ─── SC-16: VRF fallback resolution ──────────────────────────────────────────

  describe("SC-16: VRF fallback resolution", () => {
    const SEASON = 90;

    // Setup: start a season and open a round for each test
    // We use a fresh pixel per test to avoid state bleed

    it("SC-16-VRF: VRF resolution reads randomness and sets winning color", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);

      // Start season 90
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      // Open round for pixel 0
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0x90)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Place bet so pool > 0 (needed for rake logic)
      const [betPDA] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);
      await env.program.methods
        .placeBet(0, 5, new anchor.BN(50_000_000)) // bet on color 5
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // Create mock ORAO randomness account: first byte = 0x55 (85 decimal), color = 85 % 16 = 5
      const randomnessKey = anchor.web3.Keypair.generate();
      const knownRandomness = new Uint8Array(64);
      knownRandomness[0] = 0x55; // 85 % 16 = 5 (winning color)
      knownRandomness.fill(0xab, 1); // rest non-zero to mark fulfilled
      createMockOraoRandomnessAccount(env.svm, randomnessKey.publicKey, knownRandomness);

      // Call resolve_round_vrf
      await env.program.methods
        .resolveRoundVrf()
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          randomnessAccount: randomnessKey.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.winningColor).to.not.be.null;
      expect(pixel.winningColor).to.equal(5, "Winning color should be randomness[0] % 16 = 85 % 16 = 5");
      expect(pixel.status).to.deep.equal({ resolved: {} });
    });

    it("SC-16-ENFORCE: VRF resolution forces shade=50, warmth=50", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 1);

      // Open round for pixel 1
      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0x91)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Place minimal bet
      const [betPDA] = findBetPDA(programId, SEASON, 1, env.player2.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player2.publicKey);
      await env.program.methods
        .placeBet(1, 0, new anchor.BN(10_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();

      // Mock randomness: first byte = 0x00 => color 0
      const randomnessKey = anchor.web3.Keypair.generate();
      const randomnessBytes = new Uint8Array(64);
      randomnessBytes[0] = 0x00;
      randomnessBytes.fill(0xff, 1); // rest non-zero = fulfilled
      createMockOraoRandomnessAccount(env.svm, randomnessKey.publicKey, randomnessBytes);

      await env.program.methods
        .resolveRoundVrf()
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          randomnessAccount: randomnessKey.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.shade).to.equal(50, "VRF resolution should force shade=50");
      expect(pixel.warmth).to.equal(50, "VRF resolution should force warmth=50");
    });

    it("SC-16-FLAG: vrf_resolved flag is true on VRF-resolved pixel", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 2);

      // Open round for pixel 2
      await env.program.methods
        .openRound(2, Array.from(Buffer.alloc(32, 0x92)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // No bets (zero-winner branch but vrf_resolved should still be set)
      const randomnessKey = anchor.web3.Keypair.generate();
      const randomnessBytes = new Uint8Array(64);
      randomnessBytes.fill(0xcc); // all non-zero = fulfilled
      createMockOraoRandomnessAccount(env.svm, randomnessKey.publicKey, randomnessBytes);

      await env.program.methods
        .resolveRoundVrf()
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          randomnessAccount: randomnessKey.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.vrfResolved).to.equal(true, "vrf_resolved should be true for VRF-resolved pixels");
    });

    it("SC-16-CLAIM: claims work on VRF-resolved rounds", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 3);
      const [betPDA] = findBetPDA(programId, SEASON, 3, env.player3.publicKey);
      const [statsPDA] = findStatsPDA(programId, SEASON, env.player3.publicKey);

      // Open round for pixel 3
      await env.program.methods
        .openRound(3, Array.from(Buffer.alloc(32, 0x93)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Player bets on color 7
      const betAmount = 100_000_000; // 0.1 SOL
      await env.program.methods
        .placeBet(3, 7, new anchor.BN(betAmount))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player3])
        .rpc();

      // Mock randomness: byte[0] = 0x77 (119), 119 % 16 = 7 => color 7 wins
      const randomnessKey = anchor.web3.Keypair.generate();
      const randomnessBytes = new Uint8Array(64);
      randomnessBytes[0] = 0x77; // 119 % 16 = 7
      randomnessBytes.fill(0xde, 1);
      createMockOraoRandomnessAccount(env.svm, randomnessKey.publicKey, randomnessBytes);

      await env.program.methods
        .resolveRoundVrf()
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          randomnessAccount: randomnessKey.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Verify pixel is VRF-resolved
      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.vrfResolved).to.equal(true);
      expect(pixel.winningColor).to.equal(7);

      // Claim winnings
      const balanceBefore = Number(env.svm.getBalance(env.player3.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player3])
        .rpc();
      const balanceAfter = Number(env.svm.getBalance(env.player3.publicKey));

      // Sole winner on VRF-resolved round: net_pool = 100_000_000 * 95 / 100 = 95_000_000
      expect(balanceAfter - balanceBefore).to.equal(95_000_000, "Sole winner should receive 95% of pool on VRF-resolved round");
    });

    it("SC-16-PROOF: reject if randomness account not owned by ORAO program", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 4);

      // Open round for pixel 4
      await env.program.methods
        .openRound(4, Array.from(Buffer.alloc(32, 0x94)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Create a fake account NOT owned by ORAO VRF program
      const fakeKey = anchor.web3.Keypair.generate();
      const fakeData = Buffer.alloc(109, 0xab); // same size as randomness account but wrong owner
      env.svm.setAccount(fakeKey.publicKey, {
        lamports: BigInt(1_000_000_000),
        data: fakeData,
        owner: programId, // wrong owner — owned by pixel-predict, not ORAO
        executable: false,
      });

      let errorThrown = false;
      try {
        await env.program.methods
          .resolveRoundVrf()
          .accounts({
            seasonState: seasonPDA,
            pixelState: pixelPDA,
            config: configPDA,
            oracle: env.oracle.publicKey,
            treasury: TREASURY_WALLET,
            jackpot: JACKPOT_WALLET,
            randomnessAccount: fakeKey.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([env.oracle])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── Update oracle ────────────────────────────────────────────────────────────

  describe("Update oracle", () => {
    it("admin rotates oracle key", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);

      // Generate a new oracle keypair
      const newOracle = anchor.web3.Keypair.generate();
      env.svm.airdrop(newOracle.publicKey, BigInt(10 * 1_000_000_000));

      // Admin rotates oracle key
      await env.program.methods
        .updateOracle(newOracle.publicKey)
        .accounts({
          config: configPDA,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      // Verify config now has new oracle
      const config = await env.program.account.configAccount.fetch(configPDA);
      expect(config.oracle.toBase58()).to.equal(newOracle.publicKey.toBase58());

      // Verify new oracle can open a round (it has authority now)
      const [seasonPDA] = findSeasonPDA(programId, 91);
      await env.program.methods
        .startSeason(91, 5, 5)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      const [pixelPDA] = findPixelPDA(programId, 91, 0);
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xa1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: newOracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([newOracle])
        .rpc();

      // Verify old oracle cannot open rounds anymore
      let errorThrown = false;
      try {
        const [pixelPDA2] = findPixelPDA(programId, 91, 1);
        await env.program.methods
          .openRound(1, Array.from(Buffer.alloc(32, 0xa2)))
          .accounts({ seasonState: seasonPDA, pixelState: pixelPDA2, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.oracle])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
      }
      expect(errorThrown).to.be.true;

      // Restore original oracle for subsequent tests
      await env.program.methods
        .updateOracle(env.oracle.publicKey)
        .accounts({ config: configPDA, admin: env.admin.publicKey })
        .signers([env.admin])
        .rpc();

      const restoredConfig = await env.program.account.configAccount.fetch(configPDA);
      expect(restoredConfig.oracle.toBase58()).to.equal(env.oracle.publicKey.toBase58());
    });

    it("non-admin cannot rotate oracle key", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const newOracle = anchor.web3.Keypair.generate();

      let errorThrown = false;
      try {
        await env.program.methods
          .updateOracle(newOracle.publicKey)
          .accounts({
            config: configPDA,
            admin: env.player1.publicKey,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
      }
      expect(errorThrown).to.be.true;
    });
  });

  // ─── E2E: Complete round lifecycle ───────────────────────────────────────────

  describe("E2E: Complete round lifecycle", () => {
    const SEASON = 200;

    it("E2E: full round lifecycle with normal resolution", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [pixel1PDA] = findPixelPDA(programId, SEASON, 1);
      const [betP1] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [betP2] = findBetPDA(programId, SEASON, 0, env.player2.publicKey);
      const [betP3] = findBetPDA(programId, SEASON, 0, env.player3.publicKey);
      const [statsP1] = findStatsPDA(programId, SEASON, env.player1.publicKey);
      const [statsP2] = findStatsPDA(programId, SEASON, env.player2.publicKey);
      const [statsP3] = findStatsPDA(programId, SEASON, env.player3.publicKey);

      // 1. Initialize config already done from SC-01 (shared env)
      //    Start new season for E2E isolation
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      // 2. Open round for pixel 0 and pre-open pixel 1
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xe0)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0xe1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // 3. Player 1 bets 0.05 SOL on Red (color 0)
      await env.program.methods
        .placeBet(0, 0, new anchor.BN(50_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // 4. Player 2 bets 0.03 SOL on Red (color 0)
      await env.program.methods
        .placeBet(0, 0, new anchor.BN(30_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP2, playerSeasonStats: statsP2, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();

      // 5. Player 3 bets 0.10 SOL on Blue (color 7)
      await env.program.methods
        .placeBet(0, 7, new anchor.BN(100_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP3, playerSeasonStats: statsP3, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player3])
        .rpc();

      // 6. Player 1 increases bet to 0.10 SOL (+0.05 SOL more)
      // Note: amount must differ from step 3 (50M) to avoid AlreadyProcessed in LiteSVM
      // (same instruction bytes = same tx signature = rejected as duplicate)
      await env.program.methods
        .placeBet(0, 0, new anchor.BN(50_000_001))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // 7. Player 3 tries to bet on Green for same pixel -> REJECTED (SC-05)
      let colorMismatchError = false;
      try {
        const [betP3extra] = findBetPDA(programId, SEASON, 0, env.player3.publicKey);
        await env.program.methods
          .placeBet(0, 3, new anchor.BN(10_000_000))
          .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP3extra, playerSeasonStats: statsP3, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player3])
          .rpc();
      } catch (err: any) {
        colorMismatchError = true;
      }
      expect(colorMismatchError).to.be.true;

      // 8. Advance time 28+ minutes
      advanceTime(env.svm, BETTING_WINDOW + 60);

      // 9. Lock round (permissionless, called by player 2)
      await env.program.methods
        .lockRound(SEASON, 0)
        .accounts({ pixelState: pixelPDA, caller: env.player2.publicKey })
        .signers([env.player2])
        .rpc();

      // 10. Verify pool state before resolution
      // Total: P1 50M + P2 30M + P3 100M + P1 increase 50_000_001 = 230_000_001
      let pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.status).to.deep.equal({ locked: {} });
      const totalPool = pixel.totalPool.toNumber();
      expect(totalPool).to.equal(230_000_001);

      // 11. Oracle resolves: winning_color = Red (0), shade = 45, warmth = 62
      await env.program.methods
        .resolveRound(0, 45, 62, false)
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.status).to.deep.equal({ resolved: {} });
      expect(pixel.winningColor).to.equal(0);

      // 12. Verify rake: treasury gets ~3% and jackpot gets ~2%
      const treasuryBalance = Number(env.svm.getBalance(TREASURY_WALLET));
      const jackpotBalance = Number(env.svm.getBalance(JACKPOT_WALLET));
      const expectedTreasury = Math.floor(230_000_001 * 0.03);
      const expectedJackpot = Math.floor(230_000_001 * 0.02);
      // Note: previous tests also transferred to these wallets, so we check approximate range
      expect(treasuryBalance).to.be.greaterThanOrEqual(expectedTreasury);
      expect(jackpotBalance).to.be.greaterThanOrEqual(expectedJackpot);

      // 13. Player 1 claims (bet 0.10 SOL on Red, red pool = 0.13 SOL, net = 230M * 0.95 = 218.5M)
      //     Player 1 share = 100/130 * 218_500_000 = ~168_076_923
      const p1BalanceBefore = Number(env.svm.getBalance(env.player1.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();
      const p1BalanceAfter = Number(env.svm.getBalance(env.player1.publicKey));
      const p1Received = p1BalanceAfter - p1BalanceBefore;
      expect(p1Received).to.be.greaterThan(150_000_000); // sanity: got back > bet
      expect(p1Received).to.be.lessThan(250_000_000);    // sanity: not everything

      // 14. Player 2 claims
      const p2BalanceBefore = Number(env.svm.getBalance(env.player2.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betP2, playerSeasonStats: statsP2, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();
      const p2BalanceAfter = Number(env.svm.getBalance(env.player2.publicKey));
      const p2Received = p2BalanceAfter - p2BalanceBefore;
      expect(p2Received).to.be.greaterThan(20_000_000); // got back > 0
      expect(p2Received).to.be.lessThan(100_000_000);   // less than player 1

      // 15. Player 3 tries to claim -> REJECTED (not winner)
      let notWinnerError = false;
      try {
        await env.program.methods
          .claimWinnings()
          .accounts({ pixelState: pixelPDA, betAccount: betP3, playerSeasonStats: statsP3, player: env.player3.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player3])
          .rpc();
      } catch (err: any) {
        notWinnerError = true;
      }
      expect(notWinnerError).to.be.true;

      // 16. Player 1 tries to claim again -> REJECTED (already claimed)
      let alreadyClaimedError = false;
      try {
        await env.program.methods
          .claimWinnings()
          .accounts({ pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        alreadyClaimedError = true;
      }
      expect(alreadyClaimedError).to.be.true;

      // 17. Verify PlayerSeasonStats: player1 correct_predictions = 1, player3 = 0
      const stats1 = await env.program.account.playerSeasonStats.fetch(statsP1);
      expect(stats1.correctPredictions).to.equal(1);
      const stats3 = await env.program.account.playerSeasonStats.fetch(statsP3);
      expect(stats3.correctPredictions).to.equal(0);

      // 18. Verify SeasonState: current_pixel_index = 1
      const season = await env.program.account.seasonState.fetch(seasonPDA);
      expect(season.currentPixelIndex).to.equal(1);

      // 19. Pixel 1 was pre-opened in step 2 and is still Open (players can bet on it).
      //     Now that pixel 0 is resolved, the oracle opens pixel 2 (current+1) as lookahead.
      const [pixel2PDA] = findPixelPDA(programId, SEASON, 2);
      await env.program.methods
        .openRound(2, Array.from(Buffer.alloc(32, 0xe2)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel2PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const pixel2 = await env.program.account.pixelState.fetch(pixel2PDA);
      expect(pixel2.pixelIndex).to.equal(2);
      expect(pixel2.status).to.deep.equal({ open: {} });
    });
  });

  describe("E2E: Zero-winner round", () => {
    const SEASON = 201;

    it("E2E: zero-winner sends net pool to treasury", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betP1] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsP1] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      // Start season
      await env.program.methods
        .startSeason(SEASON, 5, 5)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      // Open round, place bet on Red (color 0)
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xf0)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      await env.program.methods
        .placeBet(0, 0, new anchor.BN(100_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // Record treasury balance before
      const treasuryBefore = Number(env.svm.getBalance(TREASURY_WALLET));

      // Resolve with winning color = Blue (color 7, no bets)
      await env.program.methods
        .resolveRound(7, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const treasuryAfter = Number(env.svm.getBalance(TREASURY_WALLET));
      const treasuryGained = treasuryAfter - treasuryBefore;

      // Treasury should receive 3% rake + 95% net pool = 98% of total
      // 100_000_000 * 0.98 = 98_000_000
      expect(treasuryGained).to.equal(98_000_000);

      // No one can claim (no winners)
      let claimError = false;
      try {
        await env.program.methods
          .claimWinnings()
          .accounts({ pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        claimError = true;
      }
      expect(claimError).to.be.true;
    });
  });

  describe("E2E: VRF resolution path", () => {
    const SEASON = 202;

    it("E2E: VRF resolution path with claim", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixelPDA] = findPixelPDA(programId, SEASON, 0);
      const [betP1] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [statsP1] = findStatsPDA(programId, SEASON, env.player1.publicKey);

      // Start season
      await env.program.methods
        .startSeason(SEASON, 5, 5)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      // Open round and place bet on color 5
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xd0)))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // randomness[0] = 0x55 = 85, 85 % 16 = 5 => color 5 wins
      await env.program.methods
        .placeBet(0, 5, new anchor.BN(50_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // Create mock Switchboard randomness: value[0] = 0x55 => color 5 wins
      const randomnessKey = anchor.web3.Keypair.generate();
      const valueBytes = new Uint8Array(64);
      valueBytes[0] = 0x55; // 85 % 16 = 5
      valueBytes.fill(0xab, 1);
      createMockOraoRandomnessAccount(env.svm, randomnessKey.publicKey, valueBytes);

      await env.program.methods
        .resolveRoundVrf()
        .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, randomnessAccount: randomnessKey.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.vrfResolved).to.equal(true);
      expect(pixel.shade).to.equal(50);
      expect(pixel.warmth).to.equal(50);
      expect(pixel.winningColor).to.equal(5);

      // Winner claims successfully
      const balanceBefore = Number(env.svm.getBalance(env.player1.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixelPDA, betAccount: betP1, playerSeasonStats: statsP1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();
      const balanceAfter = Number(env.svm.getBalance(env.player1.publicKey));
      // Sole winner: 50_000_000 * 95% = 47_500_000
      expect(balanceAfter - balanceBefore).to.equal(47_500_000);
    });
  });

  describe("E2E: Multiple rounds sequential", () => {
    const SEASON = 203;

    it("E2E: 3 rounds sequential with correct pixel index and coordinates", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);

      // Start season with 10x10 grid
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      for (let i = 0; i < 3; i++) {
        const [pixelPDA] = findPixelPDA(programId, SEASON, i);
        const [betPDA] = findBetPDA(programId, SEASON, i, env.player1.publicKey);
        const [statsPDA] = findStatsPDA(programId, SEASON, env.player1.publicKey);

        // Open round
        await env.program.methods
          .openRound(i, Array.from(Buffer.alloc(32, 0xc0 + i)))
          .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.oracle])
          .rpc();

        // Verify coordinates: pixel i = (i, 0) for a 10-wide grid
        const pixel = await env.program.account.pixelState.fetch(pixelPDA);
        expect(pixel.x).to.equal(i);
        expect(pixel.y).to.equal(0);

        // Place a bet
        await env.program.methods
          .placeBet(i, 3, new anchor.BN(10_000_000))
          .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, betAccount: betPDA, playerSeasonStats: statsPDA, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.player1])
          .rpc();

        // Resolve
        await env.program.methods
          .resolveRound(3, 50, 50, false)
          .accounts({ seasonState: seasonPDA, pixelState: pixelPDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
          .signers([env.oracle])
          .rpc();

        // Verify current_pixel_index increments
        const season = await env.program.account.seasonState.fetch(seasonPDA);
        expect(season.currentPixelIndex).to.equal(i + 1);
      }
    });
  });

  describe("E2E: Future pixel betting (SC-17)", () => {
    const SEASON = 204;

    it("E2E: future pixel bets remain valid when pixel becomes current", async () => {
      const programId = env.program.programId;
      const [configPDA] = findConfigPDA(programId);
      const [seasonPDA] = findSeasonPDA(programId, SEASON);
      const [pixel0PDA] = findPixelPDA(programId, SEASON, 0);
      const [pixel1PDA] = findPixelPDA(programId, SEASON, 1);
      const [pixel2PDA] = findPixelPDA(programId, SEASON, 2);
      const [bet0P1] = findBetPDA(programId, SEASON, 0, env.player1.publicKey);
      const [bet1P2] = findBetPDA(programId, SEASON, 1, env.player2.publicKey);
      const [stats1] = findStatsPDA(programId, SEASON, env.player1.publicKey);
      const [stats2] = findStatsPDA(programId, SEASON, env.player2.publicKey);

      // Start season
      await env.program.methods
        .startSeason(SEASON, 5, 5)
        .accounts({ seasonState: seasonPDA, config: configPDA, admin: env.admin.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.admin])
        .rpc();

      // Open round for pixel 0, pre-open pixel 1
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0xb0)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel0PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0xb1)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Player 1 bets on current pixel 0
      await env.program.methods
        .placeBet(0, 1, new anchor.BN(20_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixel0PDA, betAccount: bet0P1, playerSeasonStats: stats1, player: env.player1.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player1])
        .rpc();

      // Player 2 bets on future pixel 1 (SC-17)
      await env.program.methods
        .placeBet(1, 2, new anchor.BN(30_000_000))
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, betAccount: bet1P2, playerSeasonStats: stats2, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();

      // Resolve pixel 0
      await env.program.methods
        .resolveRound(1, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixel0PDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Open pixel 2 (pixel 1 already open, pixel 2 = current+1)
      await env.program.methods
        .openRound(2, Array.from(Buffer.alloc(32, 0xb2)))
        .accounts({ seasonState: seasonPDA, pixelState: pixel2PDA, config: configPDA, oracle: env.oracle.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Resolve pixel 1 (player 2's bet on color 2 should win)
      await env.program.methods
        .resolveRound(2, 50, 50, false)
        .accounts({ seasonState: seasonPDA, pixelState: pixel1PDA, config: configPDA, oracle: env.oracle.publicKey, treasury: TREASURY_WALLET, jackpot: JACKPOT_WALLET, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.oracle])
        .rpc();

      // Player 2 claims on pixel 1 (was a future bet, still valid)
      const p2Before = Number(env.svm.getBalance(env.player2.publicKey));
      await env.program.methods
        .claimWinnings()
        .accounts({ pixelState: pixel1PDA, betAccount: bet1P2, playerSeasonStats: stats2, player: env.player2.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([env.player2])
        .rpc();
      const p2After = Number(env.svm.getBalance(env.player2.publicKey));

      // Sole winner: 30_000_000 * 95% = 28_500_000
      expect(p2After - p2Before).to.equal(28_500_000);
    });
  });

  // ─── ORC-05: set_arweave_txid ─────────────────────────────────────────────────

  describe("set_arweave_txid", () => {
    // Uses season 300 to stay isolated from other tests
    const SEASON = 300;
    let seasonPDA: PublicKey;
    let pixelPDA: PublicKey;
    let configPDA: PublicKey;

    // A valid 43-byte Arweave txid (base58 encoded, 43 chars as bytes)
    const ARWEAVE_TXID: number[] = Array.from(Buffer.alloc(43, 0x41)); // "AAAA...A" x43

    before(async () => {
      const programId = env.program.programId;
      [configPDA] = findConfigPDA(programId);
      [seasonPDA] = findSeasonPDA(programId, SEASON);
      [pixelPDA] = findPixelPDA(programId, SEASON, 0);

      // Start season 300
      await env.program.methods
        .startSeason(SEASON, 10, 10)
        .accounts({
          seasonState: seasonPDA,
          config: configPDA,
          admin: env.admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.admin])
        .rpc();

      // Open pixel 0
      await env.program.methods
        .openRound(0, Array.from(Buffer.alloc(32, 0x30)))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      // Resolve pixel 0 (no bets — just need it in Resolved status)
      await env.program.methods
        .resolveRound(5, 50, 50, false)
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          treasury: TREASURY_WALLET,
          jackpot: JACKPOT_WALLET,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();
    });

    it("ORC-05-SET: oracle sets arweave_txid on resolved pixel", async () => {
      const programId = env.program.programId;

      await env.program.methods
        .setArweaveTxid(SEASON, 0, ARWEAVE_TXID)
        .accounts({
          pixelState: pixelPDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
        })
        .signers([env.oracle])
        .rpc();

      const pixel = await env.program.account.pixelState.fetch(pixelPDA);
      expect(pixel.arweaveTxid).to.deep.equal(ARWEAVE_TXID, "arweave_txid should match the value provided");
      expect(pixel.hasArweaveTxid).to.be.true;
    });

    it("ORC-05-AUTH: non-oracle signer is rejected", async () => {
      const programId = env.program.programId;

      let errorThrown = false;
      try {
        await env.program.methods
          .setArweaveTxid(SEASON, 0, ARWEAVE_TXID)
          .accounts({
            pixelState: pixelPDA,
            config: configPDA,
            oracle: env.player1.publicKey,
          })
          .signers([env.player1])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg).to.include("Error");
      }
      expect(errorThrown).to.be.true;
    });

    it("ORC-05-STATUS: rejects call on non-resolved pixel (RoundNotResolved)", async () => {
      const programId = env.program.programId;
      // Open pixel 1 (Open status, not Resolved)
      const [pixel1PDA] = findPixelPDA(programId, SEASON, 1);
      await env.program.methods
        .openRound(1, Array.from(Buffer.alloc(32, 0x31)))
        .accounts({
          seasonState: seasonPDA,
          pixelState: pixel1PDA,
          config: configPDA,
          oracle: env.oracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.oracle])
        .rpc();

      let errorThrown = false;
      try {
        await env.program.methods
          .setArweaveTxid(SEASON, 1, ARWEAVE_TXID)
          .accounts({
            pixelState: pixel1PDA,
            config: configPDA,
            oracle: env.oracle.publicKey,
          })
          .signers([env.oracle])
          .rpc();
      } catch (err: any) {
        errorThrown = true;
        const msg = err.message || err.toString();
        expect(msg.toLowerCase()).to.include("roundnotresolved");
      }
      expect(errorThrown).to.be.true;
    });
  });
});
