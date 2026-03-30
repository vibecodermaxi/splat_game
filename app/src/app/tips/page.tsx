"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BASE_HEX, COLOR_NAMES } from "@/lib/color";

const COLOR_HEX = COLOR_NAMES.map((name) => BASE_HEX[name] ?? "#888");

// Deterministic seeded PRNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate an artistic 20x20 grid using cluster seeding + diffusion + smoothing.
 * Mimics what a full Claude-painted season would look like.
 */
function generateSampleGrid(): number[][] {
  const size = 20;
  const rand = mulberry32(2026);
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));

  // Place anchor points with artistic color groupings
  const anchors = [
    // Cool region (top-left)
    { x: 2, y: 2, color: 7 },   // Blue
    { x: 5, y: 1, color: 6 },   // Cyan
    { x: 1, y: 5, color: 8 },   // Indigo
    // Warm region (bottom-right)
    { x: 17, y: 17, color: 0 },  // Red
    { x: 15, y: 18, color: 1 },  // Orange
    { x: 18, y: 15, color: 2 },  // Yellow
    // Green band (middle)
    { x: 10, y: 8, color: 4 },   // Green
    { x: 8, y: 10, color: 3 },   // Lime
    { x: 12, y: 10, color: 5 },  // Teal
    // Purple accent (top-right)
    { x: 16, y: 3, color: 9 },   // Purple
    { x: 18, y: 5, color: 10 },  // Pink
    { x: 14, y: 2, color: 8 },   // Indigo
    // Dark anchor (center)
    { x: 10, y: 10, color: 14 }, // Black
    // Warm accent (bottom-left)
    { x: 3, y: 16, color: 11 },  // Magenta
    { x: 5, y: 18, color: 10 },  // Pink
    // Neutral zones
    { x: 7, y: 4, color: 13 },   // Gray
    { x: 15, y: 12, color: 12 }, // Brown
    { x: 0, y: 10, color: 15 },  // White
  ];

  // Voronoi assignment with noise
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let minDist = Infinity;
      let bestColor = 7;
      for (const a of anchors) {
        const dx = x - a.x;
        const dy = y - a.y;
        const dist = dx * dx + dy * dy + rand() * 15;
        if (dist < minDist) {
          minDist = dist;
          bestColor = a.color;
        }
      }
      grid[y][x] = bestColor;
    }
  }

  // Texture mutations (4%)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rand() < 0.04) {
        grid[y][x] = (grid[y][x] + Math.floor(rand() * 3) + 1) % 16;
      }
    }
  }

  // Neighbor smoothing
  const copy = grid.map((row) => [...row]);
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const neighbors = [copy[y - 1][x], copy[y + 1][x], copy[y][x - 1], copy[y][x + 1]];
      const counts: Record<number, number> = {};
      for (const c of neighbors) counts[c] = (counts[c] || 0) + 1;
      for (const [color, count] of Object.entries(counts)) {
        if (count >= 3) { grid[y][x] = parseInt(color, 10); break; }
      }
    }
  }

  return grid;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontFamily: "var(--font-family-display)",
          fontSize: "1.15rem",
          color: "#fff",
          marginBottom: 12,
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.85rem",
          color: "#b0b0c0",
          lineHeight: 1.75,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Tip({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#1A1A2A",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
        <span
          style={{
            fontFamily: "var(--font-family-display)",
            fontSize: "0.85rem",
            color: "#fff",
          }}
        >
          {title}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.8rem",
          color: "#999",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  );
}

