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
 * - Current canvas state (all resolved pixels)
 * - Current pixel to paint (coordinates)
 * - Neighboring pixels (all 8 adjacent positions)
 * - Last up to 5 round history entries with reasoning
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

  // --- Canvas State ---
  lines.push("Current canvas state:");
  if (canvasPixels.length === 0) {
    lines.push("No pixels filled yet.");
  } else {
    for (const p of canvasPixels) {
      lines.push(`(${p.x}, ${p.y}): ${p.color}, shade ${p.shade}, warmth ${p.warmth}`);
    }
  }

  lines.push("");

  // --- Current Pixel ---
  lines.push(`Current pixel to paint: (${currentX}, ${currentY})`);

  lines.push("");

  // --- Neighbors ---
  lines.push("Neighboring pixels:");

  // Build a lookup map for fast neighbor checks
  const pixelMap = new Map<string, PixelData>();
  for (const p of canvasPixels) {
    pixelMap.set(`${p.x},${p.y}`, p);
  }

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
      lines.push(`(${nx}, ${ny}): ${neighbor.color}, shade ${neighbor.shade}, warmth ${neighbor.warmth}`);
    } else {
      lines.push(`(${nx}, ${ny}): empty`);
    }
  }

  lines.push("");

  // --- Last 5 Selections ---
  lines.push("Your last 5 selections:");
  const recentHistory = history.slice(-5);
  if (recentHistory.length === 0) {
    lines.push("No previous selections.");
  } else {
    recentHistory.forEach((entry, idx) => {
      lines.push(
        `${idx + 1}. (${entry.x}, ${entry.y}): ${entry.color}, shade ${entry.shade}, warmth ${entry.warmth} - "${entry.reasoning}"`
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
