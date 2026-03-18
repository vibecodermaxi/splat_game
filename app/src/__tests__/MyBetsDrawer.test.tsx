/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyBetsDrawer } from "@/components/mybets/MyBetsDrawer";
import type { BetHistoryEntry, PlayerStats } from "@/hooks/useBetHistory";

// --- Mock motion/react to avoid animation complexity in tests ---
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Mock hooks ---
vi.mock("@/hooks/useBetHistory", () => ({
  useBetHistory: vi.fn(),
}));

vi.mock("@/hooks/useClaimWinnings", () => ({
  useClaimWinnings: vi.fn(() => ({
    claimSingle: vi.fn(),
    claimAll: vi.fn(),
    isClaiming: false,
    claimProgress: null,
    error: null,
    clearError: vi.fn(),
  })),
}));

vi.mock("@/store/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    pixels: {},
    seasonNumber: 1,
    currentPixelIndex: 5,
  })),
}));

import { useBetHistory } from "@/hooks/useBetHistory";
import { useGameStore } from "@/store/gameStore";

// Typed mock helpers
const mockUseBetHistory = vi.mocked(useBetHistory);
const mockUseGameStore = vi.mocked(useGameStore) as unknown as ReturnType<typeof vi.fn>;

// Sample data
const ACTIVE_BET: BetHistoryEntry = {
  pixelIndex: 2,
  colorIndex: 0, // Red
  amount: 50_000_000, // 0.05 SOL
  claimed: false,
  seasonNumber: 1,
  betPDA: "BetPDA111",
  pixelPDA: "PixelPDA111",
  statsPDA: "StatsPDA111",
};

const WON_CLAIMABLE_BET: BetHistoryEntry = {
  pixelIndex: 3,
  colorIndex: 4, // Green
  amount: 100_000_000, // 0.1 SOL
  claimed: false,
  seasonNumber: 1,
  betPDA: "BetPDA222",
  pixelPDA: "PixelPDA222",
  statsPDA: "StatsPDA222",
};

const LOST_BET: BetHistoryEntry = {
  pixelIndex: 4,
  colorIndex: 1, // Orange
  amount: 10_000_000, // 0.01 SOL
  claimed: false,
  seasonNumber: 1,
  betPDA: "BetPDA333",
  pixelPDA: "PixelPDA333",
  statsPDA: "StatsPDA333",
};

const SAMPLE_STATS: PlayerStats = {
  totalBets: 10,
  totalVolume: 500_000_000, // 0.5 SOL
  correctPredictions: 4,
  hitRate: "40.0",
};

