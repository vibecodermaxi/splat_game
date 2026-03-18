"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * WalletDisconnectBanner — shows a recovery banner when wallet disconnects mid-session.
 *
 * Watches connected transitions via prevConnectedRef:
 * - true -> false: shows the orange banner with reconnect prompt
 * - becomes connected again: auto-hides the banner
 *
 * The banner sits below the fixed header (top: 56px) so it doesn't obscure navigation.
 */
export function WalletDisconnectBanner() {
  const { connected, connect } = useWallet();
  const prevConnectedRef = useRef(connected);
  const [showBanner, setShowBanner] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (prevConnectedRef.current === true && connected === false) {
      setShowBanner(true);
    }
    if (connected) {
      setShowBanner(false);
      setIsReconnecting(false);
    }
    prevConnectedRef.current = connected;
  }, [connected]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await connect();
    } catch {
      // User dismissed the modal or error occurred — stop spinning
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: 56,
        left: 0,
        right: 0,
        zIndex: 200,
        background: "rgba(237, 137, 54, 0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        gap: 12,
        fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
        fontSize: "0.875rem",
        color: "#fff",
        backdropFilter: "blur(4px)",
        // Slide-down entrance animation
        animation: "bannerSlideDown 0.25s ease-out",
      }}
    >
      <p style={{ margin: 0, flex: 1, fontWeight: 600 }}>
        Wallet disconnected. Reconnect to continue playing.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {/* Reconnect button */}
        <button
          type="button"
          onClick={handleReconnect}
          disabled={isReconnecting}
          aria-label="Reconnect wallet"
          style={{
            background: "#fff",
            border: "none",
            borderRadius: "8px",
            color: "#ED8936",
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontWeight: 700,
            fontSize: "0.85rem",
            padding: "6px 14px",
            cursor: isReconnecting ? "wait" : "pointer",
            opacity: isReconnecting ? 0.7 : 1,
          }}
        >
          {isReconnecting ? "Connecting..." : "Reconnect"}
        </button>

        {/* Dismiss X button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss disconnect banner"
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255, 255, 255, 0.8)",
            cursor: "pointer",
            fontSize: "1.1rem",
            padding: "4px",
            lineHeight: 1,
            borderRadius: "4px",
          }}
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes bannerSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
