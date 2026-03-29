"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";
import type { PixelSnapshot } from "@/types/game";

interface PixelTooltipProps {
  pixelIndex: number;
  data: PixelSnapshot;
  position: { x: number; y: number };
  onDismiss: () => void;
}

const TOOLTIP_WIDTH = 220;
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

  if (left + TOOLTIP_WIDTH > vw - TOOLTIP_MARGIN) {
    left = x - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
  }
  if (top + tooltipHeight > vh - TOOLTIP_MARGIN) {
    top = y - tooltipHeight - TOOLTIP_MARGIN;
  }
  if (left < TOOLTIP_MARGIN) {
    left = TOOLTIP_MARGIN;
  }
  if (top < TOOLTIP_MARGIN) {
    top = TOOLTIP_MARGIN;
  }

  return { left, top };
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function truncateHex(hex: string): string {
  if (hex.length <= 16) return hex;
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

export function PixelTooltip({ pixelIndex, data, position, onDismiss }: PixelTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [proofExpanded, setProofExpanded] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(() =>
    clampToViewport(position.x, position.y, 180)
  );

  const colorName = COLOR_NAMES[data.colorIndex] ?? "Unknown";
  const colorHex = BASE_HEX[colorName] ?? "#888";
  const isResolved = data.status === "resolved";
  const promptHashHex = data.promptHash ? bytesToHex(data.promptHash) : null;
  const promptHashDisplay = promptHashHex ? truncateHex(promptHashHex) : null;

  useEffect(() => {
    const el = tooltipRef.current;
    if (el) {
      const height = el.getBoundingClientRect().height;
      setTooltipPos(clampToViewport(position.x, position.y, height));
    }
  }, [position.x, position.y, proofExpanded]);

  useEffect(() => {
    const el = tooltipRef.current;
    if (el) {
      el.style.animation = "tooltipFadeIn 0.15s ease-out forwards";
    }
  }, []);

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
        background: "linear-gradient(170deg, #1E1E2E 0%, #1a1a28 100%)",
        borderRadius: 14,
        padding: 0,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 12px 2px ${colorHex}20`,
        border: `1px solid ${colorHex}30`,
        zIndex: 100,
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      {/* Color bar header */}
      <div
        style={{
          background: colorHex,
          padding: "10px 12px 8px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Brush icon */}
        <span style={{ fontSize: "1rem", lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
          🖌️
        </span>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-family-display)",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.4)",
              letterSpacing: "0.02em",
              lineHeight: 1.2,
            }}
          >
            {colorName}
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            }}
          >
            Pixel #{pixelIndex + 1}
          </div>
        </div>

        {data.vrfResolved && (
          <span
            style={{
              fontSize: 9,
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              borderRadius: 4,
              padding: "2px 5px",
              fontFamily: "var(--font-family-mono, JetBrains Mono, monospace)",
              fontWeight: 600,
            }}
          >
            VRF
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px 12px" }}>
        {/* Artist note — italic handwriting feel */}
        <p
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontStyle: "italic",
            fontSize: "0.75rem",
            color: "#b0b0c0",
            lineHeight: 1.5,
            margin: "0 0 8px",
            borderLeft: `2px solid ${colorHex}60`,
            paddingLeft: 8,
          }}
        >
          {data.vrfResolved
            ? "Chosen by verifiable randomness — the AI was taking a nap."
            : `The AI chose ${colorName} for this pixel, guided by the canvas so far.`}
        </p>

        {/* Verified fair / proof */}
        {isResolved && (
          <div>
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
                Random fallback
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

            {promptHashHex && (
              <button
                onClick={() => setProofExpanded((prev) => !prev)}
                style={{
                  marginTop: 6,
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: 10,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                  fontFamily: "inherit",
                  minHeight: "auto",
                }}
              >
                {proofExpanded ? "Hide proof" : "View proof"}
              </button>
            )}

            {proofExpanded && promptHashHex && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid #2A2A3E",
                  fontSize: 10,
                  color: "#a0a0b0",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <span style={{ color: "#6b7280" }}>Prompt hash</span>
                  <div
                    data-testid="prompt-hash-hex"
                    style={{
                      fontFamily: "var(--font-family-mono, JetBrains Mono, monospace)",
                      fontSize: 9,
                      color: "#e0e0e0",
                      marginTop: 2,
                      wordBreak: "break-all",
                    }}
                  >
                    {promptHashDisplay}
                  </div>
                </div>

                {data.arweaveTxid && (
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={`https://arweave.net/${data.arweaveTxid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#3BDBFF",
                        textDecoration: "underline",
                        fontSize: 10,
                      }}
                    >
                      View prompt on Arweave
                    </a>
                  </div>
                )}

                {data.vrfResolved && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "#a0a0b0",
                      fontStyle: "italic",
                      fontSize: 10,
                    }}
                  >
                    Resolved via Switchboard VRF because the AI was unavailable.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
