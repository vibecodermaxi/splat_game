"use client";

import { DocsLayout } from "@/components/docs/DocsLayout";

export default function HowItWorksPage() {
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
    <DocsLayout title="How It Works">
      <h2 style={headingStyle}>The Game</h2>
      <p style={paraStyle}>
        Pixel Predict is a prediction game. An AI artist paints a 20x20 canvas, one pixel at a
        time. You bet on what color the AI will pick next.
      </p>

      <h2 style={headingStyle}>The Loop</h2>
      <p style={paraStyle}>
        Every 30 minutes, a new round opens for the next pixel. You pick one of 16 colors, place
        your bet in SOL, and wait. The AI makes its choice. If you called it right, you split the
        pot with other winners.
      </p>

      <h2 style={headingStyle}>The Canvas</h2>
      <p style={paraStyle}>
        400 pixels, 400 rounds, one season. When the last pixel fills in, the season is complete.
        New canvas, new game.
      </p>

      <h2 style={headingStyle}>The Odds</h2>
      <p style={paraStyle}>
        This is parimutuel — no house edge on the odds. The payout depends on how much SOL is in
        the winning color&apos;s pool vs the total pot. A 5% rake funds the treasury and jackpot.
      </p>
    </DocsLayout>
  );
}
