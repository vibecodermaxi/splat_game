"use client";

import { useState, useCallback, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
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
  // The grid is 10x10; each cell occupies 1/10 of the total width/height (including gap)
  const getResolutionOverlayStyle = useCallback(
    (pixelIndex: number) => {
      const row = Math.floor(pixelIndex / 10);
      const col = pixelIndex % 10;
      // 10 cells with 3px gaps between them (9 gaps total)
      // Each cell takes (100% - 27px) / 10 of space
      const cellSize = "calc((100% - 27px) / 10)";
      const cellOffset = (n: number) => `calc(${n} * ((100% - 27px) / 10) + ${n * 3}px)`;

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

  // Render 100 pixels (0-99)
  const pixelIndices = Array.from({ length: 100 }, (_, i) => i);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "min(calc(100vw - 32px), 480px)",
        aspectRatio: "1",
        margin: "0 auto",
        position: "relative",
      }}
    >
      <div
        ref={gridRef}
        data-testid="game-canvas"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: "3px",
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
  );
}
