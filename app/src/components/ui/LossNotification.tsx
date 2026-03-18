"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LossNotificationProps {
  winningColorName: string;
  onDismiss: () => void;
}

/**
 * Loss notification: minimal fade-in/hold/fade-out below betting panel.
 *
 * - Small muted text "It was {color}. Next one?"
 * - Fade in 300ms, hold 2s, fade out 300ms (total 2.6s)
 * - Auto-dismisses after 2.6s
 * - No confetti, no drama — losses feel light per brand identity
 * - Respects prefers-reduced-motion: instant show
 */
export function LossNotification({
  winningColorName,
  onDismiss,
}: LossNotificationProps) {
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // Auto-dismiss after 2.6s (300ms in + 2000ms hold + 300ms out)
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2600);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (reducedMotion) {
    return (
      <p
        style={{

          fontSize: "0.875rem",
          color: "#999",
          textAlign: "center",
          padding: "8px 0",
        }}
      >
        Splat. It was {winningColorName}. Next one?
      </p>
    );
  }

  return (
    <AnimatePresence>
      <motion.p
        key="loss-notification"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{

          fontSize: "0.875rem",
          color: "#999",
          textAlign: "center",
          padding: "8px 0",
        }}
      >
        Splat. It was {winningColorName}. Next one?
      </motion.p>
    </AnimatePresence>
  );
}
