"use client";

import type { PlayerStats } from "@/hooks/useBetHistory";

interface BetStatsBarProps {
  stats: PlayerStats | null;
  loading: boolean;
}

const PLACEHOLDER = "---";

/**
 * Compact horizontal stats bar showing 4 player season metrics.
 * Shows "---" placeholders when loading or stats is null.
 *
 * Metrics: Bets placed | Wins | Hit rate | Volume (SOL)
 */
export function BetStatsBar({ stats, loading }: BetStatsBarProps) {
  const show = !loading && stats !== null;

  const betsPlaced = show ? String(stats!.totalBets) : PLACEHOLDER;
  const wins = show ? String(stats!.correctPredictions) : PLACEHOLDER;
  const hitRate = show ? `${stats!.hitRate}%` : PLACEHOLDER;
  const volumeSol = show
    ? `${(stats!.totalVolume / 1e9).toFixed(2)} SOL`
    : PLACEHOLDER;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}
      aria-label="Player season statistics"
    >
      <StatItem label="Bets" value={betsPlaced} />
      <Divider />
      <StatItem label="Wins" value={wins} />
      <Divider />
      <StatItem label="Hit Rate" value={hitRate} />
      <Divider />
      <StatItem label="Volume" value={volumeSol} />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "12px",
          color: "#a0a0b0",
          marginBottom: "2px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "14px",
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "28px",
        background: "rgba(255,255,255,0.1)",
        flexShrink: 0,
      }}
    />
  );
}
