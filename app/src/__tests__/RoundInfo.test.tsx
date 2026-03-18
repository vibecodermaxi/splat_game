import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RoundInfo } from "@/components/round/RoundInfo";

// Mock Zustand store
vi.mock("@/store/gameStore", () => ({
  useGameStore: vi.fn((selector: (state: {
    currentPixelIndex: number;
    seasonNumber: number;
  }) => unknown) =>
    selector({
      currentPixelIndex: 42,
      seasonNumber: 1,
    })
  ),
}));

describe("RoundInfo", () => {
  it('renders "Round 43 of 100" (1-based, currentPixelIndex=42)', () => {
    render(<RoundInfo />);
    expect(screen.getByText(/Round 43/)).toBeDefined();
    expect(screen.getByText(/of 100/)).toBeDefined();
  });

  it('renders "Season 1"', () => {
    render(<RoundInfo />);
    expect(screen.getByText(/Season 1/)).toBeDefined();
  });
});
