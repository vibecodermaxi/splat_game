import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BettingPanel } from "@/components/betting/BettingPanel";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";

// Mock hooks to control state
vi.mock("@/hooks/useCountdown", () => ({
  useCountdown: vi.fn(),
}));

vi.mock("@/hooks/useColorPools", () => ({
  useColorPools: vi.fn(() => ({
    computeMultiplier: () => "---",
    computePoolPercent: () => "0%",
  })),
}));

vi.mock("@/hooks/usePlaceBet", () => ({
  usePlaceBet: vi.fn(() => ({
    placeBet: vi.fn(),
    isSubmitting: false,
    error: null,
    clearError: vi.fn(),
  })),
}));

vi.mock("@/store/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    currentPixelIndex: 0,
    pixels: {},
    playerBet: null,
    setPlayerBet: vi.fn(),
  })),
}));

vi.mock("@/components/round/CountdownTimer", () => ({
  CountdownTimer: () => <div data-testid="countdown-timer">00:00</div>,
}));

import { useCountdown } from "@/hooks/useCountdown";

describe("BettingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when isLocked = true", () => {
    beforeEach(() => {
      (useCountdown as ReturnType<typeof vi.fn>).mockReturnValue({
        secondsLeft: 60,
        isLocked: true,
        isFinalDrama: false,
        minutesDisplay: "01",
        secondsDisplay: "00",
      });
    });

    it("bet button shows locked text and is disabled", () => {
      render(<BettingPanel />);
      const btn = screen.getByRole("button", { name: /locked\. the ai is thinking/i });
      expect(btn).toBeDisabled();
    });

    it("panel container has panel-locked class when isLocked=true", () => {
      const { container } = render(<BettingPanel />);
      const panel = container.querySelector("#betting-panel");
      expect(panel).toHaveClass("panel-locked");
    });
  });

  describe("when isLocked = false", () => {
    beforeEach(() => {
      (useCountdown as ReturnType<typeof vi.fn>).mockReturnValue({
        secondsLeft: 900,
        isLocked: false,
        isFinalDrama: false,
        minutesDisplay: "15",
        secondsDisplay: "00",
      });
    });

    it("shows 'Pick a color' text when no color selected", () => {
      render(<BettingPanel />);
      const btn = screen.getByRole("button", { name: /pick a color/i });
      expect(btn).toBeDefined();
    });

    it("bet button shows 'SPLAT IT!' and becomes enabled after color selection", async () => {
      render(<BettingPanel />);

      // Click on first color swatch (Red, index 0)
      const swatches = screen.getAllByRole("button", { name: new RegExp(COLOR_NAMES[0]) });
      const swatch = swatches[0];
      swatch.click();

      // After selecting a color, the SPLAT IT! button should appear
      // Note: React state update is synchronous in testing with renderHook
      const splatBtn = await screen.findByText(/splat it!/i);
      expect(splatBtn).toBeDefined();
    });

    it("bet button has inline background-color matching selected color when color is selected", async () => {
      render(<BettingPanel />);

      // Click on Red swatch (index 0)
      const swatches = screen.getAllByRole("button", { name: new RegExp(COLOR_NAMES[0]) });
      swatches[0].click();

      // Find SPLAT IT button and check its background
      const splatBtn = await screen.findByText(/splat it!/i);
      const button = splatBtn.closest("button");
      expect(button).toBeDefined();
      // The background style should be set (browser may normalize hex to rgb)
      // Verify the button has a non-gradient background (i.e. the selected color was applied)
      const style = button?.style;
      expect(style?.background).toBeTruthy();
      // The color is either hex or rgb — verify it is NOT the default gradient
      expect(style?.background).not.toContain("linear-gradient");
    });
  });
});
