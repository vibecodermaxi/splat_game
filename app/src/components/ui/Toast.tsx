"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}

/**
 * Generic toast notification for transaction confirmations and errors.
 *
 * - Success: Splat Green (#3BFF8A) at 15% opacity background
 * - Error: Splat Pink (#FF3B6F) at 15% opacity background
 * - Slides in from bottom-right
 * - Auto-dismisses after 3s (success) or 5s (error)
 */
export function Toast({ message, type, onDismiss }: ToastProps) {
  const duration = type === "success" ? 3000 : 5000;

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const backgroundColor =
    type === "success"
      ? "rgba(59, 255, 138, 0.15)"
      : "rgba(255, 59, 111, 0.15)";

  const borderColor =
    type === "success"
      ? "rgba(59, 255, 138, 0.4)"
      : "rgba(255, 59, 111, 0.4)";

  return (
    <AnimatePresence>
      <motion.div
        key="toast"
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={onDismiss}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "16px",
          zIndex: 9500,
          background: backgroundColor,
          border: `1px solid ${borderColor}`,
          borderRadius: "12px",
          padding: "10px 20px",
          color: "#fff",

          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: "pointer",
          maxWidth: "320px",
          backdropFilter: "blur(8px)",
        }}
        aria-live="polite"
      >
        {message}
      </motion.div>
    </AnimatePresence>
  );
}
