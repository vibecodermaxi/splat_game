"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ResolutionAnimationProps {
  pixelIndex: number;
  winningColorHex: string;
  onComplete: () => void;
}

/**
 * Overlay that animates a "splat" burst when a pixel resolves.
 *
 * Layers:
 *   1. Color flood — radial clip-path expansion with scale overshoot
 *   2. Flash ring — bright white ring that expands and fades
 *   3. Glow pulse — colored box-shadow that flares and settles
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
    const timer = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onComplete();
      }
    }, reducedMotion ? 50 : 900);
    return () => clearTimeout(timer);
  }, [onComplete, reducedMotion]);

  if (reducedMotion) {
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
      {/* Layer 1: Color flood with scale overshoot */}
      <motion.div
        initial={{ clipPath: "circle(0% at 50% 50%)", scale: 0.5 }}
        animate={{ clipPath: "circle(150% at 50% 50%)", scale: 1 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: winningColorHex,
          borderRadius: "4px",
          zIndex: 10,
        }}
      />

      {/* Layer 2: Flash ring — white ring that expands outward and fades */}
      <motion.div
        initial={{ opacity: 0.9, scale: 0.3 }}
        animate={{ opacity: 0, scale: 2.5 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
        style={{
          position: "absolute",
          inset: "-50%",
          borderRadius: "50%",
          border: "3px solid rgba(255, 255, 255, 0.8)",
          zIndex: 12,
          pointerEvents: "none",
        }}
      />

      {/* Layer 3: Glow pulse — colored shadow flare */}
      <motion.div
        initial={{ boxShadow: `0 0 0 0 ${winningColorHex}00` }}
        animate={{
          boxShadow: [
            `0 0 0 0 ${winningColorHex}00`,
            `0 0 20px 8px ${winningColorHex}AA`,
            `0 0 4px 1px ${winningColorHex}40`,
          ],
        }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
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
