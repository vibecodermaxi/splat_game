import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { ChainClient } from "../chain";

const PROGRAM_ID = new PublicKey("FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG");

describe("ChainClient PDA derivation", () => {
  it("Test 1: deriveConfigPDA returns expected PDA for program ID", () => {
    const [configPda] = ChainClient.deriveConfigPDA(PROGRAM_ID);
    // Derive the expected PDA manually using the same seed pattern
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );
    expect(configPda.toBase58()).to.equal(expected.toBase58());
  });

  it("Test 2: deriveSeasonPDA returns expected PDA for season 1", () => {
    const [seasonPda] = ChainClient.deriveSeasonPDA(PROGRAM_ID, 1);
    const seasonBuf = Buffer.alloc(2);
    seasonBuf.writeUInt16LE(1, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("season"), seasonBuf],
      PROGRAM_ID
    );
    expect(seasonPda.toBase58()).to.equal(expected.toBase58());
  });

  it("Test 3: derivePixelPDA returns expected PDA for season 1, pixel 0", () => {
    const [pixelPda] = ChainClient.derivePixelPDA(PROGRAM_ID, 1, 0);
    const seasonBuf = Buffer.alloc(2);
    seasonBuf.writeUInt16LE(1, 0);
    const pixelBuf = Buffer.alloc(2);
    pixelBuf.writeUInt16LE(0, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), seasonBuf, pixelBuf],
      PROGRAM_ID
    );
    expect(pixelPda.toBase58()).to.equal(expected.toBase58());
  });

  it("Test 4: IDL loads correctly — ChainClient can find pixel_predict.json", () => {
    // The ChainClient constructor loads the IDL from ../../target/idl/pixel_predict.json
    // relative to oracle/src/ (i.e., <project_root>/target/idl/pixel_predict.json).
    // From the test file at oracle/src/__tests__/, the path is ../../../target/idl/...
    // This test confirms the IDL file exists and has the correct structure,
    // which is a prerequisite for ChainClient construction to succeed.
    expect(() => {
      // Path relative to oracle/src/__tests__/ -> go three levels up to project root
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const idl = require("../../../target/idl/pixel_predict.json");
      expect(idl).to.have.property("address");
      expect(idl.address).to.equal("FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG");
    }).not.to.throw();
  });
});
