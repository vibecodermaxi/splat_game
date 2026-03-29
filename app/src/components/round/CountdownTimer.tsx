"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCountdown } from "@/hooks/useCountdown";
import { useGameStore } from "@/store/gameStore";

/**
 * Countdown timer component with visual lockout state and final drama animations.
 *
 * States:
 * - Normal: cyan timer text counting down
 * - Locked (!isFinalDrama): yellow timer text, pulsing "LOCKED" badge
 * - Final drama (<=10s): large pulsing/shaking numbers, edge glow overlay
 * - At zero: "The AI is thinking..." pulsing in yellow
 */
export function CountdownTimer() {
  const shouldReduceMotion = useReducedMotion();

  const { currentPixelIndex, pixels } = useGameStore();
  const activePixelData = pixels[currentPixelIndex] ?? null;
  const openedAtSeconds = activePixelData?.openedAtSeconds ?? null;

  const { secondsLeft, isLocked, isFinalDrama, roundNotOpen, minutesDisplay, secondsDisplay } =
    useCountdown(openedAtSeconds);

  const prevSecondsRef = useRef(secondsLeft);
  useEffect(() => {
    prevSecondsRef.current = secondsLeft;
  });

  const isThinking = secondsLeft === 0 && openedAtSeconds !== null;

  // Color scheme based on state
  const timerColor = isFinalDrama
    ? "#FF3B6F" // Splat Pink — urgent
    : isLocked
    ? "#FFD93B" // Splat Yellow — warning
    : "#3BDBFF"; // Splat Cyan — normal

  // Round not yet opened by oracle — PixelState PDA doesn't exist on-chain
  if (roundNotOpen) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            color: "#3BDBFF",
            fontWeight: 700,
            fontSize: "1rem",
          }}
        >
          Waiting for next round...
        </motion.span>
      </div>
    );
  }

  if (isThinking) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            color: "#FFD93B",

            fontWeight: 700,
            fontSize: "1rem",
          }}
        >
          The AI is thinking...
        </motion.span>
      </div>
    );
  }

  if (isFinalDrama && !shouldReduceMotion) {
    const isLastThree = secondsLeft <= 3;

    return (
      <div style={{ position: "relative", textAlign: "center", padding: "8px 0" }}>
        {/* Edge glow overlay */}
        <div
          style={{
            position: "absolute",
            inset: "-16px -20px",
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(255, 59, 111, 0.05) 100%)",
            pointerEvents: "none",
            borderRadius: "inherit",
          }}
          aria-hidden="true"
        />

        <motion.div
          key={secondsLeft}
          animate={
            isLastThree
              ? { x: [-1, 1, -1, 0], scale: [1, 1.15, 1] }
              : { scale: [1, 1.15, 1] }
          }
          transition={{ duration: isLastThree ? 0.1 : 0.3, ease: "easeInOut" }}
          style={{ display: "inline-block" }}
        >
          <span
            style={{
              color: timerColor,
  
              fontWeight: 700,
              fontSize: "2rem",
              lineHeight: 1,
            }}
          >
            {minutesDisplay}:{secondsDisplay}
          </span>
        </motion.div>
      </div>
    );
  }

  // Phase label shown below the timer
  const phaseLabel = isLocked
    ? "Betting closed \u00B7 AI picks soon"
    : "until betting closes";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            color: timerColor,
            fontWeight: 700,
            fontSize: "1.5rem",
            lineHeight: 1,
            transition: "color 0.3s ease-out",
          }}
        >
          {minutesDisplay}:{secondsDisplay}
        </span>

        {isLocked && !isFinalDrama && (
          <motion.span
            animate={
              shouldReduceMotion ? {} : { opacity: [1, 0.5, 1] }
            }
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: "#FFD93B",
              color: "#1E1E2E",
              fontWeight: 700,
              fontSize: "0.7rem",
              padding: "2px 8px",
              borderRadius: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            LOCKED
          </motion.span>
        )}
      </div>
      <span
        style={{
          color: isLocked ? "#FFD93B" : "#666",
          fontSize: "0.65rem",
          fontWeight: 600,
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          letterSpacing: "0.02em",
        }}
      >
        {phaseLabel}
      </span>
    </div>
  );
}
