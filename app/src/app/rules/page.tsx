"use client";

import { DocsLayout } from "@/components/docs/DocsLayout";

export default function RulesPage() {
  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
    fontSize: "1.2rem",
    color: "#3bdbff",
    marginTop: "32px",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  };

  const paraStyle: React.CSSProperties = {
    margin: "0 0 16px 0",
    fontSize: "0.95rem",
    color: "#d0d0d0",
  };

  return (
    <DocsLayout title="Betting Rules">
      <h2 style={headingStyle}>Bet Limits</h2>
      <p style={paraStyle}>
        Minimum bet: 0.01 SOL. Maximum bet per color per pixel: 10 SOL. You can increase your bet
        on the same color before lockout.
      </p>

      <h2 style={headingStyle}>One Color Rule</h2>
      <p style={paraStyle}>
        You can only bet on one color per pixel. Once you pick, you&apos;re locked in. No hedging.
      </p>

      <h2 style={headingStyle}>The Clock</h2>
      <p style={paraStyle}>
        Each round lasts 30 minutes. Bets lock 2 minutes before the round ends. Once locked, no new
        bets or increases.
      </p>

      <h2 style={headingStyle}>The Rake</h2>
      <p style={paraStyle}>
        5% of the total pool is taken at resolution. 3% goes to the treasury (keeps the lights on).
        2% goes to the jackpot pool (coming soon).
      </p>

      <h2 style={headingStyle}>Zero Winners</h2>
      <p style={paraStyle}>
        If nobody picks the winning color, the net pool goes to the treasury. No refunds. Every
        round resolves.
      </p>

      <h2 style={headingStyle}>Claiming</h2>
      <p style={paraStyle}>
        Winnings don&apos;t expire. Claim whenever you want from the My Bets drawer.
      </p>
    </DocsLayout>
  );
}
