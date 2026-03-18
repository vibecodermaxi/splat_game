"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ResolutionAnimationProps {
  pixelIndex: number;
  winningColorHex: string;
  onComplete: () => void;
}

/**
 * Overlay that animates a radial burst color flood when a pixel resolves.
 *
 * Positioned absolutely over the resolved pixel cell in the canvas grid.
 * Uses Motion:
 *   - Radial burst: clipPath circle(0%) → circle(150%) over 200ms easeOut
 *   - Glow: boxShadow pulse from 0 → 12px → 0 over 500ms
 *
 * Respects prefers-reduced-motion: instant fill, no transforms.
 */
export function ResolutionAnimation({
  winningColorHex,
  onComplete,
}: ResolutionAnimationProps) {
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const calledRef = useRef(false);

  useEffect(() => {
    // After total animation duration (200ms burst + 500ms glow = 700ms), call onComplete
    const timer = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onComplete();
      }
    }, reducedMotion ? 50 : 750);
    return () => clearTimeout(timer);
  }, [onComplete, reducedMotion]);

  if (reducedMotion) {
    // Instant fill — no transform
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: winningColorHex,
          borderRadius: "4px",
          zIndex: 10,
        }}
      />
    );
  }

  return (
    <AnimatePresence>
      {/* Radial burst flood */}
      <motion.div
        initial={{ clipPath: "circle(0% at 50% 50%)" }}
        animate={{ clipPath: "circle(150% at 50% 50%)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: winningColorHex,
          borderRadius: "4px",
          zIndex: 10,
        }}
      />
      {/* Glow pulse */}
      <motion.div
        initial={{ boxShadow: `0 0 0 0 ${winningColorHex}80` }}
        animate={{
          boxShadow: [
            `0 0 0 0 ${winningColorHex}80`,
            `0 0 12px 4px ${winningColorHex}80`,
            `0 0 0 0 ${winningColorHex}80`,
          ],
        }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "4px",
          zIndex: 11,
          pointerEvents: "none",
        }}
      />
    </AnimatePresence>
  );
}
