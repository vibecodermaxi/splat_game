import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PixelTooltip } from "@/components/canvas/PixelTooltip";
import type { PixelSnapshot } from "@/types/game";

// Known test data
const KNOWN_PROMPT_HASH = Array.from({ length: 32 }, (_, i) => i + 1); // [1, 2, ..., 32]
const KNOWN_ARWEAVE_TXID = "abc123DEF456ghijklmnopqrstuvwxyz_-01234567890";

function makeSnapshot(overrides: Partial<PixelSnapshot> = {}): PixelSnapshot {
  return {
    pixelIndex: 0,
    colorIndex: 0, // "Red"
    shade: 55,
    warmth: 45,
    status: "resolved",
    colorPools: new Array(16).fill(0),
    totalPool: 0,
    openedAtSeconds: 1700000000,
    winningColor: 0,
    vrfResolved: false,
    promptHash: KNOWN_PROMPT_HASH,
    arweaveTxid: KNOWN_ARWEAVE_TXID,
    hasArweaveTxid: true,
    ...overrides,
  };
}

const defaultProps = {
  pixelIndex: 2, // Round 3
  position: { x: 100, y: 100 },
  onDismiss: vi.fn(),
};

describe("PixelTooltip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows color name, shade, warmth, and round number for resolved pixel", () => {
    const data = makeSnapshot();
    render(<PixelTooltip {...defaultProps} data={data} />);

    expect(screen.getByText("Red")).toBeDefined();
    expect(screen.getByText("Shade: 55")).toBeDefined();
    expect(screen.getByText("Warmth: 45")).toBeDefined();
    expect(screen.getByText("Round 3")).toBeDefined();
  });

  it("shows 'Verified fair' badge for non-VRF resolved pixel", () => {
    const data = makeSnapshot({ vrfResolved: false });
    render(<PixelTooltip {...defaultProps} data={data} />);

    expect(screen.getByTestId("verified-fair-badge")).toBeDefined();
    expect(screen.getByText(/verified fair/i)).toBeDefined();
  });

  it("shows 'random fallback' text instead of 'Verified fair' for VRF-resolved pixel", () => {
    const data = makeSnapshot({ vrfResolved: true });
    render(<PixelTooltip {...defaultProps} data={data} />);

    expect(screen.getByText(/random fallback/i)).toBeDefined();
    // Should NOT show "Verified fair" badge
    expect(screen.queryByTestId("verified-fair-badge")).toBeNull();
  });

  it("clicking 'View proof' expands to show prompt hash hex", async () => {
    const data = makeSnapshot();
    render(<PixelTooltip {...defaultProps} data={data} />);

    // Proof should not be visible initially
    expect(screen.queryByTestId("prompt-hash-hex")).toBeNull();

    // Click "View proof"
    const viewProofBtn = screen.getByText("View proof");
    fireEvent.click(viewProofBtn);

    // Now the hash display should appear
    const hashEl = screen.getByTestId("prompt-hash-hex");
    expect(hashEl).toBeDefined();

    // The hex content should include part of the expected hash
    // KNOWN_PROMPT_HASH = [1..32], so hex starts with "0102..."
    const hexText = hashEl.textContent ?? "";
    expect(hexText).toContain("0102");
  });

  it("Arweave link renders with correct href when arweaveTxid is non-null", async () => {
    const data = makeSnapshot({ arweaveTxid: KNOWN_ARWEAVE_TXID });
    render(<PixelTooltip {...defaultProps} data={data} />);

    // Expand the proof section
    fireEvent.click(screen.getByText("View proof"));

    const link = screen.getByRole("link", { name: /view prompt on arweave/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(`https://arweave.net/${KNOWN_ARWEAVE_TXID}`);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("Arweave link is absent when arweaveTxid is null", async () => {
    const data = makeSnapshot({ arweaveTxid: null, hasArweaveTxid: false });
    render(<PixelTooltip {...defaultProps} data={data} />);

    // Expand the proof section
    fireEvent.click(screen.getByText("View proof"));

    expect(screen.queryByRole("link", { name: /arweave/i })).toBeNull();
  });
});
