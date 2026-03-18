/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { WinNotification } from "@/components/ui/WinNotification";

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("WinNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders SPLAT! heading", () => {
    const onDismiss = vi.fn();
    render(
      <WinNotification colorName="Blue" payoutSol={0.47} onDismiss={onDismiss} />
    );
    expect(screen.getByText(/SPLAT! You nailed it\./i)).toBeDefined();
  });

  it("renders payout amount text", () => {
    const onDismiss = vi.fn();
    render(
      <WinNotification colorName="Red" payoutSol={1.5} onDismiss={onDismiss} />
    );
    // The payout ticker starts from 0; after mount the element exists
    // (With fake timers, rAF doesn't run, so displayAmount starts at 0)
    const payoutEl = screen.getByText(/SOL/);
    expect(payoutEl).toBeDefined();
  });

  it("calls onDismiss after 4 seconds", async () => {
    const onDismiss = vi.fn();
    render(
      <WinNotification colorName="Green" payoutSol={0.1} onDismiss={onDismiss} />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders the winning color name", () => {
    const onDismiss = vi.fn();
    render(
      <WinNotification colorName="Cyan" payoutSol={0.25} onDismiss={onDismiss} />
    );
    expect(screen.getByText(/Cyan/)).toBeDefined();
  });
});
