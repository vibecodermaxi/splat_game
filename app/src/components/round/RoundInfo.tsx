"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/store/gameStore";
import { TOTAL_PIXELS } from "@/lib/constants";

const MILESTONE_PERCENTS = [25, 50, 75];
const BRAND_COLORS = ["#FF3B6F", "#3BDBFF", "#FFD93B", "#A83BFF", "#FF6B3B", "#3BFF8A"];

export function RoundInfo() {
  const currentPixelIndex = useGameStore((state) => state.currentPixelIndex);
  const seasonNumber = useGameStore((state) => state.seasonNumber);

  const roundDisplay = currentPixelIndex + 1;
  const progressPercent = (currentPixelIndex / TOTAL_PIXELS) * 100;

  // Track milestones already celebrated to avoid re-firing
  const celebratedRef = useRef<Set<number>>(new Set());
  const prevPixelRef = useRef(currentPixelIndex);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only fire when pixel index actually advances (not on initial load of an old value)
    if (currentPixelIndex <= prevPixelRef.current && prevPixelRef.current !== 0) {
      prevPixelRef.current = currentPixelIndex;
      return;
    }
    prevPixelRef.current = currentPixelIndex;

    const pct = (currentPixelIndex / TOTAL_PIXELS) * 100;

    for (const milestone of MILESTONE_PERCENTS) {
      if (pct >= milestone && !celebratedRef.current.has(milestone)) {
        celebratedRef.current.add(milestone);

        // Get progress bar position for confetti origin
        const bar = progressBarRef.current;
        if (bar) {
          const rect = bar.getBoundingClientRect();
          const originX = (rect.left + rect.width * (milestone / 100)) / window.innerWidth;
          const originY = rect.top / window.innerHeight;

          confetti({
            particleCount: 40,
            spread: 60,
            startVelocity: 20,
            origin: { x: originX, y: originY },
            colors: BRAND_COLORS,
            gravity: 0.8,
            ticks: 120,
          });
        }
      }
    }
  }, [currentPixelIndex]);

  // Milestone marker positions
  const milestoneMarkers = MILESTONE_PERCENTS.map((pct) => ({
    pct,
    reached: progressPercent >= pct,
  }));

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
      {/* Season label + live indicator */}
      <div
        style={{
          fontFamily: "var(--font-family-body, Nunito, sans-serif)",
          fontSize: 13,
          color: "#a0a0b0",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Season {seasonNumber}
        <span
          aria-label="Oracle is live"
          title="Oracle is live"
          className="live-dot"
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: "#3BFF8A",
            flexShrink: 0,
          }}
        />
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
        <span style={{ color: "#a0a0b0", fontSize: 14 }}>of {TOTAL_PIXELS}</span>
      </div>

      {/* Progress bar with milestone markers */}
      <div
        ref={progressBarRef}
        style={{
          width: "100%",
          height: 3,
          borderRadius: 2,
          background: "#2A2A3E",
          overflow: "visible",
          position: "relative",
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
        {/* Milestone tick marks */}
        {milestoneMarkers.map(({ pct, reached }) => (
          <div
            key={pct}
            style={{
              position: "absolute",
              left: `${pct}%`,
              top: -3,
              width: 1,
              height: 9,
              background: reached ? "#3BDBFF" : "#444",
              transition: "background 0.4s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
