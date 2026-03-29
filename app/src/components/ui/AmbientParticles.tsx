"use client";

import { useMemo } from "react";

const PARTICLE_COUNT = 24;
const BRAND_COLORS = [
  "#ff3b6f",
  "#ff6b3b",
  "#ffd93b",
  "#3bff8a",
  "#3bdbff",
  "#a83bff",
];

interface Particle {
  id: number;
  size: number;
  color: string;
  left: string;
  delay: string;
  duration: string;
  startY: string;
}

/**
 * Ambient floating paint dots that drift slowly upward across the background.
 * Pure CSS animations — no JS runtime cost.
 * Fixed position, pointer-events: none, sits behind all content.
 */
export function AmbientParticles() {
  const particles = useMemo<Particle[]>(() => {
    // Seed a deterministic-ish set so SSR and client match
    const items: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = (i * 7919 + 13) % 1000; // simple hash for variety
      items.push({
        id: i,
        size: 3 + (seed % 5),           // 3-7px
        color: BRAND_COLORS[i % BRAND_COLORS.length],
        left: `${(seed / 10) % 100}%`,
        delay: `${(i * 1.7) % 12}s`,
        duration: `${18 + (seed % 14)}s`, // 18-31s
        startY: `${100 + (seed % 20)}%`,  // start below viewport
      });
    }
    return items;
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {particles.map((p) => (
          <span
            key={p.id}
            className="ambient-particle"
            style={{
              position: "absolute",
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: p.color,
              opacity: 0.12,
              left: p.left,
              bottom: "-10px",
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes particleFloat {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.12;
          }
          90% {
            opacity: 0.12;
          }
          100% {
            transform: translateY(-110vh) translateX(30px);
            opacity: 0;
          }
        }

        .ambient-particle {
          animation-name: particleFloat;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .ambient-particle {
            animation: none !important;
            opacity: 0.06 !important;
          }
        }
      `}</style>
    </>
  );
}
