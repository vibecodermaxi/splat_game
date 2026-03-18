"use client";

import { motion } from "motion/react";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";

interface ColorSwatchProps {
  colorIndex: number;
  isSelected: boolean;
  multiplier: string;
  onSelect: (idx: number) => void;
}

/**
 * Single color swatch with multiplier overlay and selection state.
 * Part of the 4x4 betting grid in BettingPanel.
 */
export function ColorSwatch({
  colorIndex,
  isSelected,
  multiplier,
  onSelect,
}: ColorSwatchProps) {
  const colorName = COLOR_NAMES[colorIndex];
  const bgColor = BASE_HEX[colorName];

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
        backgroundColor: bgColor,
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
        userSelect: "none",
      }}
    >
      <span
        style={{

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
