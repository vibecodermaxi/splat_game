import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PublicKey } from "@solana/web3.js";

// -----------------------------------------------------------------------
// Module-level mutable state — tests mutate these directly
// -----------------------------------------------------------------------
const connectionCallbacks = new Map<string, (info: { data: Buffer }) => void>();
let subIdCounter = 0;
const connection = {
  onAccountChange: vi.fn((pubkey: PublicKey, cb: (info: { data: Buffer }) => void) => {
    connectionCallbacks.set(pubkey.toString(), cb);
    return ++subIdCounter;
  }),
  removeAccountChangeListener: vi.fn().mockResolvedValue(undefined),
  getSlot: vi.fn().mockResolvedValue(12345),
  getAccountInfo: vi.fn().mockResolvedValue(null),
};

const setPixelState = vi.fn();
const setSeasonState = vi.fn();
const setWsConnected = vi.fn();

const fakeDecodedPixel = {
  status: { open: {} },
  colorPools: new Array(16).fill(BigInt(0)),
  totalPool: BigInt(0),
  shade: 50,
  warmth: 50,
  winningColor: null,
  openedAt: BigInt(0),
  vrfResolved: false,
};

const fakeDecodedSeason = {
  seasonNumber: 1,
  currentPixelIndex: 5,
};

// -----------------------------------------------------------------------
// Module mocks — declared once, using the mutable connection above
// -----------------------------------------------------------------------
vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: () => ({ connection }),
  useAnchorWallet: () => null,
}));

vi.mock("@/hooks/useAnchorProgram", () => ({
  useAnchorProgram: () => ({
    coder: {
      accounts: {
        decode: (accountType: string) => {
          if (accountType === "PixelState") return fakeDecodedPixel;
          if (accountType === "SeasonState") return fakeDecodedSeason;
          return {};
        },
      },
    },
  }),
}));

const storeHook = Object.assign(
  vi.fn((selector?: (s: {
    setPixelState: typeof setPixelState;
    setSeasonState: typeof setSeasonState;
    setWsConnected: typeof setWsConnected;
    currentPixelIndex: number;
  }) => unknown) => {
    const s = { setPixelState, setSeasonState, setWsConnected, currentPixelIndex: 5 };
    return selector ? selector(s) : s;
  }),
  {
    getState: () => ({ setPixelState, setSeasonState, setWsConnected, currentPixelIndex: 5 }),
  }
);

vi.mock("@/store/gameStore", () => ({ useGameStore: storeHook }));

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function makeFakePubkey(str: string): PublicKey {
  return { toString: () => str, toBase58: () => str } as unknown as PublicKey;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------
describe("useHeliusSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectionCallbacks.clear();
    subIdCounter = 0;
    vi.clearAllMocks();
    // Re-stub after clearAllMocks
    connection.onAccountChange.mockImplementation((pubkey: PublicKey, cb: (info: { data: Buffer }) => void) => {
      connectionCallbacks.set(pubkey.toString(), cb);
      return ++subIdCounter;
    });
    connection.removeAccountChangeListener.mockResolvedValue(undefined);
    connection.getSlot.mockResolvedValue(12345);
    connection.getAccountInfo.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls setPixelState when onAccountChange fires for pixel PDA", async () => {
    const { useHeliusSocket } = await import("@/hooks/useHeliusSocket");
    const pixelPDA = makeFakePubkey("pixelPDA123");
    const seasonPDA = makeFakePubkey("seasonPDA456");

    renderHook(() => useHeliusSocket({ pixelPDA, seasonPDA, seasonNumber: 1 }));

    // Verify subscription was set up for pixel PDA
    expect(connection.onAccountChange).toHaveBeenCalledWith(pixelPDA, expect.any(Function), "confirmed");

    // Simulate account change callback
    const cb = connectionCallbacks.get("pixelPDA123");
    expect(cb).toBeDefined();
    cb?.({ data: Buffer.alloc(32) });

    expect(setPixelState).toHaveBeenCalledWith(5, expect.objectContaining({
      pixelIndex: 5,
      status: "open",
    }));
  });

  it("schedules ping via getSlot at 60s interval", async () => {
    const { useHeliusSocket } = await import("@/hooks/useHeliusSocket");
    const pixelPDA = makeFakePubkey("pixelPDA123");
    const seasonPDA = makeFakePubkey("seasonPDA456");

    renderHook(() => useHeliusSocket({ pixelPDA, seasonPDA, seasonNumber: 1 }));

    vi.advanceTimersByTime(60_000);

    expect(connection.getSlot).toHaveBeenCalled();
  });

  it("removes listeners on unmount", async () => {
    const { useHeliusSocket } = await import("@/hooks/useHeliusSocket");
    const pixelPDA = makeFakePubkey("pixelPDA123");
    const seasonPDA = makeFakePubkey("seasonPDA456");

    const { unmount } = renderHook(() => useHeliusSocket({ pixelPDA, seasonPDA, seasonNumber: 1 }));

    unmount();

    expect(connection.removeAccountChangeListener).toHaveBeenCalledTimes(2);
  });

  it("does not subscribe when pixelPDA is null", async () => {
    const { useHeliusSocket } = await import("@/hooks/useHeliusSocket");
    const seasonPDA = makeFakePubkey("seasonPDA456");

    renderHook(() => useHeliusSocket({ pixelPDA: null, seasonPDA, seasonNumber: 1 }));

    expect(connection.onAccountChange).not.toHaveBeenCalled();
  });
});
