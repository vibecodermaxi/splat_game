"use client";

import { motion } from "motion/react";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";

interface ColorSwatchProps {
  colorIndex: number;
  isSelected: boolean;
  multiplier: string;
  /** Pool fraction for this color: 0 = no bets, 1 = 100% of pool */
  poolFraction: number;
  onSelect: (idx: number) => void;
}

/**
 * Single color swatch with pool fill bar and multiplier overlay.
 * The fill rises from the bottom proportional to pool share — like paint in a bucket.
 */
export function ColorSwatch({
  colorIndex,
  isSelected,
  multiplier,
  poolFraction,
  onSelect,
}: ColorSwatchProps) {
  const colorName = COLOR_NAMES[colorIndex];
  const bgColor = BASE_HEX[colorName];

  // Clamp 0-1, convert to percentage for fill height
  const fillPct = Math.min(1, Math.max(0, poolFraction)) * 100;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${colorName}: ${multiplier}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(colorIndex)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(colorIndex);
        }
      }}
      animate={{ scale: isSelected ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        border: isSelected
          ? "2px solid rgba(255, 255, 255, 0.9)"
          : "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "6px",
        minHeight: "44px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Base tint — full swatch at low opacity so it's always recognizable */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: bgColor,
          opacity: 0.3,
        }}
      />

      {/* Pool fill bar — rises from bottom proportional to pool share */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${fillPct}%`,
          backgroundColor: bgColor,
          transition: "height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />

      {/* Multiplier text */}
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontWeight: 700,
          fontSize: "0.75rem",
          color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5)",
          lineHeight: 1,
        }}
      >
        {multiplier}
      </span>
    </motion.div>
  );
}
