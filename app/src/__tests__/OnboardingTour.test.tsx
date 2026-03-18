/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock getBoundingClientRect for target elements
const mockGetBoundingClientRect = vi.fn(() => ({
  top: 100,
  bottom: 200,
  left: 50,
  right: 350,
  width: 300,
  height: 100,
  x: 50,
  y: 100,
  toJSON: () => ({}),
}));

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageMock.getItem.mockImplementation((_key: string) => null as unknown as string);

    // Create mock target elements
    const canvasDiv = document.createElement("div");
    canvasDiv.id = "game-canvas";
    canvasDiv.getBoundingClientRect = mockGetBoundingClientRect;
    document.body.appendChild(canvasDiv);

    const bettingDiv = document.createElement("div");
    bettingDiv.id = "betting-panel";
    bettingDiv.getBoundingClientRect = mockGetBoundingClientRect;
    document.body.appendChild(bettingDiv);

    const headerDiv = document.createElement("div");
    headerDiv.id = "splat-header";
    headerDiv.getBoundingClientRect = mockGetBoundingClientRect;
    document.body.appendChild(headerDiv);

    // Mock window dimensions
    Object.defineProperty(window, "innerWidth", { value: 400, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true });
  });

  afterEach(() => {
    // Clean up mock elements
    document.getElementById("game-canvas")?.remove();
    document.getElementById("betting-panel")?.remove();
    document.getElementById("splat-header")?.remove();
    vi.useRealTimers();
  });

  describe("First visit behavior", () => {
    it("renders tour on first visit when localStorage is empty", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      // Advance timer to let position update settle
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Tour dialog should be present with step 1 text
      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Watch the Canvas")).toBeDefined();
      expect(screen.getByText("The AI paints one pixel every 30 minutes.")).toBeDefined();
    });

    it("shows step indicator '1 of 4' on first step", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText("1 of 4")).toBeDefined();
    });

    it("shows Skip button on every step", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole("button", { name: /skip tour/i })).toBeDefined();
    });

    it("shows Next button on first step (not last)", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole("button", { name: /next step/i })).toBeDefined();
    });
  });

  describe("Tour already seen", () => {
    it("does NOT render when localStorage has splat_tour_done = 'true'", async () => {
      localStorageMock.getItem.mockImplementation((_key: string) => "true");

      render(<OnboardingTour />);

      // Should render nothing (no dialog)
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("Skip behavior", () => {
    it("clicking Skip sets localStorage and hides tour", async () => {
      vi.useFakeTimers();
      let storageValue: string | null = null;
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        storageValue = value;
      });

      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const skipBtn = screen.getByRole("button", { name: /skip tour/i });
      fireEvent.click(skipBtn);

      // localStorage should be set to "true"
      expect(localStorageMock.setItem).toHaveBeenCalledWith("splat_tour_done", "true");
      expect(storageValue).toBe("true");

      // Tour should be hidden
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("Next step behavior", () => {
    it("clicking Next advances to step 2", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should be on step 1
      expect(screen.getByText("Watch the Canvas")).toBeDefined();

      const nextBtn = screen.getByRole("button", { name: /next step/i });
      fireEvent.click(nextBtn);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should now be on step 2
      expect(screen.getByText("Pick a Color. Place Your Bet.")).toBeDefined();
      expect(screen.getByText("2 of 4")).toBeDefined();
    });

    it("last step shows 'Got it!' button instead of Next", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Advance through all steps
      for (let i = 0; i < 3; i++) {
        const nextBtn = screen.getByRole("button", { name: /next step/i });
        fireEvent.click(nextBtn);
        await act(async () => {
          vi.advanceTimersByTime(200);
        });
      }

      // Should be on last step with "Got it!" button
      expect(screen.getByText("You're All Set!")).toBeDefined();
      expect(screen.getByRole("button", { name: /got it/i })).toBeDefined();
      expect(screen.queryByRole("button", { name: /next step/i })).toBeNull();
    });

    it("clicking 'Got it!' on last step sets localStorage and hides tour", async () => {
      vi.useFakeTimers();
      render(<OnboardingTour />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Advance to last step
      for (let i = 0; i < 3; i++) {
        const nextBtn = screen.getByRole("button", { name: /next step/i });
        fireEvent.click(nextBtn);
        await act(async () => {
          vi.advanceTimersByTime(200);
        });
      }

      const gotItBtn = screen.getByRole("button", { name: /got it/i });
      fireEvent.click(gotItBtn);

      expect(localStorageMock.setItem).toHaveBeenCalledWith("splat_tour_done", "true");
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
