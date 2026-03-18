"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR_NAMES } from "@/lib/color";
import type { PixelSnapshot } from "@/types/game";

interface PixelTooltipProps {
  pixelIndex: number;
  data: PixelSnapshot;
  position: { x: number; y: number };
  onDismiss: () => void;
}

const TOOLTIP_WIDTH = 200;
const TOOLTIP_MARGIN = 8;

function clampToViewport(
  x: number,
  y: number,
  tooltipHeight: number
): { left: number; top: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 667;

  let left = x + TOOLTIP_MARGIN;
  let top = y + TOOLTIP_MARGIN;

  // Clamp right edge
  if (left + TOOLTIP_WIDTH > vw - TOOLTIP_MARGIN) {
    left = x - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
  }
  // Clamp bottom edge
  if (top + tooltipHeight > vh - TOOLTIP_MARGIN) {
    top = y - tooltipHeight - TOOLTIP_MARGIN;
  }
  // Clamp left edge
  if (left < TOOLTIP_MARGIN) {
    left = TOOLTIP_MARGIN;
  }
  // Clamp top edge
  if (top < TOOLTIP_MARGIN) {
    top = TOOLTIP_MARGIN;
  }

  return { left, top };
}

/** Convert a number[] (byte array) to a lowercase hex string */
function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Truncate a hex string: first 8 + "..." + last 8 chars */
function truncateHex(hex: string): string {
  if (hex.length <= 16) return hex;
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

export function PixelTooltip({ pixelIndex, data, position, onDismiss }: PixelTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [proofExpanded, setProofExpanded] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(() =>
    clampToViewport(position.x, position.y, 160)
  );

  const colorName = COLOR_NAMES[data.colorIndex] ?? "Unknown";
  const isResolved = data.status === "resolved";

  // Build hex string for prompt hash
  const promptHashHex = data.promptHash ? bytesToHex(data.promptHash) : null;
  const promptHashDisplay = promptHashHex ? truncateHex(promptHashHex) : null;

  // Re-clamp after render (dynamic height)
  useEffect(() => {
    const el = tooltipRef.current;
    if (el) {
      const height = el.getBoundingClientRect().height;
      setTooltipPos(clampToViewport(position.x, position.y, height));
    }
  }, [position.x, position.y, proofExpanded]);

  // Animate in on mount via CSS keyframe
  useEffect(() => {
    const el = tooltipRef.current;
    if (el) {
      el.style.animation = "tooltipFadeIn 0.15s ease-out forwards";
    }
  }, []);

  // Dismiss on click-away
  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("touchstart", handleClickAway as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("touchstart", handleClickAway as EventListener);
    };
  }, [onDismiss]);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        left: tooltipPos.left,
        top: tooltipPos.top,
        width: TOOLTIP_WIDTH,
        background: "#1E1E2E",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        border: "1px solid #2A2A3E",
        zIndex: 100,
        pointerEvents: "auto",
      }}
    >
      {/* Color name + VRF badge */}
      <div
        style={{
          fontFamily: "var(--font-family-display, Fredoka One, cursive)",
          fontSize: 14,
          fontWeight: 700,
          color: "#e0e0e0",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {colorName}
        {data.vrfResolved && (
          <span
            style={{
              fontSize: 10,
              background: "#3BDBFF22",
              color: "#3BDBFF",
              border: "1px solid #3BDBFF55",
              borderRadius: 4,
              padding: "1px 4px",
              fontFamily: "var(--font-family-mono, JetBrains Mono, monospace)",
              fontWeight: 500,
            }}
          >
            VRF
          </span>
        )}
      </div>

      {/* Shade / Warmth / Round */}
      <div
        style={{
          fontSize: 12,
          color: "#a0a0b0",
          lineHeight: 1.6,
        }}
      >
        <div>Shade: {data.shade}</div>
        <div>Warmth: {data.warmth}</div>
        <div>Round {pixelIndex + 1}</div>
      </div>

      {/* Verified fair badge — only for resolved pixels */}
      {isResolved && (
        <div style={{ marginTop: 8 }}>
          {data.vrfResolved ? (
            <span
              style={{
                fontSize: 11,
                color: "#ED8936",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span aria-hidden="true">&#x21BA;</span>
              Resolved via random fallback
            </span>
          ) : (
            <span
              data-testid="verified-fair-badge"
              style={{
                fontSize: 11,
                color: "#3BDBFF",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span aria-hidden="true">&#10003;</span>
              Verified fair
            </span>
          )}

          {/* View proof toggle */}
          {promptHashHex && (
            <button
              onClick={() => setProofExpanded((prev) => !prev)}
              style={{
                marginTop: 6,
                background: "none",
                border: "none",
                color: "#6b7280",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              {proofExpanded ? "Hide proof" : "View proof"}
            </button>
          )}

          {/* Expandable proof section */}
          {proofExpanded && promptHashHex && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid #2A2A3E",
                fontSize: 11,
                color: "#a0a0b0",
                lineHeight: 1.6,
              }}
            >
              {/* Prompt hash */}
              <div>
                <span style={{ color: "#6b7280" }}>Prompt commitment proof</span>
                <div
                  data-testid="prompt-hash-hex"
                  style={{
                    fontFamily: "var(--font-family-mono, JetBrains Mono, monospace)",
                    fontSize: 10,
                    color: "#e0e0e0",
                    marginTop: 2,
                    wordBreak: "break-all",
                  }}
                >
                  {promptHashDisplay}
                </div>
              </div>

              {/* Arweave link */}
              {data.arweaveTxid && (
                <div style={{ marginTop: 6 }}>
                  <a
                    href={`https://arweave.net/${data.arweaveTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#3BDBFF",
                      textDecoration: "underline",
                      fontSize: 11,
                    }}
                  >
                    View prompt on Arweave
                  </a>
                </div>
              )}

              {/* VRF explanation note */}
              {data.vrfResolved && (
                <div
                  style={{
                    marginTop: 6,
                    color: "#a0a0b0",
                    fontStyle: "italic",
                  }}
                >
                  This pixel was resolved using Switchboard VRF (verifiable random function) because the AI was unavailable.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
