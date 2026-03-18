import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdown } from "@/hooks/useCountdown";
import { ROUND_DURATION_SECONDS, LOCKOUT_SECONDS } from "@/lib/constants";

describe("useCountdown", () => {
  const FIXED_NOW_MS = 1_700_000_000_000; // fixed reference time in ms
  const FIXED_NOW_S = Math.floor(FIXED_NOW_MS / 1000); // 1_700_000_000

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct secondsLeft and isLocked=false when 900 seconds elapsed", () => {
    // openedAt = 900 seconds ago, so elapsed = 900, remaining = 1800 - 900 = 900
    const openedAtSeconds = FIXED_NOW_S - 900;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.secondsLeft).toBe(900);
    expect(result.current.isLocked).toBe(false);
  });

  it("returns isLocked=true when secondsLeft is within LOCKOUT_SECONDS", () => {
    // elapsed = 1700, remaining = 1800 - 1700 = 100, which is < 120 (LOCKOUT_SECONDS)
    const openedAtSeconds = FIXED_NOW_S - 1700;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.secondsLeft).toBe(100);
    expect(result.current.isLocked).toBe(true);
  });

  it("returns isFinalDrama=true when secondsLeft <= 10 and > 0", () => {
    // elapsed = 1795, remaining = 1800 - 1795 = 5
    const openedAtSeconds = FIXED_NOW_S - 1795;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.secondsLeft).toBe(5);
    expect(result.current.isFinalDrama).toBe(true);
    expect(result.current.isLocked).toBe(true);
  });

  it("returns all zeros and no flags when openedAtSeconds is null", () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isLocked).toBe(false);
    expect(result.current.isFinalDrama).toBe(false);
    expect(result.current.minutesDisplay).toBe("00");
    expect(result.current.secondsDisplay).toBe("00");
  });

  it("formats minutesDisplay and secondsDisplay correctly for 900 seconds", () => {
    // 900 seconds = 15 minutes 0 seconds
    const openedAtSeconds = FIXED_NOW_S - 900;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.minutesDisplay).toBe("15");
    expect(result.current.secondsDisplay).toBe("00");
  });

  it("formats minutesDisplay and secondsDisplay correctly for 75 seconds", () => {
    // elapsed = 1800 - 75 = 1725 seconds ago
    const openedAtSeconds = FIXED_NOW_S - 1725;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.secondsLeft).toBe(75);
    expect(result.current.minutesDisplay).toBe("01");
    expect(result.current.secondsDisplay).toBe("15");
  });

  it("isFinalDrama=false when secondsLeft > 10", () => {
    // elapsed = 1780, remaining = 20
    const openedAtSeconds = FIXED_NOW_S - 1780;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.secondsLeft).toBe(20);
    expect(result.current.isFinalDrama).toBe(false);
  });

  it("updates secondsLeft after timer tick", () => {
    const openedAtSeconds = FIXED_NOW_S - 900;
    const { result } = renderHook(() => useCountdown(openedAtSeconds));
    expect(result.current.secondsLeft).toBe(900);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(899);
  });
});
