"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { BettingPanel } from "@/components/betting/BettingPanel";
import { RoundInfo } from "@/components/round/RoundInfo";
import { WinNotification } from "@/components/ui/WinNotification";
import { LossNotification } from "@/components/ui/LossNotification";
import { MyBetsSummary } from "@/components/mybets/MyBetsSummary";
import { SeasonCompleteOverlay } from "@/components/season/SeasonCompleteOverlay";
import { IntermissionScreen } from "@/components/season/IntermissionScreen";
import { WalletDisconnectBanner } from "@/components/ui/WalletDisconnectBanner";
import { JackpotTeaser } from "@/components/ui/JackpotTeaser";
import { WelcomeCard } from "@/components/ui/WelcomeCard";
import { AmbientParticles } from "@/components/ui/AmbientParticles";
import { useSeasonData } from "@/hooks/useSeasonData";
import { useResolution } from "@/hooks/useResolution";
import { useSeasonCompletion } from "@/hooks/useSeasonCompletion";
import { useCountdown } from "@/hooks/useCountdown";
import { useBetHistory } from "@/hooks/useBetHistory";
import { useGameStore } from "@/store/gameStore";
import { PROGRAM_ID } from "@/lib/constants";
import { deriveSeasonPDA, derivePixelPDA } from "@/lib/pda";
import { useHeliusSocket } from "@/hooks/useHeliusSocket";

