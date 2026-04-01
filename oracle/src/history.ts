import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "./logger";
import type { RoundHistoryEntry } from "./types";

/**
 * Manages the local round_history.json file — the oracle's only persistent local state.
 *
 * Guarantees:
 * - Reads are crash-safe: missing or corrupt files return an empty array
 * - Writes are atomic: uses a .tmp file + rename (atomic on Linux/macOS)
 * - History is capped at 20 entries (oldest dropped on overflow)
 */
export class RoundHistory {
  private filePath: string;

  /**
   * @param filePath - Path to the history JSON file.
   *   Defaults to round_history.json in the current working directory.
   */
  constructor(filePath: string = path.join(process.cwd(), "round_history.json")) {
    this.filePath = filePath;
  }

  /**
   * Read the current round history from disk.
   * Returns an empty array if the file does not exist or contains invalid JSON.
   */
  async read(): Promise<RoundHistoryEntry[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (err) {
      // ENOENT — file doesn't exist yet; expected on first run
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      // Other I/O error
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ event: "history_read_error", filePath: this.filePath, error: message });
      return [];
    }

    try {
      return JSON.parse(raw) as RoundHistoryEntry[];
    } catch {
      logger.warn({
        event: "history_parse_error",
        filePath: this.filePath,
        warning: "round_history.json contains invalid JSON — returning empty history",
      });
      return [];
    }
  }

  /**
   * Append an entry to the history and persist atomically.
   * Keeps only the last 20 entries (oldest dropped on overflow).
   *
   * Write is atomic: data is first written to `filePath.tmp`, then renamed
   * to `filePath`. On Linux/macOS, rename(2) is atomic within the same filesystem.
   */
  async push(entry: RoundHistoryEntry): Promise<void> {
    const current = await this.read();
    const updated = [...current, entry].slice(-20);

    const tmpPath = this.filePath + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), "utf8");
    await fs.rename(tmpPath, this.filePath);

    logger.info({
      event: "history_updated",
      entries: updated.length,
      pixelIndex: entry.pixelIndex,
    });
  }

  /**
   * Reconstruct history from on-chain state after a Railway container restart
   * (where round_history.json is lost).
   *
   * Fetches PixelState for the 20 most recent pixels before `currentPixel`,
   * builds RoundHistoryEntry objects from resolved pixels, and writes the
   * reconstructed history to disk.
   *
   * Note: `reasoning` will be empty string — it is never stored on-chain.
   *
   * @param chain - ChainClient instance (duck-typed to avoid circular imports)
   * @param seasonNumber - Current season number
   * @param currentPixel - Current pixel index; reconstructs pixels [currentPixel-20, currentPixel-1]
   */
  async reconstruct(
    chain: {
      getPixelState(
        seasonNumber: number,
        pixelIndex: number
      ): Promise<{
        x: number;
        y: number;
        status: string;
        winningColor: number | null;
        shade: number | null;
        warmth: number | null;
      } | null>;
    },
    seasonNumber: number,
    currentPixel: number
  ): Promise<void> {
    const startIndex = Math.max(0, currentPixel - 20);
    const entries: RoundHistoryEntry[] = [];

    for (let i = startIndex; i < currentPixel; i++) {
      try {
        const pixel = await chain.getPixelState(seasonNumber, i);
        if (
          pixel !== null &&
          pixel.status === "resolved" &&
          pixel.winningColor !== null &&
          pixel.shade !== null &&
          pixel.warmth !== null
        ) {
          // Import COLOR_NAMES lazily to avoid any potential circular imports at module level
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { COLOR_NAMES } = require("./types") as { COLOR_NAMES: string[] };
          entries.push({
            pixelIndex: i,
            x: pixel.x,
            y: pixel.y,
            color: COLOR_NAMES[pixel.winningColor] ?? "Unknown",
            shade: pixel.shade,
            warmth: pixel.warmth,
            reasoning: "",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({
          event: "history_reconstruct_pixel_failed",
          seasonNumber,
          pixelIndex: i,
          error: message,
        });
      }
    }

    const tmpPath = this.filePath + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(entries, null, 2), "utf8");
    await fs.rename(tmpPath, this.filePath);

    logger.info({
      event: "history_reconstructed",
      seasonNumber,
      currentPixel,
      entries: entries.length,
    });
  }
}
