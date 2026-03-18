"use client";

import type { BetHistoryEntry } from "@/hooks/useBetHistory";
import type { PixelSnapshot } from "@/types/game";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";
import { ClaimButton } from "@/components/mybets/ClaimButton";

interface BetHistoryListProps {
  bets: BetHistoryEntry[];
  pixels: Record<number, PixelSnapshot>;
  onClaim: (bet: BetHistoryEntry) => void;
  isClaiming: boolean;
}

type BetStatus = "active" | "claimable" | "won" | "lost";

function getBetStatus(bet: BetHistoryEntry, pixels: Record<number, PixelSnapshot>): BetStatus {
  const pixel = pixels[bet.pixelIndex];
  if (!pixel || pixel.status !== "resolved") {
    return "active";
  }
  const isWinner = pixel.winningColor === bet.colorIndex;
  if (isWinner && !bet.claimed) {
    return "claimable";
  }
  if (isWinner && bet.claimed) {
    return "won";
  }
  return "lost";
}

const STATUS_BADGE: Record<BetStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#3BDBFF", bg: "rgba(59, 219, 255, 0.12)" },
  claimable: { label: "Won", color: "#3BFF8A", bg: "rgba(59, 255, 138, 0.12)" },
  won: { label: "Claimed", color: "#a0a0b0", bg: "rgba(160, 160, 176, 0.1)" },
  lost: { label: "Lost", color: "#FF3B6F", bg: "rgba(255, 59, 111, 0.12)" },
};

/**
 * Grouped list of player's bet history.
 *
 * Groups:
 * - Active: pixel not yet resolved
 * - Claimable: pixel resolved, player won, not yet claimed — shows Claim button
 * - History: resolved (won+claimed) or lost
 */
export function BetHistoryList({ bets, pixels, onClaim, isClaiming }: BetHistoryListProps) {
  if (bets.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
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
          No bets yet. Place your first bet!
        </p>
      </div>
    );
  }

  // Categorize bets
  const active: BetHistoryEntry[] = [];
  const claimable: BetHistoryEntry[] = [];
  const history: BetHistoryEntry[] = [];

  for (const bet of bets) {
    const status = getBetStatus(bet, pixels);
    if (status === "active") active.push(bet);
    else if (status === "claimable") claimable.push(bet);
    else history.push(bet);
  }

  return (
    <div style={{ paddingBottom: "8px" }}>
      {active.length > 0 && (
        <Section title="Active" bets={active} pixels={pixels} onClaim={onClaim} isClaiming={isClaiming} />
      )}
      {claimable.length > 0 && (
        <Section title="Claimable" bets={claimable} pixels={pixels} onClaim={onClaim} isClaiming={isClaiming} />
      )}
      {history.length > 0 && (
        <Section title="History" bets={history} pixels={pixels} onClaim={onClaim} isClaiming={isClaiming} />
      )}
    </div>
  );
}

function Section({
  title,
  bets,
  pixels,
  onClaim,
  isClaiming,
}: {
  title: string;
  bets: BetHistoryEntry[];
  pixels: Record<number, PixelSnapshot>;
  onClaim: (bet: BetHistoryEntry) => void;
  isClaiming: boolean;
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "11px",
          fontWeight: 700,
          color: "#a0a0b0",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "8px 16px 4px",
        }}
      >
        {title}
      </div>
      {bets.map((bet) => (
        <BetRow
          key={bet.betPDA}
          bet={bet}
          pixels={pixels}
          onClaim={onClaim}
          isClaiming={isClaiming}
        />
      ))}
    </div>
  );
}

function BetRow({
  bet,
  pixels,
  onClaim,
  isClaiming,
}: {
  bet: BetHistoryEntry;
  pixels: Record<number, PixelSnapshot>;
  onClaim: (bet: BetHistoryEntry) => void;
  isClaiming: boolean;
}) {
  const colorName = COLOR_NAMES[bet.colorIndex] ?? "Unknown";
  const colorHex = BASE_HEX[colorName] ?? "#888";
  const amountSol = (bet.amount / 1e9).toFixed(3);
  const status = getBetStatus(bet, pixels);
  const badge = STATUS_BADGE[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Color swatch */}
      <div
        aria-label={colorName}
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: colorHex,
          flexShrink: 0,
        }}
      />

      {/* Left: color name + pixel label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {colorName}
        </div>
        <div
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontSize: "0.75rem",
            color: "#a0a0b0",
          }}
        >
          Pixel #{bet.pixelIndex}
        </div>
      </div>

      {/* Amount */}
      <div
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.8rem",
          color: "#ccc",
          flexShrink: 0,
        }}
      >
        {amountSol} SOL
      </div>

      {/* Status badge or Claim button */}
      {status === "claimable" ? (
        <ClaimButton bet={bet} onClaim={onClaim} isClaiming={isClaiming} />
      ) : (
        <span
          style={{
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: badge.color,
            background: badge.bg,
            padding: "2px 8px",
            borderRadius: "4px",
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}
