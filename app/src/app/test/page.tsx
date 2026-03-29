"use client";

import { useState } from "react";
import Link from "next/link";
import { BASE_HEX, COLOR_NAMES } from "@/lib/color";

const COLOR_HEX = COLOR_NAMES.map((name) => BASE_HEX[name] ?? "#888");

export default function TestCanvasPage() {
  const [gridSize, setGridSize] = useState(20);
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (size?: number) => {
    const s = size ?? gridSize;
    setLoading(true);
    setError(null);
    setGrid(null);
    try {
      const res = await fetch("/api/generate-canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gridSize: s }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate");
        return;
      }
      setGrid(data.grid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleSizeChange = (s: number) => {
    setGridSize(s);
    setGrid(null);
  };

  const gap = gridSize <= 20 ? 2 : gridSize <= 30 ? 1 : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#14141F",
        color: "#E0E0E0",
        alignItems: "center",
        padding: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: 700,
          marginBottom: 16,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontSize: "0.85rem",
            color: "#3BDBFF",
            textDecoration: "none",
          }}
        >
          &larr; Back
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-family-display)",
            fontSize: "1.2rem",
            color: "#fff",
            margin: 0,
          }}
        >
          Canvas Test
        </h1>
        <div style={{ width: 48 }} />
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {[10, 20, 30].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSizeChange(s)}
            style={{
              background: gridSize === s ? "#3BDBFF" : "#2A2A3E",
              color: gridSize === s ? "#000" : "#aaa",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              minHeight: "auto",
              fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            }}
          >
            {s}x{s}
          </button>
        ))}

        <button
          type="button"
          onClick={() => generate()}
          disabled={loading}
          style={{
            background: loading ? "#2A2A3E" : "linear-gradient(135deg, #FF3B6F, #FF6B3B)",
            color: loading ? "#888" : "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            minHeight: "auto",
            fontFamily: "var(--font-family-display)",
            letterSpacing: "0.04em",
          }}
        >
          {loading ? "Painting..." : "Paint with AI"}
        </button>
      </div>

      {/* Info */}
      <p
        style={{
          fontSize: "0.75rem",
          color: "#666",
          marginBottom: 16,
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          textAlign: "center",
        }}
      >
        {gridSize}x{gridSize} = {gridSize * gridSize} pixels
        {loading && " — Claude is painting the canvas..."}
      </p>

      {/* Error */}
      {error && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#FF3B6F",
            marginBottom: 16,
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          {error}
        </p>
      )}

      {/* Canvas */}
      {grid && (
        <div
          style={{
            width: "100%",
            maxWidth: 700,
            aspectRatio: "1",
            padding: 10,
            background: "linear-gradient(145deg, #2a2233, #1e1a28, #2a2233)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 30px 8px rgba(59, 219, 255, 0.08)",
          }}
        >
          <div
            style={{
              padding: 3,
              background: "#14141f",
              borderRadius: 6,
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gap,
                width: "100%",
                height: "100%",
              }}
            >
              {grid.flat().map((colorIdx, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: COLOR_HEX[colorIdx] ?? "#888",
                    borderRadius: gridSize <= 20 ? 2 : 1,
                    aspectRatio: "1",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!grid && !loading && (
        <div
          style={{
            width: "100%",
            maxWidth: 700,
            aspectRatio: "1",
            padding: 10,
            background: "linear-gradient(145deg, #2a2233, #1e1a28, #2a2233)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              color: "#555",
              fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            Select a size and click &quot;Paint with AI&quot; to generate a canvas
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{
            width: "100%",
            maxWidth: 700,
            aspectRatio: "1",
            padding: 10,
            background: "linear-gradient(145deg, #2a2233, #1e1a28, #2a2233)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #2A2A3E",
                borderTopColor: "#3BDBFF",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p
              style={{
                color: "#888",
                fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                fontSize: "0.85rem",
              }}
            >
              Claude is painting...
            </p>
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Color legend */}
      {grid && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 16,
            justifyContent: "center",
            maxWidth: 700,
          }}
        >
          {COLOR_NAMES.map((name, i) => {
            // Count how many pixels use this color
            const count = grid.flat().filter((c) => c === i).length;
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.65rem",
                  color: count > 0 ? "#aaa" : "#555",
                  fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: COLOR_HEX[i],
                    opacity: count > 0 ? 1 : 0.3,
                  }}
                />
                {name}
                {count > 0 && (
                  <span style={{ color: "#666" }}>({count})</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
