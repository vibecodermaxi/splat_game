"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "splat_welcome_dismissed";

interface WelcomeCardProps {
  /** When true, force the card open (e.g. from ? button). */
  forceOpen?: boolean;
  /** Called when the card is dismissed via forced open. */
  onClose?: () => void;
}

/**
 * First-visit welcome card explaining the game.
 * Shows once per browser — dismissal persisted in localStorage.
 * Can also be force-opened via the `forceOpen` prop (? button).
 */
export function WelcomeCard({ forceOpen, onClose }: WelcomeCardProps) {
  const [firstVisitOpen, setFirstVisitOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setFirstVisitOpen(true);
      }
    } catch {
      setFirstVisitOpen(true);
    }
  }, []);

  const visible = firstVisitOpen || forceOpen;

  const dismiss = () => {
    setFirstVisitOpen(false);
    onClose?.();
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismiss}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.7)",
              zIndex: 9000,
            }}
          />

          {/* Card */}
          <motion.div
            key="welcome-card"
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              position: "fixed",
              top: 80,
              left: 0,
              right: 0,
              marginInline: "auto",
              zIndex: 9001,
              width: "min(calc(100vw - 40px), 400px)",
              background: "linear-gradient(170deg, #1E1E2E 0%, #1a1a28 100%)",
              borderRadius: 18,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(59, 219, 255, 0.08)",
              overflow: "hidden",
            }}
          >
            {/* Image slot */}
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                background: "linear-gradient(135deg, #ff3b6f22, #3bdbff22, #ffd93b22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Placeholder grid art — miniature pixel canvas */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 3,
                  width: 100,
                  height: 100,
                }}
              >
                {["#E53E3E", "#4299E1", "#ECC94B", "#38A169", "#9F7AEA",
                  "#ED8936", "#4FD1C5", "#ED64A6", "#5C6BC0", "#68D391",
                  "#F7FAFC", "#D53F8C", "#2D3748", "#A0AEC0", "#38B2AC",
                  "#8B6C5C", "#E53E3E", "#4299E1", "#ECC94B", "#38A169",
                  "#ED64A6", "#9F7AEA", "#ED8936", "#4FD1C5", "#5C6BC0",
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 3,
                      backgroundColor: c,
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>

              {/* Splat text overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  fontFamily: "var(--font-family-display)",
                  fontSize: "1.6rem",
                  letterSpacing: "0.06em",
                  color: "#fff",
                  textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                SPLAT
              </div>
            </div>

            {/* Text content */}
            <div style={{ padding: "20px 20px 24px" }}>
              <h2
                style={{
                  fontFamily: "var(--font-family-display)",
                  fontSize: "1.15rem",
                  color: "#fff",
                  margin: "0 0 12px",
                  letterSpacing: "0.02em",
                }}
              >
                Bet the Canvas
              </h2>

              <div
                style={{
                  fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                  fontSize: "0.82rem",
                  color: "#b0b0c0",
                  lineHeight: 1.7,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <p style={{ margin: 0 }}>
                  An AI is painting a 20x20 canvas, one pixel at a time. Each round, it picks a color from 16 options.
                </p>
                <p style={{ margin: 0 }}>
                  <span style={{ color: "#3BDBFF", fontWeight: 700 }}>Your job:</span> predict which color the AI will choose. Place your bet before the timer runs out. If you're right, you split the pot with other winners.
                </p>
                <p style={{ margin: 0 }}>
                  <span style={{ color: "#3BFF8A", fontWeight: 700 }}>Won a round?</span> Claim your winnings from the <span style={{ color: "#fff", fontWeight: 600 }}>My Bets</span> section below the betting panel.
                </p>
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={dismiss}
                style={{
                  width: "100%",
                  marginTop: 20,
                  minHeight: 48,
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #FF3B6F, #FF6B3B)",
                  color: "#fff",
                  fontFamily: "var(--font-family-display)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Let's Go!
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
