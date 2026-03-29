"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGameStore } from "@/store/gameStore";
import { useSeasonData } from "@/hooks/useSeasonData";
import { useBetHistory } from "@/hooks/useBetHistory";
import { useClaimWinnings } from "@/hooks/useClaimWinnings";
import { BetStatsBar } from "@/components/mybets/BetStatsBar";
import { BetHistoryList } from "@/components/mybets/BetHistoryList";
import { ClaimAllButton } from "@/components/mybets/ClaimButton";
import type { BetHistoryEntry } from "@/hooks/useBetHistory";

export default function BetsPage() {
  useSeasonData();

  const { connected } = useWallet();
  const { pixels } = useGameStore();
  const { bets, stats, loading, refresh } = useBetHistory();
  const { claimSingle, claimAll, isClaiming, claimProgress, error, clearError } =
    useClaimWinnings();

  // Refresh on mount
  useEffect(() => {
    if (connected) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Auto-clear claim errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const claimableBets: BetHistoryEntry[] = bets.filter((bet) => {
    const pixel = pixels[bet.pixelIndex];
    return pixel?.status === "resolved" && pixel.winningColor === bet.colorIndex && !bet.claimed;
  });

  const handleClaimSingle = async (bet: BetHistoryEntry) => {
    const ok = await claimSingle(bet);
    if (ok) refresh();
  };

  const handleClaimAll = async (betsToClaimAll: BetHistoryEntry[]) => {
    await claimAll(betsToClaimAll);
    refresh();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#14141F",
        color: "#E0E0E0",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#14141F",
          borderBottom: "0.5px solid #2A2A3E",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            maxWidth: 600,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
              fontSize: "0.85rem",
              color: "#3BDBFF",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            &larr; Back
          </Link>

          <h1
            style={{
              fontFamily: "var(--font-family-display)",
              fontSize: "1.1rem",
              color: "#fff",
              margin: 0,
            }}
          >
            My Bets
          </h1>

          <WalletMultiButton />
        </div>
      </header>

      {/* Content */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 600,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {!connected ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            <p
              style={{
                color: "#a0a0b0",
                fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                fontSize: "0.9rem",
                textAlign: "center",
              }}
            >
              Connect your wallet to see your bets.
            </p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
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
                }}
              >
                {error}
              </div>
            )}

            {/* Bet list */}
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 48,
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

            {/* Claim All footer */}
            {claimableBets.length > 1 && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  position: "sticky",
                  bottom: 0,
                  background: "#14141F",
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
          </>
        )}
      </main>

      {/* Wallet adapter styles */}
      <style>{`
        .wallet-adapter-button {
          min-height: 32px !important;
          border-radius: 8px !important;
          font-family: var(--font-family-display) !important;
          font-size: 0.75rem !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase !important;
          background: linear-gradient(135deg, #FF3B6F, #FF6B3B) !important;
          padding: 0 12px !important;
        }
        .wallet-adapter-button:hover {
          opacity: 0.9 !important;
        }
      `}</style>
    </div>
  );
}
