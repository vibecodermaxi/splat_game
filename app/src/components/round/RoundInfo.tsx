"use client";

import { useGameStore } from "@/store/gameStore";
import { TOTAL_PIXELS } from "@/lib/constants";

export function RoundInfo() {
  const currentPixelIndex = useGameStore((state) => state.currentPixelIndex);
  const seasonNumber = useGameStore((state) => state.seasonNumber);

  // Display is 1-based (pixelIndex 0 = Round 1)
  const roundDisplay = currentPixelIndex + 1;
  const progressPercent = (currentPixelIndex / TOTAL_PIXELS) * 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        width: "100%",
        maxWidth: "min(calc(100vw - 32px), 480px)",
        margin: "0 auto",
      }}
    >
      {/* Season label */}
      <div
        style={{
          fontFamily: "var(--font-family-body, Nunito, sans-serif)",
          fontSize: 13,
          color: "#a0a0b0",
          fontWeight: 600,
        }}
      >
        Season {seasonNumber}
      </div>

      {/* Round N of 100 */}
      <div
        style={{
          fontFamily: "var(--font-family-body, Nunito, sans-serif)",
          fontSize: 16,
          fontWeight: 700,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}
      >
        <span style={{ color: "#3BDBFF", fontSize: 20 }}>Round {roundDisplay}</span>
        <span style={{ color: "#a0a0b0", fontSize: 14 }}>of 100</span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 3,
          borderRadius: 2,
          background: "#2A2A3E",
          overflow: "hidden",
        }}
      >
        <div
          data-testid="progress-bar"
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            background: "#3BDBFF",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
