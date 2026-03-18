"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "@/store/gameStore";
import { useBetHistory } from "@/hooks/useBetHistory";
import { useClaimWinnings } from "@/hooks/useClaimWinnings";
import { BetStatsBar } from "@/components/mybets/BetStatsBar";
import { BetHistoryList } from "@/components/mybets/BetHistoryList";
import { ClaimAllButton } from "@/components/mybets/ClaimButton";
import type { BetHistoryEntry } from "@/hooks/useBetHistory";

interface MyBetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Slide-up bottom drawer for the player's bet history and claim functionality.
 *
 * Structure:
 * - Backdrop: fixed full-screen overlay that closes on click
 * - Drawer container: fixed bottom, 85vh, spring slide-up animation
 * - Drag handle: ONLY the pill handle has drag="y" — prevents scroll-drag conflict (Pitfall 4)
 * - Stats bar: always visible at top of drawer
 * - Bet list: scrollable, flex: 1
 * - Claim All footer: sticky at bottom when multiple claimable bets exist
 *
 * Fetch is triggered on mount via useBetHistory().
 */
export function MyBetsDrawer({ isOpen, onClose }: MyBetsDrawerProps) {
  const { pixels } = useGameStore();
  const { bets, stats, loading, refresh } = useBetHistory();
  const { claimSingle, claimAll, isClaiming, claimProgress, error, clearError } =
    useClaimWinnings();

  // Refresh bet history when drawer opens
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filter bets that are claimable (won, not yet claimed)
  const claimableBets: BetHistoryEntry[] = bets.filter((bet) => {
    const pixel = pixels[bet.pixelIndex];
    return pixel?.status === "resolved" && pixel.winningColor === bet.colorIndex && !bet.claimed;
  });

  const handleClaimSingle = async (bet: BetHistoryEntry) => {
    const success = await claimSingle(bet);
    if (success) {
      refresh();
    }
  };

  const handleClaimAll = async (betsToClaimAll: BetHistoryEntry[]) => {
    await claimAll(betsToClaimAll);
    refresh();
  };

  // Clear claim error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mybets-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 400,
            }}
          />

          {/* Drawer */}
          <motion.div
            key="mybets-drawer"
            role="dialog"
            aria-label="My Bets"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: "85vh",
              background: "#1E1E2E",
              borderRadius: "16px 16px 0 0",
              zIndex: 500,
              display: "flex",
              flexDirection: "column",
              willChange: "transform",
            }}
          >
            {/* Drag handle — ONLY this div has drag applied to prevent scroll-drag conflict */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150 || info.velocity.y > 400) {
                  onClose();
                }
              }}
              style={{
                padding: "12px 16px 8px",
                cursor: "grab",
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              {/* Pill indicator */}
              <div
                style={{
                  width: "40px",
                  height: "4px",
                  borderRadius: "2px",
                  background: "#444",
                  margin: "0 auto",
                }}
              />
            </motion.div>

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 16px 8px",
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-family-display)",
                  fontSize: "1.1rem",
                  color: "#fff",
                  margin: 0,
                }}
              >
                My Bets
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close My Bets drawer"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a0a0b0",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  padding: "4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Stats bar — always visible */}
            <BetStatsBar stats={stats} loading={loading} />

            {/* Error banner */}
            {error && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "rgba(255, 59, 111, 0.12)",
                  borderBottom: "1px solid rgba(255, 59, 111, 0.3)",
                  color: "#FF3B6F",
                  fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                  fontSize: "0.8rem",
                  flexShrink: 0,
                }}
              >
                {error}
              </div>
            )}

            {/* Bet list — scrollable, NO drag applied here */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#a0a0b0",
                    fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                    fontSize: "0.875rem",
                  }}
                >
                  Loading bets...
                </div>
              ) : (
                <BetHistoryList
                  bets={bets}
                  pixels={pixels}
                  onClaim={handleClaimSingle}
                  isClaiming={isClaiming}
                />
              )}
            </div>

            {/* Claim All footer — only shown when multiple claimable bets exist */}
            {claimableBets.length > 1 && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }}
              >
                <ClaimAllButton
                  claimableBets={claimableBets}
                  onClaimAll={handleClaimAll}
                  isClaiming={isClaiming}
                  claimProgress={claimProgress}
                />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
