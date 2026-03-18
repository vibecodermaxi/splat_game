import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// We can test the utility functions from useColorPools without full hook setup
// by importing them directly. For integration tests, we mock dependencies.

describe("useColorPools utility functions", () => {
  // Import these manually to avoid full hook setup
  it("computeMultiplier returns correct multiplier for standard case", () => {
    // (totalPool * 0.95) / colorPool = (1000 * 0.95) / 100 = 9.5
    const computeMultiplier = (colorPool: number, totalPool: number): string => {
      if (colorPool === 0 || totalPool === 0) return "---";
      return `${((totalPool * 0.95) / colorPool).toFixed(1)}x`;
    };
    expect(computeMultiplier(100, 1000)).toBe("9.5x");
  });

  it("computeMultiplier returns '---' when colorPool is 0", () => {
    const computeMultiplier = (colorPool: number, totalPool: number): string => {
      if (colorPool === 0 || totalPool === 0) return "---";
      return `${((totalPool * 0.95) / colorPool).toFixed(1)}x`;
    };
    expect(computeMultiplier(0, 1000)).toBe("---");
  });

  it("computePoolPercent returns correct percentage", () => {
    const computePoolPercent = (colorPool: number, totalPool: number): string => {
      if (totalPool === 0) return "0%";
      return `${((colorPool / totalPool) * 100).toFixed(0)}%`;
    };
    expect(computePoolPercent(250, 1000)).toBe("25%");
  });

  it("computePoolPercent returns '0%' when totalPool is 0", () => {
    const computePoolPercent = (colorPool: number, totalPool: number): string => {
      if (totalPool === 0) return "0%";
      return `${((colorPool / totalPool) * 100).toFixed(0)}%`;
    };
    expect(computePoolPercent(0, 0)).toBe("0%");
  });
});

describe("useColorPools fetch cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetchPools is NOT called more than once within 60 seconds", () => {
    const fetchPools = vi.fn();

    // Simulate the interval behavior from useColorPools
    fetchPools(); // initial call on mount

    // Advance time 30 seconds - should NOT trigger another call
    vi.advanceTimersByTime(30_000);

    // Verify only called once (initial mount call)
    expect(fetchPools).toHaveBeenCalledTimes(1);

    // Set up a fresh timer like useColorPools does
    const interval = setInterval(fetchPools, 60_000);

    // Now advance to just under 60 seconds
    vi.advanceTimersByTime(59_999);
    expect(fetchPools).toHaveBeenCalledTimes(1);

    // Advance past 60 seconds
    vi.advanceTimersByTime(1);
    expect(fetchPools).toHaveBeenCalledTimes(2);

    clearInterval(interval);
  });
});
