"use client";

import type { BetHistoryEntry } from "@/hooks/useBetHistory";

interface ClaimButtonProps {
  bet: BetHistoryEntry;
  onClaim: (bet: BetHistoryEntry) => void;
  isClaiming: boolean;
}

/**
 * Inline claim button shown per claimable bet row.
 * Disabled while any claim transaction is in flight.
 */
export function ClaimButton({ bet, onClaim, isClaiming }: ClaimButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onClaim(bet)}
      disabled={isClaiming}
      aria-label={`Claim winnings for pixel #${bet.pixelIndex}`}
      style={{
        background: "transparent",
        border: "1px solid #3BDBFF",
        color: "#3BDBFF",
        fontWeight: 700,
        fontSize: "0.75rem",
        padding: "4px 10px",
        borderRadius: "6px",
        cursor: isClaiming ? "not-allowed" : "pointer",
        opacity: isClaiming ? 0.5 : 1,
        minHeight: "28px",
        transition: "opacity 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      Claim
    </button>
  );
}

interface ClaimAllButtonProps {
  claimableBets: BetHistoryEntry[];
  onClaimAll: (bets: BetHistoryEntry[]) => void;
  isClaiming: boolean;
  claimProgress: string | null;
}

/**
 * Sticky footer "Claim All" button shown when multiple bets are claimable.
 * Shows progress text while claiming is in progress.
 * Uses linear-gradient background (Splat Pink to Electric Orange) per brand standards.
 * Minimum 44px height for mobile tap targets.
 */
export function ClaimAllButton({
  claimableBets,
  onClaimAll,
  isClaiming,
  claimProgress,
}: ClaimAllButtonProps) {
  const label = claimProgress
    ? claimProgress
    : `Claim All (${claimableBets.length})`;

  return (
    <button
      type="button"
      onClick={() => onClaimAll(claimableBets)}
      disabled={isClaiming || claimableBets.length === 0}
      aria-label={`Claim all ${claimableBets.length} winnings`}
      style={{
        width: "100%",
        minHeight: "44px",
        borderRadius: "12px",
        border: "none",
        background: isClaiming
          ? "#2A2A3E"
          : "linear-gradient(135deg, #FF3B6F, #FF6B3B)",
        color: isClaiming ? "#888" : "#fff",
        fontFamily: "var(--font-family-display)",
        fontSize: "1rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        cursor: isClaiming || claimableBets.length === 0 ? "not-allowed" : "pointer",
        opacity: isClaiming ? 0.8 : 1,
        transition: "background 0.2s ease-out, opacity 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {isClaiming && (
        <span
          style={{
            display: "inline-block",
            width: "14px",
            height: "14px",
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      )}
      {label}
    </button>
  );
}
