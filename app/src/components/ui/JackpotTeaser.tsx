"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * JackpotTeaser — floating bubble in the bottom-right corner (large screens only).
 * Clicking shows a "Jackpot coming soon!" popup tooltip.
 */
export function JackpotTeaser() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="jackpot-bubble-wrapper">
      {/* Floating bubble */}
      <motion.button
        type="button"
        onClick={() => setShowTooltip((v) => !v)}
        aria-label="Jackpot feature coming soon"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 200,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "1px solid rgba(255, 215, 0, 0.3)",
          background: "linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.1))",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.1)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          minHeight: "auto",
        }}
      >
        <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>💰</span>
      </motion.button>

      {/* Tooltip popup */}
      <AnimatePresence>
        {showTooltip && (
          <>
            {/* Click-away dismiss */}
            <div
              onClick={() => setShowTooltip(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 199,
              }}
            />
            <motion.div
              key="jackpot-tooltip"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "fixed",
                bottom: 88,
                right: 24,
                zIndex: 201,
                background: "#1E1E2E",
                border: "1px solid rgba(255, 215, 0, 0.25)",
                borderRadius: 12,
                padding: "12px 16px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                whiteSpace: "nowrap",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-family-display)",
                  fontSize: "0.9rem",
                  color: "#FFD700",
                  letterSpacing: "0.02em",
                }}
              >
                💰 Jackpot coming soon!
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                  fontSize: "0.7rem",
                  color: "#a0a0b0",
                }}
              >
                2% of every pot goes to the jackpot pool.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