export default function Home() {
  // Load initial state from on-chain
  useSeasonData();

  // Resolution detection hook
  const { resolution, clearResolution } = useResolution();

  // Derive PDAs for Helius socket
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const currentPixelIndex = useGameStore((s) => s.currentPixelIndex);
  const pixels = useGameStore((s) => s.pixels);

  const [seasonPDA] = deriveSeasonPDA(PROGRAM_ID, seasonNumber || 1);
  const [pixelPDA] = derivePixelPDA(
    PROGRAM_ID,
    seasonNumber || 1,
    currentPixelIndex,
  );

  // TODO: Re-enable after fixing PDA reference stability and browser decode
  // useHeliusSocket({ pixelPDA, seasonPDA, seasonNumber: seasonNumber || 1 });

  // Season completion state
  const { state: seasonCompletionState } = useSeasonCompletion(
    seasonNumber || 1,
  );
  const { seasonStatus, intermissionEndsSeconds } = seasonCompletionState;
  const [showSeasonComplete, setShowSeasonComplete] = useState(false);

  // Bet history stats for IntermissionScreen
  const { stats } = useBetHistory();

  // Wallet connection for conditional header buttons
  const { connected } = useWallet();

  // Help modal state (? button)
  const [helpOpen, setHelpOpen] = useState(false);

  // Timer urgency — drive background tint from countdown progress
  const activePixelData = pixels[currentPixelIndex] ?? null;
  const openedAtSeconds = activePixelData?.openedAtSeconds ?? null;
  const { secondsLeft } = useCountdown(openedAtSeconds);

  const urgencyBg = (() => {
    if (openedAtSeconds === null || secondsLeft <= 0) return "#14141F";
    if (secondsLeft <= 10) {
      // Final drama: strong warm pulse
      return "#1F1418";
    }
    if (secondsLeft <= 30) {
      // Last 30s: noticeable warm vignette
      return "#1A1419";
    }
    if (secondsLeft <= 120) {
      // Last 2 min: subtle shift toward warm
      const t = (120 - secondsLeft) / 90; // 0→1 over 120→30s
      // Interpolate from #14141F to #17141C
      const r = Math.round(0x14 + t * 3);
      const g = 0x14;
      const b = Math.round(0x1f - t * 3);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    return "#14141F";
  })();

  // Show SeasonCompleteOverlay when season transitions to "completed"
  useEffect(() => {
    if (seasonStatus === "completed") {
      setShowSeasonComplete(true);
    }
  }, [seasonStatus]);


  // If intermission, show IntermissionScreen instead of game
  if (seasonStatus === "intermission" && intermissionEndsSeconds) {
    return (
      <IntermissionScreen
        seasonNumber={seasonCompletionState.seasonNumber}
        pixels={pixels}
        intermissionEndsSeconds={intermissionEndsSeconds}
        playerStats={
          stats
            ? {
                totalBets: stats.totalBets,
                correctPredictions: stats.correctPredictions,
                hitRate: stats.hitRate,
              }
            : null
        }
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: urgencyBg,
        color: "#E0E0E0",
        transition: "background 1.5s ease",
      }}
    >
      {/* Ambient background particles */}
      <AmbientParticles />

      {/* Vignette overlay — darkened edges in final 30s */}
      {secondsLeft > 0 && secondsLeft <= 30 && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            background: `radial-gradient(ellipse at center, transparent 40%, rgba(255, 59, 111, ${secondsLeft <= 10 ? 0.08 : 0.04}) 100%)`,
            transition: "background 1s ease",
          }}
        />
      )}

      {/* ======================== HEADER ======================== */}
      <header
        id="splat-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#14141F",
          borderBottom: "0.5px solid #2A2A3E",
        }}
      >
        {/* Mobile (< 640px): logo + wallet in row, RoundInfo below as full-width bar */}
        {/* Tablet+ (640px+): single row with logo left, RoundInfo center, wallet right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            gap: 8,
          }}
        >
          {/* Logo */}
          <h1
            className="splat-logo"
            style={{
              fontFamily: "var(--font-family-display)",
              fontSize: "1.75rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              lineHeight: 1,
              margin: 0,
              flexShrink: 0,
            }}
          >
            SPLAT
          </h1>

          {/* Center: RoundInfo (hidden on narrow mobile, shown on tablet+) */}
          <div
            className="header-round-info"
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#a0a0b0",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              <RoundInfo />
            </div>
          </div>

          {/* Right side: Bets + ? + Jackpot + Wallet */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {/* Bets link — only when wallet connected */}
            {connected && (
              <Link
                href="/bets"
                aria-label="View all bets"
                style={{
                  background: "#2A2A3E",
                  border: "none",
                  borderRadius: "8px",
                  color: "#E0E0E0",
                  fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "6px 12px",
                  cursor: "pointer",
                  height: 32,
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                Bets
              </Link>
            )}

            {/* ? Help button — opens welcome card */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="How to play"
              style={{
                background: "#2A2A3E",
                border: "none",
                borderRadius: "8px",
                color: "#a0a0b0",
                fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
                fontSize: "0.85rem",
                fontWeight: 700,
                padding: "6px 10px",
                cursor: "pointer",
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              ?
            </button>

            {/* Wallet button */}
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Wallet disconnect recovery banner — below header */}
      <WalletDisconnectBanner />

      {/* ======================== MAIN ======================== */}
      <main
        className="main-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "calc(72px + 16px)",
          paddingBottom: 32,
          paddingLeft: 16,
          paddingRight: 16,
          gap: 24,
          width: "100%",
          margin: "40px auto",
          boxSizing: "border-box",
        }}
      >
        {/* Canvas — hero element */}
        <div id="game-canvas" style={{ width: "100%", position: "relative" }}>
          <GameCanvas />
        </div>

        {/* Betting Panel + notifications */}
        <div
          id="betting-panel"
          style={{
            width: "100%",
            position: "relative",
          }}
        >
          <BettingPanel />

          {/* Loss notification moved to overlay section below */}
        </div>

        {/* My Bets summary — only shows when player has active/claimable bets */}
        {connected && <MyBetsSummary />}
      </main>

      {/* ======================== OVERLAYS ======================== */}

      {/* Season Complete overlay — renders above game when season finishes */}
      {showSeasonComplete && seasonStatus === "completed" && (
        <SeasonCompleteOverlay
          seasonNumber={seasonCompletionState.seasonNumber}
          pixels={pixels}
          onDismiss={() => setShowSeasonComplete(false)}
        />
      )}

      {/* Win notification — fixed bottom */}
      {resolution?.type === "win" && resolution.payoutSol !== undefined && (
        <WinNotification
          colorName={resolution.winningColorName}
          payoutSol={resolution.payoutSol}
          onDismiss={clearResolution}
        />
      )}

      {/* Loss notification — fixed bottom */}
      {resolution?.type === "loss" && (
        <LossNotification
          winningColorName={resolution.winningColorName}
          onDismiss={clearResolution}
        />
      )}


      {/* Jackpot teaser — floating bubble, large screens only */}
      <JackpotTeaser />

      {/* Welcome card — first visit + ? button */}
      <WelcomeCard forceOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ======================== STYLES ======================== */}
      <style>{`
        /* Hide header RoundInfo on very narrow screens, show on wider ones */
        @media (max-width: 400px) {
          .header-round-info {
            display: none !important;
          }
        }

        /* wallet adapter button styling */
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

        .wallet-adapter-modal-wrapper {
          background: #1E1E2E !important;
          border-radius: 16px !important;
        }
      `}</style>
    </div>
  );
}
