/**
 * Shared type definitions for the Pixel Predict oracle service.
 */

/**
 * The 16 color names available in Pixel Predict, ordered by index.
 * Color index 0 = Red, 1 = Orange, ..., 15 = White.
 * Maps directly to the on-chain color enum (u8 value = index).
 */
export const COLOR_NAMES: string[] = [
  "Red",
  "Orange",
  "Yellow",
  "Lime",
  "Green",
  "Teal",
  "Cyan",
  "Blue",
  "Indigo",
  "Purple",
  "Pink",
  "Magenta",
  "Brown",
  "Gray",
  "Black",
  "White",
];

/**
 * The result of a Claude API call for a given pixel.
 */
export interface ClaudeResult {
  /** Index into COLOR_NAMES (0–15) */
  colorIndex: number;
  /** Human-readable color name (e.g., "Blue") */
  colorName: string;
  /** Shade modifier (0–100): 0 = lightest tint, 100 = deepest shade */
  shade: number;
  /** Warmth modifier (0–100): 0 = coolest variant, 100 = warmest */
  warmth: number;
  /** Claude's 1-2 sentence reasoning for the selection */
  reasoning: string;
}

/**
 * A single entry in the local round history file (round_history.json).
 * Used to construct the "your last 5 selections" section of the per-round prompt.
 */
export interface RoundHistoryEntry {
  pixelIndex: number;
  x: number;
  y: number;
  color: string;
  shade: number;
  warmth: number;
  reasoning: string;
}

/**
 * Resolved pixel data used for canvas state rendering in prompts.
 */
export interface PixelData {
  x: number;
  y: number;
  color: string;
  shade: number;
  warmth: number;
}

/**
 * The outcome of the round resolution process.
 * Either a Claude-driven result (vrf_resolved = false) or a VRF fallback result.
 *
 * VRF fallback always uses shade: 50, warmth: 50 (neutral defaults).
 */
export type ResolutionResult =
  | (ClaudeResult & { vrfResolved: false })
  | { colorIndex: number; shade: 50; warmth: 50; vrfResolved: true };
