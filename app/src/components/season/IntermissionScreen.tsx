"use client";

import { useEffect, useState } from "react";
import { computePixelColor } from "@/lib/color";
import { GRID_SIZE, TOTAL_PIXELS } from "@/lib/constants";
import type { PixelSnapshot } from "@/types/game";
import type { PlayerStats } from "@/components/share/ShareCanvas";
import { ShareCanvas } from "@/components/share/ShareCanvas";

interface IntermissionScreenProps {
  seasonNumber: number;
  pixels: Record<number, PixelSnapshot>;
  intermissionEndsSeconds: number;
  playerStats: PlayerStats | null;
}

/**
 * Format seconds as HH:MM:SS countdown string.
 */
function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return [
    String(h).padStart(2, "0"),
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ].join(":");
}

/**
 * Full-page intermission screen shown between seasons.
 *
 * - Live HH:MM:SS countdown to next season (updates every second)
 * - Completed canvas at medium size
 * - Season stats summary
 * - Share Canvas button
 * - View Canvas anchor scroll
 * - When countdown reaches 0, shows "New season starting..." message
 */
export function IntermissionScreen({
  seasonNumber,
  pixels,
  intermissionEndsSeconds,
  playerStats,
}: IntermissionScreenProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, intermissionEndsSeconds - Math.floor(Date.now() / 1000))
  );
  const [isExpired, setIsExpired] = useState(remainingSeconds <= 0);

  useEffect(() => {
    if (isExpired) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = intermissionEndsSeconds - now;
      if (remaining <= 0) {
        setRemainingSeconds(0);
        setIsExpired(true);
        clearInterval(interval);
      } else {
        setRemainingSeconds(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [intermissionEndsSeconds, isExpired]);

  // Compute season stats
  const totalPool = Object.values(pixels).reduce(
    (sum, px) => sum + (px.totalPool ?? 0),
    0
  );
  const totalPoolSol = (totalPool / 1_000_000_000).toFixed(4);

  const CELL_SIZE = 28;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
      }}
    >
      {/* Countdown section */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "32px",
        }}
      >
        <p
          style={{
            color: "rgba(255, 255, 255, 0.5)",
            fontSize: "1rem",
            marginBottom: "8px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Next Season starts in...
        </p>

        {isExpired ? (
          <p
            style={{
              fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
              fontSize: "2rem",
              color: "#3BFF8A",
            }}
          >
            New season starting...
          </p>
        ) : (
          <p
            data-testid="countdown-timer"
            style={{
              fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
              fontSize: "2.5rem",
              color: "#ffffff",
              letterSpacing: "0.04em",
            }}
          >
            {formatCountdown(remainingSeconds)}
          </p>
        )}
      </div>

      {/* Season heading */}
      <h1
        style={{
          fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
          fontSize: "clamp(1.4rem, 4vw, 2rem)",
          color: "rgba(255, 255, 255, 0.9)",
          textAlign: "center",
          marginBottom: "16px",
        }}
      >
        Season {seasonNumber} Complete
      </h1>

      {/* Completed canvas */}
      <div
        id="completed-canvas"
        role="grid"
        aria-label="Completed season canvas"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gap: "2px",
          marginBottom: "24px",
          border: "2px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: TOTAL_PIXELS }, (_, i) => {
          const pixel = pixels[i];
          let bgColor = "#1a1a2e";

          if (pixel) {
            try {
              bgColor = computePixelColor(pixel.colorIndex, pixel.shade, pixel.warmth);
            } catch {
              bgColor = "#1a1a2e";
            }
          }

          return (
            <div
              key={i}
              data-testid={`intermission-pixel-${i}`}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: bgColor,
              }}
            />
          );
        })}
      </div>

      {/* Season stats */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "28px",
          color: "rgba(255, 255, 255, 0.7)",
        }}
      >
        <p style={{ marginBottom: "4px" }}>{TOTAL_PIXELS} rounds played</p>
        <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.9rem" }}>
          Total pool: {totalPoolSol} SOL
        </p>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        {/* Share Canvas — uses ShareCanvas component which includes the offscreen template */}
        <ShareCanvas
          seasonNumber={seasonNumber}
          pixels={pixels}
          playerStats={playerStats}
        />

        {/* View Canvas anchor scroll */}
        <a
          href="#completed-canvas"
          style={{
            padding: "12px 24px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            color: "#fff",
            fontWeight: 600,
            fontSize: "1rem",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          View Canvas
        </a>
      </div>
    </div>
  );
}
