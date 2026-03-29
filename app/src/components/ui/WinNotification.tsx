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
 * Win celebration with three layers:
 *
 *   1. Full-screen green flash (100ms fade) — immediate visceral impact
 *   2. Confetti burst — two-wave, more particles than before
 *   3. Notification card — spring slide-up with bouncing payout number
 *
 * Auto-dismisses after 5 seconds.
 */
export function WinNotification({
  colorName,
  payoutSol,
  onDismiss,
}: WinNotificationProps) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const [showFlash, setShowFlash] = useState(true);
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const TICKER_DURATION = 800;

  // Full-screen flash — fade out after 100ms
  useEffect(() => {
    if (reducedMotion) {
      setShowFlash(false);
      return;
    }
    const timer = setTimeout(() => setShowFlash(false), 150);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  // Number ticker via requestAnimationFrame with spring-like ease
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
      // Ease-out cubic for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(eased * payoutSol);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    // Delay ticker start slightly so flash hits first
    const delay = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 200);

    return () => {
      clearTimeout(delay);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [payoutSol, reducedMotion]);

  // Two-wave confetti burst
  useEffect(() => {
    if (reducedMotion) return;

    const colors = ["#FF3B6F", "#3BDBFF", "#FFD93B", "#A83BFF", "#FF6B3B", "#3BFF8A"];

    // Wave 1 — immediate wide burst
    confetti({
      particleCount: 80,
      spread: 90,
      origin: { x: 0.5, y: 0.55 },
      colors,
      startVelocity: 35,
    });

    // Wave 2 — delayed focused burst
    const wave2 = setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { x: 0.3, y: 0.6 },
        colors,
        startVelocity: 25,
      });
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { x: 0.7, y: 0.6 },
        colors,
        startVelocity: 25,
      });
    }, 300);

    return () => clearTimeout(wave2);
  }, [reducedMotion]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <>
      {/* Layer 1: Full-screen green flash */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            key="win-flash"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "fixed",
              inset: 0,
              background: "radial-gradient(circle at 50% 60%, rgba(59, 255, 138, 0.4), rgba(59, 255, 138, 0.1) 60%, transparent 80%)",
              zIndex: 8999,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Layer 2: Notification card */}
      <AnimatePresence>
        <motion.div
          key="win-notification"
          initial={reducedMotion ? {} : { y: 80, opacity: 0, scale: 0.9 }}
          animate={reducedMotion ? {} : { y: 0, opacity: 1, scale: 1 }}
          exit={reducedMotion ? {} : { y: 80, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          style={{
            position: "fixed",
            bottom: "24px",
            left: 0,
            right: 0,
            marginInline: "auto",
            zIndex: 9000,
            width: "min(calc(100vw - 48px), 440px)",
            background: "rgba(59, 255, 138, 0.12)",
            border: "1px solid rgba(59, 255, 138, 0.35)",
            borderRadius: "16px",
            padding: "20px 16px",
            textAlign: "center",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 40px 8px rgba(59, 255, 138, 0.15)",
          }}
        >
          {/* Heading */}
          <motion.p
            initial={reducedMotion ? {} : { y: 10, opacity: 0 }}
            animate={reducedMotion ? {} : { y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            style={{
              fontFamily: "var(--font-family-display)",
              fontSize: "1.4rem",
              color: "#fff",
              marginBottom: "8px",
              letterSpacing: "0.02em",
            }}
          >
            SPLAT! You nailed it.
          </motion.p>

          {/* Payout — bounces in */}
          <motion.p
            initial={reducedMotion ? {} : { scale: 0.3, opacity: 0 }}
            animate={reducedMotion ? {} : { scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 12,
              delay: 0.35,
            }}
            style={{
              fontWeight: 700,
              fontSize: "2rem",
              color: "#3BFF8A",
              lineHeight: 1.2,
              filter: "drop-shadow(0 0 12px rgba(59, 255, 138, 0.5))",
            }}
          >
            +{displayAmount.toFixed(4)} SOL
          </motion.p>

          {/* Color name */}
          <motion.p
            initial={reducedMotion ? {} : { opacity: 0 }}
            animate={reducedMotion ? {} : { opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.6)",
              marginTop: "6px",
            }}
          >
            You called {colorName}
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
