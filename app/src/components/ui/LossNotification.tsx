"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LossNotificationProps {
  winningColorName: string;
  onDismiss: () => void;
}

/**
 * Loss notification — fixed bottom card with sad face and subtle animations.
 *
 * - Full-screen brief red flash (100ms)
 * - Card slides up with spring
 * - Sad face wobbles side to side
 * - Auto-dismisses after 4 seconds
 * - Respects prefers-reduced-motion
 */
export function LossNotification({
  winningColorName,
  onDismiss,
}: LossNotificationProps) {
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <>
      {/* Brief red flash */}
      {!reducedMotion && (
        <motion.div
          key="loss-flash"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            position: "fixed",
            inset: 0,
            background: "radial-gradient(circle at 50% 60%, rgba(255, 59, 111, 0.25), transparent 70%)",
            zIndex: 8999,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Notification card */}
      <AnimatePresence>
        <motion.div
          key="loss-notification"
          initial={reducedMotion ? {} : { y: 80, opacity: 0, scale: 0.9 }}
          animate={reducedMotion ? {} : { y: 0, opacity: 1, scale: 1 }}
          exit={reducedMotion ? {} : { y: 80, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
          style={{
            position: "fixed",
            bottom: "24px",
            left: 0,
            right: 0,
            marginInline: "auto",
            zIndex: 9000,
            width: "min(calc(100vw - 48px), 440px)",
            background: "rgba(255, 59, 111, 0.1)",
            border: "1px solid rgba(255, 59, 111, 0.25)",
            borderRadius: "16px",
            padding: "20px 16px",
            textAlign: "center",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 30px 4px rgba(255, 59, 111, 0.1)",
          }}
        >
          {/* Sad face — wobbles */}
          <motion.div
            animate={
              reducedMotion
                ? {}
                : {
                    rotate: [0, -8, 8, -5, 5, 0],
                    y: [0, 2, -2, 1, 0],
                  }
            }
            transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
            style={{
              fontSize: "2.2rem",
              lineHeight: 1,
              marginBottom: "8px",
            }}
          >
            😔
          </motion.div>

          {/* Heading */}
          <motion.p
            initial={reducedMotion ? {} : { y: 8, opacity: 0 }}
            animate={reducedMotion ? {} : { y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            style={{
              fontFamily: "var(--font-family-display)",
              fontSize: "1.2rem",
              color: "#fff",
              marginBottom: "4px",
              letterSpacing: "0.02em",
            }}
          >
            Not this time.
          </motion.p>

          {/* What won */}
          <motion.p
            initial={reducedMotion ? {} : { opacity: 0 }}
            animate={reducedMotion ? {} : { opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.5)",
              marginTop: "2px",
            }}
          >
            It was {winningColorName}. Next one?
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
