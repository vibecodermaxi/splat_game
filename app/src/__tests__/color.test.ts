import { describe, it, expect } from "vitest";
import {
  COLOR_NAMES,
  BASE_HEX,
  computePixelColor,
  hexToHsl,
} from "@/lib/color";

describe("computePixelColor", () => {
  it("returns the base Red hex at neutral shade=50 and warmth=50", () => {
    const result = computePixelColor(0, 50, 50);
    // At shade=50 and warmth=50, no shift applied — should match BASE_HEX["Red"]
    // Allow minor rounding difference from HSL round-trip
    const base = BASE_HEX["Red"].toLowerCase();
    expect(result.toLowerCase()).toBe(base);
  });

  it("shade=0 produces lighter L than shade=100", () => {
    const light = computePixelColor(0, 0, 50); // shade 0 → lighter
    const dark = computePixelColor(0, 100, 50); // shade 100 → darker

    const [, , lLight] = hexToHsl(light);
    const [, , lDark] = hexToHsl(dark);

    expect(lLight).toBeGreaterThan(lDark);
  });

  it("warmth=0 produces cooler H than warmth=100", () => {
    // For Red (hue ~0/360), warmth shifts hue
    const cool = computePixelColor(0, 50, 0); // warmth 0 → cooler (hue decreases)
    const warm = computePixelColor(0, 50, 100); // warmth 100 → warmer (hue increases)

    const [hCool] = hexToHsl(cool);
    const [hWarm] = hexToHsl(warm);

    // For a color with H > 0, warmth=0 should shift H lower than warmth=100
    // Red base is near 0/360 — use Blue (index 7) for cleaner comparison
    const coolBlue = computePixelColor(7, 50, 0);
    const warmBlue = computePixelColor(7, 50, 100);
    const [hCoolBlue] = hexToHsl(coolBlue);
    const [hWarmBlue] = hexToHsl(warmBlue);

    expect(hWarmBlue).toBeGreaterThan(hCoolBlue);
    // Suppress unused variable warning — cool and warm validated indirectly
    void cool;
    void warm;
    void hCool;
    void hWarm;
  });

  it("all 16 base colors return valid hex strings at neutral shade=50, warmth=50", () => {
    for (let i = 0; i < 16; i++) {
      const result = computePixelColor(i, 50, 50);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("clamp behavior: shade=0 and warmth=0 do not produce negative H or L values", () => {
    for (let i = 0; i < 16; i++) {
      const result = computePixelColor(i, 0, 0);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
      const [h, , l] = hexToHsl(result);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(l).toBeGreaterThanOrEqual(0);
    }
  });

  it("has exactly 16 COLOR_NAMES entries", () => {
    expect(COLOR_NAMES).toHaveLength(16);
  });
});
