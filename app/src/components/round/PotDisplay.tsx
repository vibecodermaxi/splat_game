"use client";

import { useGameStore } from "@/store/gameStore";
import { RAKE_PERCENT } from "@/lib/constants";

/**
 * Prominent total pot display shown above the canvas.
 * Shows the total SOL in the current round's pool and the net payout (after rake).
 */
export function PotDisplay() {
  const { currentPixelIndex, pixels } = useGameStore();
  const activePixel = pixels[currentPixelIndex];
  const totalPool = activePixel?.totalPool ?? 0;
  const totalSol = totalPool / 1e9;
  const netSol = totalSol * (1 - RAKE_PERCENT / 100);

  if (!activePixel || activePixel.status === "resolved") return null;

  return (
    <div
      style={{
        textAlign: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(255, 165, 0, 0.06))",
          border: "1px solid rgba(255, 215, 0, 0.15)",
          borderRadius: 12,
          padding: "8px 18px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-family-display)",
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "#FFD93B",
            lineHeight: 1,
          }}
        >
          {totalSol > 0 ? `${netSol.toFixed(3)} SOL` : "0 SOL"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontSize: "0.7rem",
            color: "#a0a0b0",
            lineHeight: 1,
          }}
        >
          in the pot
        </span>
      </div>
    </div>
  );
}
