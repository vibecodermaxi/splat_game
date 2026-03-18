/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { IntermissionScreen } from "@/components/season/IntermissionScreen";
import type { PixelSnapshot } from "@/types/game";

// Mock html-to-image — uses DOM APIs not available in jsdom
vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,abc123"),
}));

/** Build a mock PixelSnapshot record with 100 entries */
function buildMockPixels(): Record<number, PixelSnapshot> {
  const pixels: Record<number, PixelSnapshot> = {};
  for (let i = 0; i < 100; i++) {
    pixels[i] = {
      pixelIndex: i,
      colorIndex: i % 16,
      shade: 50,
      warmth: 50,
      status: "resolved",
      colorPools: new Array(16).fill(1_000_000),
      totalPool: 16_000_000,
      openedAtSeconds: 1700000000,
      winningColor: i % 16,
      vrfResolved: false,
      promptHash: new Array(32).fill(0),
      arweaveTxid: null,
      hasArweaveTxid: false,
    };
  }
  return pixels;
}

// Fixed "now" for deterministic countdown math: 2026-03-18 10:00:00 UTC
const FIXED_NOW_MS = 1742292000000; // Unix ms
// Intermission ends 1 hour from "now" → 3600 seconds remaining
const FIXED_INTERMISSION_ENDS = Math.floor(FIXED_NOW_MS / 1000) + 3600;

describe("IntermissionScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock Date.now() to a fixed value
    vi.setSystemTime(new Date(FIXED_NOW_MS));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'Next Season starts in...' heading", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );
    expect(screen.getByText(/Next Season starts in\.\.\./i)).toBeDefined();
  });

  it("displays countdown in HH:MM:SS format", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );
    // 3600 seconds = "01:00:00"
    const timer = screen.getByTestId("countdown-timer");
    expect(timer.textContent).toBe("01:00:00");
  });

  it("updates countdown after 1 second", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const timer = screen.getByTestId("countdown-timer");
    expect(timer.textContent).toBe("00:59:59");
  });

  it("displays 'New season starting...' when countdown reaches 0", () => {
    // Intermission already ended
    const alreadyEnded = Math.floor(FIXED_NOW_MS / 1000) - 10;
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={alreadyEnded}
        playerStats={null}
      />
    );
    expect(screen.getByText(/New season starting\.\.\./i)).toBeDefined();
  });

  it("renders 'Share Canvas' button", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );
    expect(screen.getByText("Share Canvas")).toBeDefined();
  });

  it("renders 100 pixel cells in the canvas display", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );
    for (let i = 0; i < 100; i++) {
      const cell = screen.getByTestId(`intermission-pixel-${i}`);
      expect(cell).toBeDefined();
    }
  });

  it("renders 'View Canvas' button", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );
    expect(screen.getByText("View Canvas")).toBeDefined();
  });

  it("renders season stats", () => {
    render(
      <IntermissionScreen
        seasonNumber={1}
        pixels={buildMockPixels()}
        intermissionEndsSeconds={FIXED_INTERMISSION_ENDS}
        playerStats={null}
      />
    );
    expect(screen.getByText(/100 rounds played/i)).toBeDefined();
    expect(screen.getByText(/Total pool:/i)).toBeDefined();
  });
});
