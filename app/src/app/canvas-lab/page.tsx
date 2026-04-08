"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { BASE_HEX } from "@/lib/color";

const TICK_INTERVAL_MS = 1000;
const GRID_SIZE_OPTIONS = [10, 15, 20];
const DEFAULT_GRID_SIZE = 10;

// v2 test palette: 8 colors. Must match COLOR_NAMES in /api/test-pixel/route.ts.
const TEST_PALETTE = [
  "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Black", "White",
];

const DEFAULT_SEASON_SUMMARY = `Paint a fantasy world divided into 4 elemental quadrants. Each quadrant has its own palette of 3 colors:

- Top-left (rows 0-4, cols 0-4): FIRE region. Use Red, Orange, Yellow.
- Top-right (rows 0-4, cols 5-9): WATER region. Use Blue, Purple, White.
- Bottom-left (rows 5-9, cols 0-4): EARTH region. Use Green, Yellow, Black.
- Bottom-right (rows 5-9, cols 5-9): VOID region. Use Black, Purple, White.

Within each quadrant, distribute the 3 colors roughly evenly — do not let any single color dominate. The exact placement of each color within a quadrant should feel organic and varied, not gridded.

Where two quadrants meet (along the dividing lines), allow some bleeding: a fire pixel might leak into the water region, an earth pixel might leak into the void. These boundary surprises should happen on roughly 1 in 4 boundary pixels.

Wild card rule: roughly 1 in 8 pixels anywhere on the canvas should be a "rift" pixel — pick a color from a DIFFERENT quadrant's palette than the one this pixel belongs to. Spread these throughout. Rifts make the canvas feel alive and unpredictable.`;

interface PaintedPixel {
  colorIndex: number;
  colorName: string;
  reasoning: string;
}

interface HistoryEntry {
  pixelIndex: number;
  x: number;
  y: number;
  color: string;
  reasoning: string;
}

