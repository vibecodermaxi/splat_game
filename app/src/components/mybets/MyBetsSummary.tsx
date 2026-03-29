"use client";

import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { useBetHistory } from "@/hooks/useBetHistory";
import { useClaimWinnings } from "@/hooks/useClaimWinnings";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";
import { ClaimButton } from "@/components/mybets/ClaimButton";
import type { BetHistoryEntry } from "@/hooks/useBetHistory";

type BetStatus = "active" | "claimable" | "won" | "lost";

function getBetStatus(
  bet: BetHistoryEntry,
  pixels: Record<number, { status?: string; winningColor?: number | null }>,
): BetStatus {
  const pixel = pixels[bet.pixelIndex];
  if (!pixel || pixel.status !== "resolved") return "active";
  const isWinner = pixel.winningColor === bet.colorIndex;
  if (isWinner && !bet.claimed) return "claimable";
  if (isWinner && bet.claimed) return "won";
  return "lost";
}

const STATUS_CONFIG: Record<BetStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#3BDBFF", bg: "rgba(59, 219, 255, 0.12)" },
  claimable: { label: "Won", color: "#3BFF8A", bg: "rgba(59, 255, 138, 0.12)" },
  won: { label: "Claimed", color: "#a0a0b0", bg: "rgba(160, 160, 176, 0.1)" },
  lost: { label: "Lost", color: "#FF3B6F", bg: "rgba(255, 59, 111, 0.12)" },
};

/**
 * Compact inline bet summary shown below the BettingPanel on the homepage.
 * Only renders when the player has at least one bet.
 * Shows claimable bets first, then active, then recent history (last 3).
 */
export function MyBetsSummary() {
  const { pixels } = useGameStore();
  const { bets, loading, refresh } = useBetHistory();
  const { claimSingle, claimAll, isClaiming, claimProgress } = useClaimWinnings();

  if (loading || bets.length === 0) return null;

  // Categorize
  const claimable: BetHistoryEntry[] = [];
  const active: BetHistoryEntry[] = [];
  const history: BetHistoryEntry[] = [];
  for (const bet of bets) {
    const status = getBetStatus(bet, pixels);
    if (status === "claimable") claimable.push(bet);
    else if (status === "active") active.push(bet);
    else history.push(bet);
  }

  // Show last 3 history items
  const recentHistory = history.slice(-3);

  const handleClaim = async (bet: BetHistoryEntry) => {
    const ok = await claimSingle(bet);
    if (ok) refresh();
  };

  const handleClaimAll = async () => {
    await claimAll(claimable);
    refresh();
  };

  return (
    <div
      style={{
        width: "100%",
        background: "#1A1A2A",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px 6px",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-family-display)",
            fontSize: "0.9rem",
            color: "#fff",
            margin: 0,
          }}
        >
          My Bets
        </h3>
        <Link
          href="/bets"
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontSize: "0.75rem",
            color: "#3BDBFF",
            textDecoration: "none",
          }}
        >
          View all &rarr;
        </Link>
      </div>

      {/* Claimable bets */}
      {claimable.length > 0 && (
        <div>
          <SectionLabel color="#3BFF8A">Claimable</SectionLabel>
          {claimable.map((bet) => (
            <SummaryRow key={bet.betPDA} bet={bet} pixels={pixels} onClaim={handleClaim} isClaiming={isClaiming} />
          ))}
          {claimable.length > 1 && (
            <div style={{ padding: "6px 14px 8px" }}>
              <button
                type="button"
                onClick={handleClaimAll}
                disabled={isClaiming}
                style={{
                  width: "100%",
                  minHeight: 36,
                  borderRadius: 8,
                  border: "none",
                  background: isClaiming ? "#2A2A3E" : "linear-gradient(135deg, #FF3B6F, #FF6B3B)",
                  color: isClaiming ? "#888" : "#fff",
                  fontFamily: "var(--font-family-display)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: isClaiming ? "not-allowed" : "pointer",
                  letterSpacing: "0.04em",
                }}
              >
                {claimProgress || `Claim All (${claimable.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active bets */}
      {active.length > 0 && (
        <div>
          <SectionLabel color="#3BDBFF">Active</SectionLabel>
          {active.map((bet) => (
            <SummaryRow key={bet.betPDA} bet={bet} pixels={pixels} />
          ))}
        </div>
      )}

      {/* Recent history */}
      {recentHistory.length > 0 && (
        <div>
          <SectionLabel color="#a0a0b0">Recent</SectionLabel>
          {recentHistory.map((bet) => (
            <SummaryRow key={bet.betPDA} bet={bet} pixels={pixels} />
          ))}
        </div>
      )}

      {/* Bottom pad */}
      <div style={{ height: 6 }} />
    </div>
  );
}

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "4px 14px 2px",
        fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
      }}
    >
      {children}
    </div>
  );
}

function SummaryRow({
  bet,
  pixels,
  onClaim,
  isClaiming,
}: {
  bet: BetHistoryEntry;
  pixels: Record<number, { status?: string; winningColor?: number | null }>;
  onClaim?: (bet: BetHistoryEntry) => void;
  isClaiming?: boolean;
}) {
  const colorName = COLOR_NAMES[bet.colorIndex] ?? "Unknown";
  const colorHex = BASE_HEX[colorName] ?? "#888";
  const amountSol = (bet.amount / 1e9).toFixed(3);
  const status = getBetStatus(bet, pixels);
  const badge = STATUS_CONFIG[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
      }}
    >
      {/* Color dot */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: colorHex,
          flexShrink: 0,
        }}
      />

      {/* Info */}
      <div
        style={{
          flex: 1,
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.8rem",
          color: "#ccc",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span style={{ color: "#fff", fontWeight: 600 }}>{colorName}</span>
        {" "}
        <span style={{ color: "#888" }}>Pixel #{bet.pixelIndex}</span>
      </div>

      {/* Amount */}
      <div
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.75rem",
          color: "#888",
          flexShrink: 0,
        }}
      >
        {amountSol} SOL
      </div>

      {/* Claim button or status badge */}
      {status === "claimable" && onClaim ? (
        <ClaimButton bet={bet} onClaim={onClaim} isClaiming={isClaiming ?? false} />
      ) : (
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: badge.color,
            background: badge.bg,
            padding: "2px 6px",
            borderRadius: 4,
            flexShrink: 0,
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          }}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}
