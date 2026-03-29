"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { computePixelColor } from "@/lib/color";
import { GRID_SIZE, TOTAL_PIXELS } from "@/lib/constants";
import type { PixelSnapshot } from "@/types/game";

const BRAND_COLORS = [
  "#FF3B6F",
  "#FF6B3B",
  "#3BDBFF",
  "#FFDD3B",
  "#A855F7",
  "#22D3EE",
];

interface SeasonCompleteOverlayProps {
  seasonNumber: number;
  pixels: Record<number, PixelSnapshot>;
  onDismiss: () => void;
  onShare?: () => void;
}

/**
 * Full-screen celebration overlay shown when a season completes.
 *
 * - Confetti burst for 4 seconds on mount (respects prefers-reduced-motion)
 * - Zoomed 10x10 canvas grid centered on screen
 * - Season stats below canvas
 * - Share Canvas + Continue buttons
 */
export function SeasonCompleteOverlay({
  seasonNumber,
  pixels,
  onDismiss,
  onShare,
}: SeasonCompleteOverlayProps) {
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const confettiFrameRef = useRef<number | null>(null);

  // Sustained confetti burst on mount
  useEffect(() => {
    if (reducedMotion) return;

    const duration = 4000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: BRAND_COLORS,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: BRAND_COLORS,
      });

      if (Date.now() < end) {
        confettiFrameRef.current = requestAnimationFrame(frame);
      }
    };

    confettiFrameRef.current = requestAnimationFrame(frame);

    return () => {
      if (confettiFrameRef.current !== null) {
        cancelAnimationFrame(confettiFrameRef.current);
      }
    };
  }, [reducedMotion]);

  // Compute season stats
  const totalPool = Object.values(pixels).reduce(
    (sum, px) => sum + (px.totalPool ?? 0),
    0
  );
  const totalPoolSol = (totalPool / 1_000_000_000).toFixed(4);

  // Render pixel cells for the grid
  const cellSize = Math.min(Math.floor((Math.min(400, window?.innerWidth ?? 400) - 16) / GRID_SIZE), 40);

  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.5 },
      };

  return (
    <AnimatePresence>
      <motion.div
        key="season-complete-overlay"
        {...motionProps}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 600,
          background: "rgba(10, 10, 20, 0.92)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflowY: "auto",
          padding: "24px 16px",
        }}
      >
        {/* Heading */}
        <h1
          style={{
            fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
            fontSize: "clamp(1.8rem, 5vw, 3rem)",
            color: "#fff",
            textAlign: "center",
            marginBottom: "24px",
            letterSpacing: "0.02em",
          }}
        >
          Season {seasonNumber} Complete!
        </h1>

        {/* Zoomed canvas grid */}
        <div
          role="grid"
          aria-label="Completed season canvas"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
            gap: "2px",
            marginBottom: "24px",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: TOTAL_PIXELS }, (_, i) => {
            const pixel = pixels[i];
            let bgColor = "#1a1a2e";

            if (pixel && pixel.status === "resolved" && pixel.winningColor !== null) {
              try {
                bgColor = computePixelColor(pixel.colorIndex, pixel.shade, pixel.warmth);
              } catch {
                bgColor = "#1a1a2e";
              }
            } else if (pixel && pixel.status !== "open") {
              try {
                bgColor = computePixelColor(pixel.colorIndex, pixel.shade, pixel.warmth);
              } catch {
                bgColor = "#1a1a2e";
              }
            }

            return (
              <div
                key={i}
                data-testid={`pixel-cell-${i}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bgColor,
                }}
              />
            );
          })}
        </div>

        {/* Season stats */}
        <div
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          <p
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "1rem",
              marginBottom: "4px",
            }}
          >
            {TOTAL_PIXELS} rounds
          </p>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "0.9rem",
            }}
          >
            Total pool: {totalPoolSol} SOL
          </p>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: "300px",
          }}
        >
          {onShare && (
            <button
              onClick={onShare}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: "linear-gradient(135deg, #FF3B6F 0%, #A855F7 100%)",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Share Canvas
            </button>
          )}

          <button
            onClick={onDismiss}
            style={{
              width: "100%",
              padding: "14px 24px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              color: "#fff",
              fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
