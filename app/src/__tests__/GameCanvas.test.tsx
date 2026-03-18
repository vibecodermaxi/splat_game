import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { computePixelColor } from "@/lib/color";

// Mock Zustand store
const mockPixels: Record<number, {
  pixelIndex: number;
  colorIndex: number;
  shade: number;
  warmth: number;
  status: "open" | "locked" | "resolved";
  colorPools: number[];
  totalPool: number;
  openedAtSeconds: number | null;
  winningColor: number | null;
  vrfResolved: boolean;
}> = {
  0: {
    pixelIndex: 0,
    colorIndex: 0,
    shade: 50,
    warmth: 50,
    status: "resolved",
    colorPools: new Array(16).fill(0),
    totalPool: 1000,
    openedAtSeconds: null,
    winningColor: 0,
    vrfResolved: true,
  },
  1: {
    pixelIndex: 1,
    colorIndex: 3,
    shade: 40,
    warmth: 60,
    status: "resolved",
    colorPools: new Array(16).fill(0),
    totalPool: 2000,
    openedAtSeconds: null,
    winningColor: 3,
    vrfResolved: false,
  },
  2: {
    pixelIndex: 2,
    colorIndex: 7,
    shade: 55,
    warmth: 45,
    status: "resolved",
    colorPools: new Array(16).fill(0),
    totalPool: 500,
    openedAtSeconds: null,
    winningColor: 7,
    vrfResolved: true,
  },
};

vi.mock("@/store/gameStore", () => ({
  useGameStore: vi.fn((selector: (state: {
    pixels: typeof mockPixels;
    currentPixelIndex: number;
  }) => unknown) =>
    selector({
      pixels: mockPixels,
      currentPixelIndex: 3,
    })
  ),
}));

// Mock framer motion
vi.mock("motion", () => ({
  animate: vi.fn(),
}));

describe("GameCanvas", () => {
  it("renders 100 pixel cells", () => {
    const { container } = render(<GameCanvas />);
    // Find pixel cell divs by their data-pixel-index attribute
    const cells = container.querySelectorAll("[data-pixel-index]");
    expect(cells).toHaveLength(100);
  });

  it("gives the active pixel the pixel-active class", () => {
    const { container } = render(<GameCanvas />);
    const activeCell = container.querySelector("[data-pixel-index='3']");
    expect(activeCell).not.toBeNull();
    expect(activeCell?.className).toContain("pixel-active");
  });

  it("resolved pixels have inline background-color style", () => {
    const { container } = render(<GameCanvas />);

    // Check pixel 0 (resolved)
    const cell0 = container.querySelector("[data-pixel-index='0']") as HTMLElement;
    expect(cell0).not.toBeNull();
    const expectedColor0 = computePixelColor(0, 50, 50);
    expect(cell0.style.backgroundColor).toBeTruthy();

    // Check pixel 1 (resolved)
    const cell1 = container.querySelector("[data-pixel-index='1']") as HTMLElement;
    expect(cell1).not.toBeNull();
    const expectedColor1 = computePixelColor(3, 40, 60);
    expect(cell1.style.backgroundColor).toBeTruthy();

    // Check pixel 2 (resolved)
    const cell2 = container.querySelector("[data-pixel-index='2']") as HTMLElement;
    expect(cell2).not.toBeNull();
    const expectedColor2 = computePixelColor(7, 55, 45);
    expect(cell2.style.backgroundColor).toBeTruthy();
  });
});
