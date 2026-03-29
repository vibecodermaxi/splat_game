"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { computePixelColor } from "@/lib/color";
import { GRID_SIZE, TOTAL_PIXELS } from "@/lib/constants";
import { PixelCell } from "./PixelCell";
import { PixelTooltip } from "./PixelTooltip";
import { ResolutionAnimation } from "./ResolutionAnimation";
import { useResolution } from "@/hooks/useResolution";
import type { PixelSnapshot } from "@/types/game";

interface TooltipState {
  pixelIndex: number;
  position: { x: number; y: number };
}

export function GameCanvas() {
  const pixels = useGameStore((state) => state.pixels);
  const currentPixelIndex = useGameStore((state) => state.currentPixelIndex);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Resolution animation
  const { resolvedPixel, clearResolution } = useResolution();
  const gridRef = useRef<HTMLDivElement>(null);

  // Compute glow color from the most recently resolved pixel
  const glowColor = useMemo(() => {
    // Find highest-index resolved pixel for the glow
    let lastResolved: PixelSnapshot | null = null;
    let lastIndex = -1;
    for (const [key, px] of Object.entries(pixels)) {
      const idx = parseInt(key, 10);
      if (px?.status === "resolved" && idx > lastIndex) {
        lastResolved = px;
        lastIndex = idx;
      }
    }
    if (!lastResolved) return "rgba(59, 219, 255, 0.15)"; // default cyan
    try {
      const hex = computePixelColor(lastResolved.colorIndex, lastResolved.shade, lastResolved.warmth);
      return `${hex}30`; // ~19% opacity
    } catch {
      return "rgba(59, 219, 255, 0.15)";
    }
  }, [pixels]);

  const handlePixelTap = useCallback(
    (pixelIndex: number, event?: React.MouseEvent | React.TouchEvent) => {
      const data = pixels[pixelIndex];
      const isActive = pixelIndex === currentPixelIndex;

      if (isActive) {
        // Active pixel — PixelCell handles scroll
        setTooltip(null);
        return;
      }

      if (data?.status === "resolved") {
        // Get tap position from event
        let x = 0;
        let y = 0;
        if (event) {
          if ("touches" in event && event.touches.length > 0) {
            x = event.touches[0].clientX;
            y = event.touches[0].clientY;
          } else if ("clientX" in event) {
            x = event.clientX;
            y = event.clientY;
          }
        }
        setTooltip({ pixelIndex, position: { x, y } });
      }
    },
    [pixels, currentPixelIndex]
  );

  const handleTap = useCallback(
    (pixelIndex: number) => {
      // Wrapper for PixelCell — no event available here, use center of screen as fallback
      const data = pixels[pixelIndex];
      const isActive = pixelIndex === currentPixelIndex;

      if (isActive) {
        setTooltip(null);
        return;
      }

      if (data?.status === "resolved") {
        // Use last known touch/click position from document — approximate
        setTooltip({ pixelIndex, position: { x: 200, y: 300 } });
      }
    },
    [pixels, currentPixelIndex]
  );

  const dismissTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  // Calculate overlay position for the resolving pixel cell
  const gap = GRID_SIZE <= 10 ? 3 : 2;
  const totalGap = (GRID_SIZE - 1) * gap;
  const getResolutionOverlayStyle = useCallback(
    (pixelIndex: number) => {
      const row = Math.floor(pixelIndex / GRID_SIZE);
      const col = pixelIndex % GRID_SIZE;
      const cellSize = `calc((100% - ${totalGap}px) / ${GRID_SIZE})`;
      const cellOffset = (n: number) => `calc(${n} * ((100% - ${totalGap}px) / ${GRID_SIZE}) + ${n * gap}px)`;

      return {
        position: "absolute" as const,
        left: cellOffset(col),
        top: cellOffset(row),
        width: cellSize,
        height: cellSize,
        zIndex: 10,
        pointerEvents: "none" as const,
        borderRadius: "4px",
        overflow: "hidden",
      };
    },
    []
  );

  const pixelIndices = Array.from({ length: TOTAL_PIXELS }, (_, i) => i);

  return (
    <div
      style={{
        width: "100%",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Shadow-box frame */}
      <div
        style={{
          padding: "10px",
          background: "linear-gradient(145deg, #2a2233, #1e1a28, #2a2233)",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.05),
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 0 30px 8px ${glowColor},
            0 0 60px 16px ${glowColor},
            0 8px 24px rgba(0,0,0,0.5)
          `,
          transition: "box-shadow 1.5s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Inner mat / bevel */}
        <div
          style={{
            padding: "3px",
            background: "#14141f",
            borderRadius: "6px",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{ aspectRatio: "1", position: "relative" }}
          >
      <div
        ref={gridRef}
        data-testid="game-canvas"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: `${gap}px`,
          width: "100%",
          height: "100%",
          position: "relative",
        }}
        onClick={(e) => {
          // Capture click position for tooltip placement
          const target = e.target as HTMLElement;
          const pixelIndexAttr = target.getAttribute("data-pixel-index");
          if (pixelIndexAttr !== null) {
            const pixelIndex = parseInt(pixelIndexAttr, 10);
            const data = pixels[pixelIndex];
            const isActive = pixelIndex === currentPixelIndex;

            if (!isActive && data?.status === "resolved") {
              setTooltip({
                pixelIndex,
                position: { x: e.clientX, y: e.clientY },
              });
            }
          }
        }}
      >
        {pixelIndices.map((pixelIndex) => (
          <PixelCell
            key={pixelIndex}
            pixelIndex={pixelIndex}
            isActive={pixelIndex === currentPixelIndex}
            data={pixels[pixelIndex]}
            onTap={handleTap}
          />
        ))}
      </div>

      {/* Resolution animation overlay — positioned over the resolving pixel cell */}
      {resolvedPixel && (
        <div
          style={getResolutionOverlayStyle(resolvedPixel.pixelIndex)}
        >
          <ResolutionAnimation
            pixelIndex={resolvedPixel.pixelIndex}
            winningColorHex={resolvedPixel.winningColorHex}
            onComplete={clearResolution}
          />
        </div>
      )}

      {tooltip && pixels[tooltip.pixelIndex] && (
        <PixelTooltip
          pixelIndex={tooltip.pixelIndex}
          data={pixels[tooltip.pixelIndex] as PixelSnapshot}
          position={tooltip.position}
          onDismiss={dismissTooltip}
        />
      )}
          </div>
        </div>

        {/* Paint drip accents at bottom of frame */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 16"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            bottom: 2,
            left: "10%",
            width: "80%",
            height: "12px",
            opacity: 0.25,
            pointerEvents: "none",
          }}
        >
          {/* Small drip blobs along the bottom */}
          <ellipse cx="80" cy="6" rx="4" ry="6" fill="#ff3b6f" />
          <ellipse cx="160" cy="4" rx="3" ry="4" fill="#3bdbff" />
          <ellipse cx="240" cy="7" rx="5" ry="7" fill="#ffd93b" />
          <ellipse cx="320" cy="5" rx="3.5" ry="5" fill="#a83bff" />
        </svg>
      </div>
    </div>
  );
}
