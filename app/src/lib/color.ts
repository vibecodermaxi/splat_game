// Color names — must match oracle/src/types.ts COLOR_NAMES order exactly
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

// Base hex values from SPEC.md 16-color table
export const BASE_HEX: Record<string, string> = {
  Red: "#E53E3E",
  Orange: "#ED8936",
  Yellow: "#ECC94B",
  Lime: "#68D391",
  Green: "#38A169",
  Teal: "#38B2AC",
  Cyan: "#4FD1C5",
  Blue: "#4299E1",
  Indigo: "#5C6BC0",
  Purple: "#9F7AEA",
  Pink: "#ED64A6",
  Magenta: "#D53F8C",
  Brown: "#8B6C5C",
  Gray: "#A0AEC0",
  Black: "#2D3748",
  White: "#F7FAFC",
};

/**
 * Convert a #RRGGBB hex string to [H, S, L] (H in 0-360, S and L in 0-100).
 */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / delta + 2) * 60;
    } else {
      h = ((r - g) / delta + 4) * 60;
    }
  }

  return [h, s * 100, l * 100];
}

/**
 * Convert [H, S, L] (H in 0-360, S and L in 0-100) to a #RRGGBB hex string.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Compute the final rendered hex color for a pixel given its colorIndex, shade, and warmth.
 *
 * Formula (from SPEC.md):
 *   L_final = clamp(0, 100, L_base + (50 - shade) * 0.4)
 *   H_final = ((H_base + (warmth - 50) * 0.15) + 360) % 360
 *   S unchanged
 */
export function computePixelColor(
  colorIndex: number,
  shade: number,
  warmth: number
): string {
  const colorName = COLOR_NAMES[colorIndex];
  if (!colorName) {
    throw new Error(`Invalid colorIndex: ${colorIndex}`);
  }

  const baseHex = BASE_HEX[colorName];
  const [h, s, l] = hexToHsl(baseHex);

  const lFinal = Math.max(0, Math.min(100, l + (50 - shade) * 0.4));
  const hFinal = ((h + (warmth - 50) * 0.15) + 360) % 360;

  return hslToHex(hFinal, s, lFinal);
}