export default function TipsPage() {
  const grid = useMemo(() => generateSampleGrid(), []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#14141F",
        color: "#E0E0E0",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#14141F",
          borderBottom: "0.5px solid #2A2A3E",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            maxWidth: 680,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
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
              fontSize: "1.1rem",
              color: "#FFD93B",
              margin: 0,
            }}
          >
            Tips & Strategy
          </h1>
          <div style={{ width: 48 }} />
        </div>
      </header>

      {/* Content */}
      <main
        style={{
          flex: 1,
          maxWidth: 680,
          width: "100%",
          margin: "0 auto",
          padding: "24px 16px 48px",
          boxSizing: "border-box",
        }}
      >
        {/* Intro */}
        <Section title="How the AI Thinks">
          <p style={{ margin: "0 0 12px" }}>
            Every round, Claude (the AI) sees the <strong style={{ color: "#fff" }}>entire canvas so far</strong> — every
            pixel that's been placed, its position, and its color. It also sees its own last 5 picks with reasoning.
          </p>
          <p style={{ margin: "0 0 12px" }}>
            The AI cares about <strong style={{ color: "#3BDBFF" }}>color relationships</strong> — harmony, contrast,
            tension, and rhythm. It doesn't follow a fixed plan. It responds to what's already on the canvas and
            builds patterns as it goes.
          </p>
          <p style={{ margin: 0 }}>
            Here's what the AI is told for every round:
          </p>

          {/* Prompt excerpt */}
          <div
            style={{
              background: "#1A1A2A",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "14px 16px",
              marginTop: 12,
              fontFamily: "var(--font-family-mono, 'JetBrains Mono', monospace)",
              fontSize: "0.72rem",
              color: "#a0a0b0",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              borderLeft: "3px solid #3BDBFF",
            }}
          >
{`You are an abstract artist creating a 20x20 canvas,
one pixel at a time.

You work with 16 colors: Red, Orange, Yellow, Lime,
Green, Teal, Cyan, Blue, Indigo, Purple, Pink,
Magenta, Brown, Gray, Black, White.

You care about color relationships — harmony, contrast,
tension, and rhythm. You respond to what is already
on the canvas. You do not have a predetermined plan.`}
          </div>
        </Section>

        {/* What it sees */}
        <Section title="What the AI Sees Each Round">
          <p style={{ margin: "0 0 12px" }}>
            For every pixel, the AI receives:
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "#fff" }}>Full canvas state</strong> — every resolved pixel with its coordinates and color</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "#fff" }}>Current position</strong> — the (x, y) of the pixel it needs to paint</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "#fff" }}>All 8 neighbors</strong> — what colors surround the current pixel (or if they're empty)</li>
            <li><strong style={{ color: "#fff" }}>Last 5 picks</strong> — its recent choices with reasoning, so it can build on themes</li>
          </ul>
          <p style={{ margin: 0, color: "#FFD93B" }}>
            The AI paints left-to-right, top-to-bottom — pixel (0,0) to (19,19).
          </p>
        </Section>

        {/* Sample completed canvas */}
        <Section title="What a Completed Canvas Looks Like">
          <p style={{ margin: "0 0 16px" }}>
            This is a sample 20x20 canvas showing the kind of patterns the AI creates — color clusters,
            gradients, contrast zones, and accents:
          </p>

          <div
            style={{
              padding: 10,
              background: "linear-gradient(145deg, #2a2233, #1e1a28, #2a2233)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 20px 4px rgba(59, 219, 255, 0.06)",
              marginBottom: 12,
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
                  gridTemplateColumns: "repeat(20, 1fr)",
                  gap: 2,
                  aspectRatio: "1",
                }}
              >
                {grid.flat().map((colorIdx, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: COLOR_HEX[colorIdx],
                      borderRadius: 2,
                      aspectRatio: "1",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Color legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "center",
            }}
          >
            {COLOR_NAMES.map((name, i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.6rem",
                  color: "#888",
                  fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: COLOR_HEX[i],
                  }}
                />
                {name}
              </div>
            ))}
          </div>
        </Section>

        {/* Betting strategy tips */}
        <Section title="Betting Strategy">
          <Tip emoji="🎨" title="Watch the Neighbors">
            The AI sees all 8 neighbors of the current pixel. If the pixel is surrounded by blue,
            it'll likely pick something that relates — either continuing blue, or adding contrast.
            Check the canvas before betting.
          </Tip>

          <Tip emoji="🔄" title="Patterns Repeat... Until They Don't">
            The AI builds themes over multiple pixels — you might see a warm gradient forming.
            But it can abandon themes at any time. Don't assume a streak will last forever.
          </Tip>

          <Tip emoji="📍" title="Position Matters">
            Edge and corner pixels have fewer neighbors, giving the AI more freedom.
            Center pixels are surrounded by existing colors, making them more predictable.
            Early rounds are wildcards; later rounds are more constrained.
          </Tip>

          <Tip emoji="🧠" title="Read the Reasoning">
            After each round resolves, tap the pixel on the canvas to see the AI's reasoning.
            Understanding why it chose a color helps you predict future choices.
          </Tip>

          <Tip emoji="💰" title="Check the Multipliers">
            The color grid shows live multipliers. A color with a high multiplier (e.g., 15x) means
            few people bet on it — high risk, high reward. Low multipliers mean the crowd agrees.
            Sometimes the crowd is wrong.
          </Tip>

          <Tip emoji="🏊" title="Follow or Fade the Pool">
            The fill level on each color swatch shows where the money is going. You can follow the
            crowd for a safer (lower) payout, or fade them by picking an underbet color for a
            bigger payout if you're right.
          </Tip>

          <Tip emoji="⏰" title="Bet Early, Adjust Late">
            You can add more SOL to your bet before the round locks. Place a small bet early to
            lock in your color, then add more if the odds look good as the timer counts down.
          </Tip>

          <Tip emoji="🔥" title="Streaks Are Real">
            If you've won 2+ rounds in a row, you'll see a streak badge. The AI doesn't know
            about your bets — streaks mean you're reading its patterns well. Keep going.
          </Tip>
        </Section>

        {/* The 16 colors */}
        <Section title="The 16 Colors">
          <p style={{ margin: "0 0 16px" }}>
            The AI picks from exactly these 16 colors every round. No shading or mixing — just pure color:
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {COLOR_NAMES.map((name, i) => (
              <div
                key={name}
                style={{
                  background: COLOR_HEX[i],
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#fff",
                    textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                  }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Fairness */}
        <Section title="Is It Fair?">
          <p style={{ margin: "0 0 12px" }}>
            Yes. Every round is verifiable:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: "#3BDBFF" }}>Prompt committed on-chain</strong> — a hash of the AI's full
              prompt is stored on-chain before bets open. After resolution, you can verify it matches.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: "#3BDBFF" }}>Full prompt archived on Arweave</strong> — the exact text the AI
              received is permanently stored. Anyone can re-run it to verify the output.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: "#3BDBFF" }}>Temperature 0</strong> — the AI runs with zero randomness. Same
              prompt = same answer. Every time.
            </li>
            <li>
              <strong style={{ color: "#3BDBFF" }}>VRF fallback</strong> — if the AI goes down, a verifiable random
              function picks the color. No round is ever cancelled.
            </li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