describe("MyBetsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Stats bar renders placeholder values when loading", () => {
    it("shows --- placeholders when loading is true", () => {
      mockUseBetHistory.mockReturnValue({
        bets: [],
        stats: null,
        loading: true,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      // Should show multiple --- placeholders
      const placeholders = screen.getAllByText("---");
      expect(placeholders.length).toBeGreaterThanOrEqual(4);
    });

    it("shows stat values when stats are available", () => {
      mockUseBetHistory.mockReturnValue({
        bets: [],
        stats: SAMPLE_STATS,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      // totalBets = 10
      expect(screen.getByText("10")).toBeDefined();
      // correctPredictions = 4
      expect(screen.getByText("4")).toBeDefined();
      // hitRate = 40.0%
      expect(screen.getByText("40.0%")).toBeDefined();
    });
  });

  describe("Bet list categorization", () => {
    it("correctly renders active, claimable (won), and lost bets", () => {
      // Set up pixel states: pixel 3 resolved with winningColor=4 (Green = WON_CLAIMABLE_BET)
      //                       pixel 4 resolved with winningColor=2 (not Orange = LOST_BET)
      //                       pixel 2 is open (ACTIVE_BET)
      mockUseGameStore.mockReturnValue({
        pixels: {
          2: { pixelIndex: 2, status: "open", winningColor: null, colorIndex: 0, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
          3: { pixelIndex: 3, status: "resolved", winningColor: 4, colorIndex: 4, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
          4: { pixelIndex: 4, status: "resolved", winningColor: 2, colorIndex: 2, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
        },
        seasonNumber: 1,
        currentPixelIndex: 5,
      });

      mockUseBetHistory.mockReturnValue({
        bets: [ACTIVE_BET, WON_CLAIMABLE_BET, LOST_BET],
        stats: SAMPLE_STATS,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      // Should see section headers (getAllByText because "Active" appears as both section header and badge)
      expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Claimable")).toBeDefined();
      expect(screen.getByText("History")).toBeDefined();

      // Lost bet shows "Lost" badge
      expect(screen.getByText("Lost")).toBeDefined();
    });
  });

  describe("Claim button", () => {
    it("renders Claim button for claimable (won, unclaimed) bets", () => {
      mockUseGameStore.mockReturnValue({
        pixels: {
          3: { pixelIndex: 3, status: "resolved", winningColor: 4, colorIndex: 4, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
        },
        seasonNumber: 1,
        currentPixelIndex: 5,
      });

      mockUseBetHistory.mockReturnValue({
        bets: [WON_CLAIMABLE_BET],
        stats: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      const claimBtn = screen.getByRole("button", { name: /claim winnings for pixel #3/i });
      expect(claimBtn).toBeDefined();
    });

    it("does NOT render Claim button for lost bets", () => {
      mockUseGameStore.mockReturnValue({
        pixels: {
          4: { pixelIndex: 4, status: "resolved", winningColor: 2, colorIndex: 2, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
        },
        seasonNumber: 1,
        currentPixelIndex: 5,
      });

      mockUseBetHistory.mockReturnValue({
        bets: [LOST_BET],
        stats: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      // No Claim button for pixel #4
      const claimBtns = screen.queryAllByRole("button", { name: /claim winnings/i });
      expect(claimBtns.length).toBe(0);
    });
  });

  describe("Claim All button", () => {
    it("shows Claim All button with count when multiple bets are claimable", () => {
      const claimableBet2: BetHistoryEntry = {
        pixelIndex: 6,
        colorIndex: 7, // Blue
        amount: 50_000_000,
        claimed: false,
        seasonNumber: 1,
        betPDA: "BetPDA444",
        pixelPDA: "PixelPDA444",
        statsPDA: "StatsPDA444",
      };

      mockUseGameStore.mockReturnValue({
        pixels: {
          3: { pixelIndex: 3, status: "resolved", winningColor: 4, colorIndex: 4, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
          6: { pixelIndex: 6, status: "resolved", winningColor: 7, colorIndex: 7, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
        },
        seasonNumber: 1,
        currentPixelIndex: 5,
      });

      mockUseBetHistory.mockReturnValue({
        bets: [WON_CLAIMABLE_BET, claimableBet2],
        stats: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      // Claim All button should show count of 2
      const claimAllBtn = screen.getByRole("button", { name: /claim all 2/i });
      expect(claimAllBtn).toBeDefined();
    });

    it("does NOT show Claim All button when only one bet is claimable", () => {
      mockUseGameStore.mockReturnValue({
        pixels: {
          3: { pixelIndex: 3, status: "resolved", winningColor: 4, colorIndex: 4, shade: 50, warmth: 50, colorPools: Array(16).fill(0), totalPool: 0, openedAtSeconds: null, vrfResolved: false },
        },
        seasonNumber: 1,
        currentPixelIndex: 5,
      });

      mockUseBetHistory.mockReturnValue({
        bets: [WON_CLAIMABLE_BET],
        stats: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      const claimAllBtns = screen.queryAllByRole("button", { name: /claim all/i });
      expect(claimAllBtns.length).toBe(0);
    });
  });

  describe("Empty state", () => {
    it("shows empty state message when no bets", () => {
      mockUseBetHistory.mockReturnValue({
        bets: [],
        stats: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<MyBetsDrawer isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(/No bets yet/i)).toBeDefined();
    });
  });

  describe("Closed state", () => {
    it("renders nothing when isOpen is false", () => {
      mockUseBetHistory.mockReturnValue({
        bets: [],
        stats: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<MyBetsDrawer isOpen={false} onClose={vi.fn()} />);
      // No drawer content rendered
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});