export default function CanvasLabPage() {
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const totalPixels = gridSize * gridSize;

  const [seasonSummary, setSeasonSummary] = useState(DEFAULT_SEASON_SUMMARY);
  const [pixels, setPixels] = useState<(PaintedPixel | null)[]>(
    () => new Array(DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE).fill(null),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  // Refs let the recursive timer access the latest state without recreating the loop
  const runningRef = useRef(running);
  const pixelsRef = useRef(pixels);
  const currentIndexRef = useRef(currentIndex);
  const seasonSummaryRef = useRef(seasonSummary);
  const gridSizeRef = useRef(gridSize);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { pixelsRef.current = pixels; }, [pixels]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { seasonSummaryRef.current = seasonSummary; }, [seasonSummary]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);

  const paintNextPixel = useCallback(async () => {
    const idx = currentIndexRef.current;
    const size = gridSizeRef.current;
    const total = size * size;
    if (idx >= total) {
      setRunning(false);
      return;
    }

    const x = idx % size;
    const y = Math.floor(idx / size);

    const canvasPixels: { x: number; y: number; color: string }[] = [];
    const history: HistoryEntry[] = [];
    pixelsRef.current.forEach((p, i) => {
      if (p) {
        const px = i % size;
        const py = Math.floor(i / size);
        canvasPixels.push({ x: px, y: py, color: p.colorName });
        history.push({
          pixelIndex: i,
          x: px,
          y: py,
          color: p.colorName,
          reasoning: p.reasoning,
        });
      }
    });

    setBusy(true);
    setError(null);

    // Client-side retry: attempt the pixel up to 3 times with small backoff.
    // On persistent failure, log the error but KEEP GOING — skip the pixel
    // and try the next one rather than halting the whole canvas.
    const MAX_CLIENT_ATTEMPTS = 3;
    let lastErrorMsg: string | null = null;

    for (let attempt = 0; attempt < MAX_CLIENT_ATTEMPTS; attempt++) {
      try {
        const res = await fetch("/api/test-pixel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasPixels,
            currentX: x,
            currentY: y,
            gridWidth: size,
            gridHeight: size,
            history,
            seasonStyleSummary: seasonSummaryRef.current,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          lastErrorMsg = data.error ?? "API call failed";
          // Small backoff before retrying
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }

        const painted: PaintedPixel = {
          colorIndex: data.colorIndex,
          colorName: data.colorName,
          reasoning: data.reasoning,
        };
        setPixels((prev) => {
          const next = [...prev];
          next[idx] = painted;
          return next;
        });
        setCurrentIndex(idx + 1);
        setLastReasoning(`(${x}, ${y}) → ${data.colorName}: ${data.reasoning}`);
        setBusy(false);
        return;
      } catch (err) {
        lastErrorMsg = err instanceof Error ? err.message : String(err);
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // All retries exhausted — surface the error but keep the loop alive by
    // advancing past this pixel. The user can reset if the failures persist.
    setError(
      `Pixel (${x}, ${y}) skipped after ${MAX_CLIENT_ATTEMPTS} attempts: ${lastErrorMsg ?? "unknown error"}`,
    );
    setCurrentIndex(idx + 1);
    setBusy(false);
  }, []);

  // Recursive timer — schedules the next tick after each completes
  useEffect(() => {
    if (!running) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const loop = async () => {
      if (cancelled || !runningRef.current) return;
      await paintNextPixel();
      if (cancelled || !runningRef.current) return;
      const total = gridSizeRef.current * gridSizeRef.current;
      if (currentIndexRef.current >= total) return;
      timerRef.current = setTimeout(loop, TICK_INTERVAL_MS);
    };
    // Fire first tick immediately when started
    loop();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running, paintNextPixel]);

  const handleStart = () => {
    if (currentIndex >= totalPixels) return;
    setRunning(true);
  };
  const handleStop = () => setRunning(false);
  const handleReset = () => {
    setRunning(false);
    setPixels(new Array(totalPixels).fill(null));
    setCurrentIndex(0);
    setLastReasoning(null);
    setError(null);
  };
  const handleGridSizeChange = (size: number) => {
    if (running) return;
    setGridSize(size);
    setPixels(new Array(size * size).fill(null));
    setCurrentIndex(0);
    setLastReasoning(null);
    setError(null);
  };

  const filledCount = pixels.filter((p) => p !== null).length;
  const isComplete = currentIndex >= totalPixels;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#14141F",
        color: "#E0E0E0",
        fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-family-display)",
                fontSize: "2rem",
                margin: 0,
                letterSpacing: "0.04em",
              }}
            >
              CANVAS LAB
            </h1>
            <p style={{ margin: "4px 0 0 0", color: "#a0a0b0", fontSize: 14 }}>
              Test how the AI paints a {gridSize}×{gridSize} canvas given a
              season summary. One pixel every second, no blockchain.
            </p>
          </div>
          <Link
            href="/"
            style={{
              color: "#3BDBFF",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ← Back to game
          </Link>
        </div>

        {/* Season Summary editor */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "#a0a0b0",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Season Summary (master prompt)
          </label>
          <textarea
            value={seasonSummary}
            onChange={(e) => setSeasonSummary(e.target.value)}
            disabled={running}
            rows={14}
            style={{
              width: "100%",
              padding: "12px",
              background: "#1E1E2E",
              border: "1px solid #2A2A3E",
              borderRadius: 8,
              color: "#E0E0E0",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
              boxSizing: "border-box",
              opacity: running ? 0.5 : 1,
            }}
          />
          <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0 0" }}>
            Edit between runs. Locked while painting.
          </p>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {!running ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={isComplete}
              style={{
                background: isComplete
                  ? "#2A2A3E"
                  : "linear-gradient(135deg, #FF3B6F, #FF6B3B)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: isComplete ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {currentIndex === 0 ? "START" : "RESUME"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              style={{
                background: "#2A2A3E",
                color: "#FFD93B",
                border: "1px solid #FFD93B",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              PAUSE
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: "#2A2A3E",
              color: "#E0E0E0",
              border: "1px solid #2A2A3E",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            RESET
          </button>

          {/* Grid size selector — locked while running */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px",
              background: "#1E1E2E",
              borderRadius: 8,
              border: "1px solid #2A2A3E",
              opacity: running ? 0.5 : 1,
            }}
            title={running ? "Pause to change canvas size" : "Canvas size"}
          >
            {GRID_SIZE_OPTIONS.map((size) => {
              const active = size === gridSize;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleGridSizeChange(size)}
                  disabled={running}
                  style={{
                    background: active
                      ? "linear-gradient(135deg, #3BDBFF, #4299E1)"
                      : "transparent",
                    color: active ? "#14141F" : "#a0a0b0",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: running ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {size}×{size}
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginLeft: "auto",
              fontSize: 13,
              color: "#a0a0b0",
              fontWeight: 600,
            }}
          >
            {filledCount} / {totalPixels} pixels{" "}
            {busy && <span style={{ color: "#3BDBFF" }}>· thinking…</span>}
          </div>
        </div>

        {/* Canvas */}
        <div
          style={{
            padding: 10,
            background: "linear-gradient(145deg, #2a2233, #1e1a28, #2a2233)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              padding: 3,
              background: "#14141f",
              borderRadius: 6,
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gap: gridSize <= 10 ? 2 : 1,
                aspectRatio: "1",
              }}
            >
              {pixels.map((p, i) => {
                const isCurrent = i === currentIndex && running;
                const bg = p
                  ? BASE_HEX[p.colorName] ?? "#2A2A3E"
                  : "#2A2A3E";
                return (
                  <div
                    key={i}
                    title={
                      p
                        ? `(${i % gridSize}, ${Math.floor(i / gridSize)}) — ${p.colorName}`
                        : `(${i % gridSize}, ${Math.floor(i / gridSize)})`
                    }
                    style={{
                      background: bg,
                      borderRadius: 2,
                      outline: isCurrent ? "2px solid #3BDBFF" : "none",
                      outlineOffset: -1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Last reasoning */}
        {lastReasoning && (
          <div
            style={{
              padding: 12,
              background: "#1E1E2E",
              border: "1px solid #2A2A3E",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13,
              lineHeight: 1.5,
              color: "#c0c0d0",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              Latest selection
            </div>
            {lastReasoning}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 12,
              background: "#3a1a22",
              border: "1px solid #FF3B6F",
              borderRadius: 8,
              fontSize: 13,
              color: "#FF8FAC",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Color legend */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid #2A2A3E",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Palette
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {TEST_PALETTE.map((name) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#a0a0b0",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    background: BASE_HEX[name],
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
