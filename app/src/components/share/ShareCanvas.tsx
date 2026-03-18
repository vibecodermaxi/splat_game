"use client";

import { useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import { computePixelColor } from "@/lib/color";
import { GRID_SIZE, TOTAL_PIXELS } from "@/lib/constants";
import type { PixelSnapshot } from "@/types/game";

export interface PlayerStats {
  totalBets: number;
  correctPredictions: number;
  hitRate: string;
}

interface ShareCanvasTemplateProps {
  seasonNumber: number;
  pixels: Record<number, PixelSnapshot>;
  playerStats: PlayerStats | null;
  divRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hidden offscreen branded layout for PNG capture.
 * Uses inline styles with resolved hex values — not CSS variables.
 * (Pitfall 2: html-to-image may not resolve CSS custom properties in offscreen elements)
 */
export function ShareCanvasTemplate({
  seasonNumber,
  pixels,
  playerStats,
  divRef,
}: ShareCanvasTemplateProps) {
  const CELL_SIZE = 32;
  const GRID_WIDTH = CELL_SIZE * GRID_SIZE + (GRID_SIZE - 1) * 2; // cells + gaps

  return (
    <div
      ref={divRef}
      style={{
        position: "absolute",
        left: "-9999px",
        top: 0,
        visibility: "hidden",
        // Branded frame
        background: "#14141F",
        border: "3px solid #2a2a3f",
        borderRadius: "12px",
        padding: "24px",
        width: `${GRID_WIDTH + 48}px`,
        fontFamily: "'Nunito', Arial, sans-serif",
      }}
    >
      {/* Heading */}
      <div
        style={{
          fontFamily: "'Luckiest Guy', Impact, 'Arial Black', sans-serif",
          fontSize: "1.4rem",
          color: "#ffffff",
          textAlign: "center",
          marginBottom: "16px",
          letterSpacing: "0.04em",
        }}
      >
        Pixel Predict -- Season {seasonNumber}
      </div>

      {/* Canvas grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gap: "2px",
          marginBottom: "16px",
          border: "1px solid #2a2a3f",
          borderRadius: "4px",
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
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: bgColor,
              }}
            />
          );
        })}
      </div>

      {/* Player stats (if provided) */}
      {playerStats && (
        <div
          style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.8)",
            fontSize: "0.85rem",
            marginBottom: "8px",
          }}
        >
          Bets: {playerStats.totalBets} | Wins: {playerStats.correctPredictions} | Hit Rate:{" "}
          {playerStats.hitRate}%
        </div>
      )}

      {/* Site URL */}
      <div
        style={{
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.75rem",
        }}
      >
        pixelpredict.com
      </div>
    </div>
  );
}

interface UseShareCanvasOptions {
  seasonNumber: number;
}

/**
 * Hook providing share/download functionality for the season canvas PNG.
 *
 * Returns:
 * - shareRef: ref to attach to the offscreen template div
 * - handleShare: triggers PNG generation and share/download
 * - isGenerating: loading state during async PNG generation
 */
export function useShareCanvas({ seasonNumber }: UseShareCanvasOptions) {
  const shareRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = useCallback(async () => {
    if (!shareRef.current) return;

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(shareRef.current, { pixelRatio: 2 });

      // Convert data URL to blob for navigator.share
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `splat-season-${seasonNumber}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // navigator.share with files (mobile) or download fallback (desktop)
      // Pitfall 7: always check canShare before calling share
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare != null &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Pixel Predict Season ${seasonNumber}`,
        });
      } else {
        // Programmatic download fallback
        const link = document.createElement("a");
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } finally {
      setIsGenerating(false);
    }
  }, [seasonNumber]);

  return { shareRef, handleShare, isGenerating };
}

interface ShareCanvasProps {
  seasonNumber: number;
  pixels: Record<number, PixelSnapshot>;
  playerStats: PlayerStats | null;
}

/**
 * Convenience wrapper that combines ShareCanvasTemplate (offscreen) + trigger button.
 * Can also be used headlessly by consuming useShareCanvas() directly.
 */
export function ShareCanvas({ seasonNumber, pixels, playerStats }: ShareCanvasProps) {
  const { shareRef, handleShare, isGenerating } = useShareCanvas({ seasonNumber });

  return (
    <>
      <ShareCanvasTemplate
        seasonNumber={seasonNumber}
        pixels={pixels}
        playerStats={playerStats}
        divRef={shareRef}
      />
      <button
        onClick={handleShare}
        disabled={isGenerating}
        style={{
          padding: "12px 24px",
          background: "linear-gradient(135deg, #FF3B6F 0%, #A855F7 100%)",
          border: "none",
          borderRadius: "8px",
          color: "#fff",
          fontWeight: 700,
          fontSize: "1rem",
          cursor: isGenerating ? "wait" : "pointer",
          opacity: isGenerating ? 0.7 : 1,
        }}
      >
        {isGenerating ? "Generating..." : "Share Canvas"}
      </button>
    </>
  );
}
