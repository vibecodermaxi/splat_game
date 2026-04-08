/**
 * Prompt construction module for the Pixel Predict oracle service.
 *
 * Builds the system prompt and per-round user message for Claude API calls.
 * The combined prompt is SHA-256 hashed for commit-reveal on-chain storage.
 *
 * IMPORTANT: Never normalize or trim the prompt after construction.
 * The exact string that is hashed must match the uploaded Arweave content verbatim.
 * Line endings are always \n (never \r\n).
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { PixelData, RoundHistoryEntry } from "./types";

// Cache the system prompt template after first read.
let _cachedTemplate: string | null = null;

/**
 * Load the system prompt template from disk (cached after first call).
 * Template file path: oracle/config/system-prompt.txt
 */
function loadTemplate(): string {
  if (_cachedTemplate === null) {
    const templatePath = path.resolve(
      __dirname,
      "../config/system-prompt.txt"
    );
    _cachedTemplate = fs.readFileSync(templatePath, "utf8");
  }
  return _cachedTemplate;
}

/**
 * Build the system prompt by injecting grid dimensions and season style summary
 * into the template loaded from config/system-prompt.txt.
 *
 * @param gridWidth  Canvas width in pixels
 * @param gridHeight Canvas height in pixels
 * @param seasonStyleSummary Artistic direction for this season (empty string for Season 1)
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(
  gridWidth: number,
  gridHeight: number,
  seasonStyleSummary: string
): string {
  const template = loadTemplate();
  return template
    .replace(/\{grid_width\}/g, String(gridWidth))
    .replace(/\{grid_height\}/g, String(gridHeight))
    .replace(/\{season_style_summary\}/g, seasonStyleSummary);
}

/**
 * Build the per-round user message for Claude.
 *
 * Includes:
 * - Canvas position context (row/col progress)
 * - Current canvas state as a visual grid map
 * - Current pixel to paint (coordinates)
 * - Neighboring pixels (all 8 adjacent positions)
 * - Last up to 20 round history entries with reasoning
 * - Final instruction line
 *
 * @param canvasPixels All currently filled pixels on the canvas
 * @param currentX     X coordinate of the pixel to paint
 * @param currentY     Y coordinate of the pixel to paint
 * @param gridWidth    Canvas width (used to validate neighbor bounds)
 * @param gridHeight   Canvas height (used to validate neighbor bounds)
 * @param history      Ordered round history (most recent last); last 5 are used
 * @returns User message string
 */
export function buildUserMessage(
  canvasPixels: PixelData[],
  currentX: number,
  currentY: number,
  gridWidth: number,
  gridHeight: number,
  history: RoundHistoryEntry[]
): string {
  const lines: string[] = [];

  // Build a lookup map for fast neighbor/grid checks
  const pixelMap = new Map<string, PixelData>();
  for (const p of canvasPixels) {
    pixelMap.set(`${p.x},${p.y}`, p);
  }

  // --- Spatial Context ---
  const row = currentY + 1;
  const col = currentX + 1;
  const filledRows = currentY > 0 ? currentY : 0;
  lines.push(`Canvas progress: Row ${row} of ${gridHeight}, Column ${col} of ${gridWidth} (${canvasPixels.length} of ${gridWidth * gridHeight} pixels filled).`);
  if (filledRows > 0) {
    lines.push(`You have completed ${filledRows} full row${filledRows > 1 ? "s" : ""}.`);
  }

  lines.push("");

  // --- Visual Grid Map ---
  // First letter of each color, "." for empty, "*" for current pixel
  // Color key: R=Red O=Orange Y=Yellow L=Lime G=Green T=Teal C=Cyan B=Blue
  //            I=Indigo P=Purple K=Pink M=Magenta W=Brown A=Gray X=Black H=White
  const colorAbbrev: Record<string, string> = {
    Red: "R", Orange: "O", Yellow: "Y", Lime: "L", Green: "G", Teal: "T",
    Cyan: "C", Blue: "B", Indigo: "I", Purple: "P", Pink: "K", Magenta: "M",
    Brown: "W", Gray: "A", Black: "X", White: "H",
  };

  lines.push("Canvas grid (letter = color, . = empty, * = current pixel):");
  lines.push("Key: R=Red O=Orange Y=Yellow G=Green B=Blue P=Purple X=Black H=White");

  // Only render rows that have at least one filled pixel or contain the current pixel
  const maxRowToRender = Math.min(currentY + 2, gridHeight - 1);
  for (let y = 0; y <= maxRowToRender; y++) {
    let rowStr = "";
    for (let x = 0; x < gridWidth; x++) {
      if (x === currentX && y === currentY) {
        rowStr += "* ";
      } else {
        const p = pixelMap.get(`${x},${y}`);
        rowStr += p ? (colorAbbrev[p.color] ?? "?") + " " : ". ";
      }
    }
    const rowLabel = String(y).padStart(2, " ");
    lines.push(`  ${rowLabel}| ${rowStr.trimEnd()}`);
  }
  if (maxRowToRender < gridHeight - 1) {
    lines.push(`  ... (rows ${maxRowToRender + 1}-${gridHeight - 1} are empty)`);
  }

  lines.push("");

  // --- Current Pixel ---
  lines.push(`Current pixel to paint: (${currentX}, ${currentY})`);

  lines.push("");

  // --- Neighbors ---
  lines.push("Neighboring pixels:");

  // 8 adjacent directions: up, down, left, right, and 4 diagonals
  const directions = [
    [-1, -1], [0, -1], [1, -1], // top-left, top, top-right
    [-1,  0],          [1,  0], // left,           right
    [-1,  1], [0,  1], [1,  1], // bottom-left, bottom, bottom-right
  ];

  for (const [dx, dy] of directions) {
    const nx = currentX + dx;
    const ny = currentY + dy;
    // Only consider positions within grid bounds
    if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) {
      continue;
    }
    const neighbor = pixelMap.get(`${nx},${ny}`);
    if (neighbor) {
      lines.push(`(${nx}, ${ny}): ${neighbor.color}`);
    } else {
      lines.push(`(${nx}, ${ny}): empty`);
    }
  }

  lines.push("");

  // --- Last 20 Selections ---
  lines.push("Your last 20 selections:");
  const recentHistory = history.slice(-20);
  if (recentHistory.length === 0) {
    lines.push("No previous selections.");
  } else {
    recentHistory.forEach((entry, idx) => {
      lines.push(
        `${idx + 1}. (${entry.x}, ${entry.y}): ${entry.color} - "${entry.reasoning}"`
      );
    });
  }

  lines.push("");

  // --- Final instruction ---
  lines.push(`Select the color, shade, and warmth for pixel (${currentX}, ${currentY}).`);

  return lines.join("\n");
}

/**
 * Concatenate system prompt and user message for stable hashing.
 * The separator is exactly "\n\n" — deterministic, no trailing whitespace.
 *
 * @param systemPrompt The system prompt string
 * @param userMessage  The user message string
 * @returns Concatenated full prompt
 */
export function buildFullPrompt(
  systemPrompt: string,
  userMessage: string
): string {
  return systemPrompt + "\n\n" + userMessage;
}

/**
 * Compute SHA-256 hash of the full prompt.
 * Used for on-chain commit-reveal: the 32-byte hash is stored before Claude is called.
 *
 * @param fullPrompt The full concatenated prompt string
 * @returns 32-byte Buffer containing the SHA-256 digest
 */
export function hashPrompt(fullPrompt: string): Buffer {
  return createHash("sha256").update(Buffer.from(fullPrompt, "utf8")).digest();
}
