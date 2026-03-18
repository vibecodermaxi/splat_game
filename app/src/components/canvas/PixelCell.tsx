"use client";

import { computePixelColor } from "@/lib/color";
import type { PixelSnapshot } from "@/types/game";

interface PixelCellProps {
  pixelIndex: number;
  isActive: boolean;
  data: PixelSnapshot | undefined;
  onTap: (pixelIndex: number) => void;
}

export function PixelCell({ pixelIndex, isActive, data, onTap }: PixelCellProps) {
  const isResolved = data?.status === "resolved";
  const hasData = data !== undefined;

  // Compute background color for resolved pixels
  let backgroundColor: string | undefined;
  if (isResolved && data) {
    try {
      backgroundColor = computePixelColor(data.colorIndex, data.shade, data.warmth);
    } catch {
      backgroundColor = "#2A2A3E";
    }
  }

  const handleClick = () => {
    onTap(pixelIndex);
    if (isActive) {
      const bettingPanel = document.getElementById("betting-panel");
      if (bettingPanel) {
        bettingPanel.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // Determine style
  let style: React.CSSProperties = {
    aspectRatio: "1",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "opacity 150ms ease",
  };

  if (isResolved && backgroundColor) {
    style = {
      ...style,
      backgroundColor,
      position: "relative",
    };
  } else if (isActive) {
    style = {
      ...style,
      backgroundColor: "#2A2A3E",
    };
  } else {
    style = {
      ...style,
      backgroundColor: "#2A2A3E",
      opacity: hasData ? 0.6 : 0.4,
    };
  }

  // Class name
  let className = "pixel-cell";
  if (isResolved && backgroundColor) {
    className += " pixel-resolved";
  }
  if (isActive) {
    className += " pixel-active";
  }

  const showVrfDot = data?.vrfResolved === true && data?.status === "resolved";

  return (
    <div
      data-pixel-index={pixelIndex}
      className={className}
      style={style}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={
        isActive
          ? `Active pixel ${pixelIndex + 1} — tap to bet`
          : isResolved && data
          ? `Resolved pixel ${pixelIndex + 1}`
          : `Empty pixel ${pixelIndex + 1}`
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {showVrfDot && (
        <span
          aria-label="VRF resolved"
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#3BDBFF",
            display: "block",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
