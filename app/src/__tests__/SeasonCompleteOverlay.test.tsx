/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeasonCompleteOverlay } from "@/components/season/SeasonCompleteOverlay";
import type { PixelSnapshot } from "@/types/game";

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

describe("SeasonCompleteOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Season N Complete!' heading", () => {
    const onDismiss = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={3}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByText(/Season 3 Complete!/i)).toBeDefined();
  });

  it("renders 100 pixel cells in the canvas grid", () => {
    const onDismiss = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={1}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
      />
    );
    // Each cell gets data-testid="pixel-cell-{i}"
    for (let i = 0; i < 100; i++) {
      const cell = screen.getByTestId(`pixel-cell-${i}`);
      expect(cell).toBeDefined();
    }
  });

  it("renders 'Share Canvas' button when onShare is provided", () => {
    const onDismiss = vi.fn();
    const onShare = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={1}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
        onShare={onShare}
      />
    );
    expect(screen.getByText("Share Canvas")).toBeDefined();
  });

  it("does not render 'Share Canvas' button when onShare is not provided", () => {
    const onDismiss = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={1}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
      />
    );
    expect(screen.queryByText("Share Canvas")).toBeNull();
  });

  it("calls onDismiss when 'Continue' button is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={1}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
      />
    );
    const continueBtn = screen.getByText("Continue");
    fireEvent.click(continueBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onShare when 'Share Canvas' button is clicked", () => {
    const onDismiss = vi.fn();
    const onShare = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={1}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
        onShare={onShare}
      />
    );
    const shareBtn = screen.getByText("Share Canvas");
    fireEvent.click(shareBtn);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("renders season stats section", () => {
    const onDismiss = vi.fn();
    render(
      <SeasonCompleteOverlay
        seasonNumber={1}
        pixels={buildMockPixels()}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByText(/100 rounds/i)).toBeDefined();
    expect(screen.getByText(/Total pool:/i)).toBeDefined();
  });
});
