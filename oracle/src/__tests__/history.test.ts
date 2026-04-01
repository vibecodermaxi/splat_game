import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { RoundHistory } from "../history";
import type { RoundHistoryEntry } from "../types";

function makeEntry(pixelIndex: number): RoundHistoryEntry {
  return {
    pixelIndex,
    x: pixelIndex % 10,
    y: Math.floor(pixelIndex / 10),
    color: "Blue",
    shade: 50,
    warmth: 50,
    reasoning: `Reasoning for pixel ${pixelIndex}`,
  };
}

describe("RoundHistory", () => {
  let tmpDir: string;
  let historyPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-test-"));
    historyPath = path.join(tmpDir, "round_history.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("Test 1: read returns empty array when file does not exist", async () => {
    const history = new RoundHistory(historyPath);
    const entries = await history.read();
    expect(entries).to.deep.equal([]);
  });

  it("Test 2: read returns empty array when file contains invalid JSON", async () => {
    fs.writeFileSync(historyPath, "not valid json {{{", "utf8");
    const history = new RoundHistory(historyPath);
    const entries = await history.read();
    expect(entries).to.deep.equal([]);
  });

  it("Test 3: push adds entry and persists to file", async () => {
    const history = new RoundHistory(historyPath);
    const entry = makeEntry(1);
    await history.push(entry);

    const entries = await history.read();
    expect(entries).to.have.length(1);
    expect(entries[0]).to.deep.equal(entry);
  });

  it("Test 4: push keeps only the last 20 entries (oldest dropped)", async () => {
    const history = new RoundHistory(historyPath);
    for (let i = 0; i < 23; i++) {
      await history.push(makeEntry(i));
    }
    const entries = await history.read();
    expect(entries).to.have.length(20);
    expect(entries[0].pixelIndex).to.equal(3);
    expect(entries[19].pixelIndex).to.equal(22);
  });

  it("Test 5: after push, reading from a new RoundHistory instance returns the same data", async () => {
    const history1 = new RoundHistory(historyPath);
    const entry = makeEntry(42);
    await history1.push(entry);

    const history2 = new RoundHistory(historyPath);
    const entries = await history2.read();
    expect(entries).to.have.length(1);
    expect(entries[0]).to.deep.equal(entry);
  });

  it("Test 6: push writes atomically (temp file does not exist after push completes)", async () => {
    const history = new RoundHistory(historyPath);
    const entry = makeEntry(10);
    await history.push(entry);

    const tmpFile = historyPath + ".tmp";
    expect(fs.existsSync(tmpFile)).to.equal(false);
    expect(fs.existsSync(historyPath)).to.equal(true);
  });
});
