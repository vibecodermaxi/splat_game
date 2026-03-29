"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { useGameStore } from "@/store/gameStore";
import { useBetHistory } from "@/hooks/useBetHistory";

/**
 * Shows a flame streak badge when the player has 2+ consecutive wins.
 * Self-contained — fetches its own data from bet history + pixel store.
 * Renders nothing if streak < 2 or data is loading.
 */
export function StreakBadge() {
  const { pixels } = useGameStore();
  const { bets, loading } = useBetHistory();

  const streak = useMemo(() => {
    if (loading || bets.length === 0) return 0;

    // Sort by pixelIndex descending (most recent rounds first)
    const sorted = [...bets].sort((a, b) => b.pixelIndex - a.pixelIndex);

    let count = 0;
    for (const bet of sorted) {
      const pixel = pixels[bet.pixelIndex];
      if (!pixel || pixel.status !== "resolved") continue; // skip unresolved
      if (pixel.winningColor === bet.colorIndex) {
        count++;
      } else {
        break; // streak broken
      }
    }
    return count;
  }, [bets, pixels, loading]);

  if (streak < 2) return null;

  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: "linear-gradient(135deg, rgba(255, 107, 59, 0.2), rgba(255, 59, 111, 0.2))",
        border: "1px solid rgba(255, 107, 59, 0.35)",
        borderRadius: "20px",
        padding: "3px 10px",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#FF6B3B",
        lineHeight: 1,
        fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
      }}
    >
      <motion.span
        animate={{ rotate: [-5, 5, -5], y: [-1, 1, -1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ fontSize: "0.9rem", lineHeight: 1 }}
      >
        🔥
      </motion.span>
      {streak} streak
    </motion.span>
  );
}
