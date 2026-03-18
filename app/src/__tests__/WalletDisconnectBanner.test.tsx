/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WalletDisconnectBanner } from "@/components/ui/WalletDisconnectBanner";

// Mock @solana/wallet-adapter-react
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: vi.fn(),
}));

import { useWallet } from "@solana/wallet-adapter-react";

const mockUseWallet = vi.mocked(useWallet);

/** Minimal wallet mock — typed as any to avoid strict WalletContextState shape */
function makeWalletMock(connected: boolean, connectFn = vi.fn()) {
  return {
    connected,
    connect: connectFn,
    disconnect: vi.fn(),
    connecting: false,
    disconnecting: false,
    wallet: null,
    wallets: [],
    select: vi.fn(),
    publicKey: null,
    sendTransaction: vi.fn(),
    signTransaction: undefined,
    signAllTransactions: undefined,
    signMessage: undefined,
    signIn: undefined,
    autoConnect: false,
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("WalletDisconnectBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Banner does NOT render when connected", () => {
    it("renders nothing when connected = true (initial state)", () => {
      mockUseWallet.mockReturnValue(makeWalletMock(true));

      render(<WalletDisconnectBanner />);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("renders nothing when connected = false from the start (no disconnect transition)", () => {
      mockUseWallet.mockReturnValue(makeWalletMock(false));

      render(<WalletDisconnectBanner />);
      // Banner only shows on true->false transition, not initial disconnected state
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("Banner renders on disconnect transition", () => {
    it("shows banner when connected transitions true -> false", async () => {
      const connectMock = vi.fn();

      // First render: connected = true
      mockUseWallet.mockReturnValue(makeWalletMock(true, connectMock));

      const { rerender } = render(<WalletDisconnectBanner />);
      expect(screen.queryByRole("alert")).toBeNull();

      // Transition: connected = false
      mockUseWallet.mockReturnValue(makeWalletMock(false, connectMock));

      await act(async () => {
        rerender(<WalletDisconnectBanner />);
      });

      expect(screen.getByRole("alert")).toBeDefined();
      expect(
        screen.getByText(/Wallet disconnected\. Reconnect to continue playing\./i)
      ).toBeDefined();
    });
  });

  describe("Reconnect button", () => {
    it("calls connect() when Reconnect button is clicked", async () => {
      const connectMock = vi.fn().mockResolvedValue(undefined);

      // Start connected
      mockUseWallet.mockReturnValue(makeWalletMock(true, connectMock));

      const { rerender } = render(<WalletDisconnectBanner />);

      // Trigger disconnect
      mockUseWallet.mockReturnValue(makeWalletMock(false, connectMock));

      await act(async () => {
        rerender(<WalletDisconnectBanner />);
      });

      const reconnectBtn = screen.getByRole("button", { name: /reconnect wallet/i });
      await act(async () => {
        fireEvent.click(reconnectBtn);
      });

      expect(connectMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dismiss button", () => {
    it("hides banner when dismiss X is clicked", async () => {
      const connectMock = vi.fn();

      // Start connected
      mockUseWallet.mockReturnValue(makeWalletMock(true, connectMock));

      const { rerender } = render(<WalletDisconnectBanner />);

      // Trigger disconnect
      mockUseWallet.mockReturnValue(makeWalletMock(false, connectMock));

      await act(async () => {
        rerender(<WalletDisconnectBanner />);
      });

      expect(screen.getByRole("alert")).toBeDefined();

      const dismissBtn = screen.getByRole("button", { name: /dismiss disconnect banner/i });
      fireEvent.click(dismissBtn);

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
