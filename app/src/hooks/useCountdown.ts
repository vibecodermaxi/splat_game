"use client";

import { useState, useEffect } from "react";
import { ROUND_DURATION_SECONDS, LOCKOUT_SECONDS } from "@/lib/constants";

export interface CountdownResult {
  secondsLeft: number;
  isLocked: boolean;
  isFinalDrama: boolean;
  /** True when the round has not been opened yet (no openedAtSeconds) */
  roundNotOpen: boolean;
  minutesDisplay: string;
  secondsDisplay: string;
}

/**
 * Countdown hook derived from the on-chain opened_at timestamp.
 *
 * - secondsLeft: time remaining in the round
 * - isLocked: true when within LOCKOUT_SECONDS (final 2 minutes) of an open round
 * - isFinalDrama: true when <= 10 seconds left and > 0
 * - minutesDisplay / secondsDisplay: zero-padded display strings
 */
export function useCountdown(openedAtSeconds: number | null): CountdownResult {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (openedAtSeconds === null) return 0;
    const elapsed = Math.floor(Date.now() / 1000) - openedAtSeconds;
    return Math.max(0, ROUND_DURATION_SECONDS - elapsed);
  });

  useEffect(() => {
    if (openedAtSeconds === null) {
      setSecondsLeft(0);
      return;
    }

    // Compute immediately on openedAtSeconds change
    const compute = () => {
      const elapsed = Math.floor(Date.now() / 1000) - openedAtSeconds;
      const remaining = Math.max(0, ROUND_DURATION_SECONDS - elapsed);
      setSecondsLeft(remaining);
    };

    compute();

    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [openedAtSeconds]);

  // isLocked: betting disabled when within final LOCKOUT_SECONDS window
  // Only active when there is an open round (openedAtSeconds !== null)
  const isLocked = openedAtSeconds !== null && secondsLeft <= LOCKOUT_SECONDS;
  const isFinalDrama = secondsLeft <= 10 && secondsLeft > 0;
  const roundNotOpen = openedAtSeconds === null;
  const minutesDisplay = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secondsDisplay = String(secondsLeft % 60).padStart(2, "0");

  return {
    secondsLeft,
    isLocked,
    isFinalDrama,
    roundNotOpen,
    minutesDisplay,
    secondsDisplay,
  };
}
