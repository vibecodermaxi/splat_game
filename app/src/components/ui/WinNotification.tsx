"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

interface WinNotificationProps {
  colorName: string;
  payoutSol: number;
  onDismiss: () => void;
}

/**
 * Win notification: slides in from bottom with confetti burst and SOL payout ticker.
 *
 * - Splat Green (#3BFF8A) at 15% opacity background
 * - Number ticker counts from 0 to payoutSol over 600ms via rAF
 * - Confetti burst on mount from canvas-confetti
 * - Auto-dismisses after 4 seconds
 * - Respects prefers-reduced-motion: no slide animation
 */
export function WinNotification({
  colorName,
  payoutSol,
  onDismiss,
}: WinNotificationProps) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const TICKER_DURATION = 600; // ms

  // Number ticker via requestAnimationFrame
  useEffect(() => {
    if (reducedMotion) {
      setDisplayAmount(payoutSol);
      return;
    }

    startTimeRef.current = null;

    const tick = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / TICKER_DURATION, 1);
      // Ease-out: 1 - (1-t)^2
      const eased = 1 - Math.pow(1 - progress, 2);
      setDisplayAmount(eased * payoutSol);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [payoutSol, reducedMotion]);

  // Confetti burst on mount
  useEffect(() => {
    if (reducedMotion) return;

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.5, y: 0.6 },
      colors: ["#FF3B6F", "#3BDBFF", "#FFD93B", "#A83BFF", "#FF6B3B", "#3BFF8A"],
    });
  }, [reducedMotion]);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const motionProps = reducedMotion
    ? {}
    : {
        initial: { y: "100%", opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: "100%", opacity: 0 },
        transition: { type: "spring" as const, stiffness: 300, damping: 30 },
      };

  return (
    <AnimatePresence>
      <motion.div
        key="win-notification"
        {...motionProps}
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9000,
          width: "min(calc(100vw - 48px), 440px)",
          background: "rgba(59, 255, 138, 0.15)",
          border: "1px solid rgba(59, 255, 138, 0.4)",
          borderRadius: "12px",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-family-display)",
            fontSize: "1.2rem",
            color: "#fff",
            marginBottom: "8px",
            letterSpacing: "0.02em",
          }}
        >
          SPLAT! You nailed it.
        </p>
        <p
          style={{

            fontWeight: 700,
            fontSize: "1.5rem",
            color: "#3BFF8A",
          }}
        >
          +{displayAmount.toFixed(4)} SOL
        </p>
        <p
          style={{

            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.6)",
            marginTop: "4px",
          }}
        >
          You called {colorName}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
