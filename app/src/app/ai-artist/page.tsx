"use client";

import { DocsLayout } from "@/components/docs/DocsLayout";

export default function AiArtistPage() {
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
    <DocsLayout title="The AI Artist">
      <h2 style={headingStyle}>What the AI Sees</h2>
      <p style={paraStyle}>
        The AI sees the entire canvas so far — every color it has already placed. It sees the
        neighboring pixels. It sees a summary of its last 5 choices. It sees a style direction for
        the season.
      </p>

      <h2 style={headingStyle}>What the AI Doesn&apos;t See</h2>
      <p style={paraStyle}>
        The AI never sees your bets. It doesn&apos;t know the pool sizes. It has no idea what color
        is popular. It can&apos;t be influenced by money.
      </p>

      <h2 style={headingStyle}>How It Picks</h2>
      <p style={paraStyle}>
        The AI is prompted at temperature 0 — fully deterministic. Given the same input, it always
        picks the same color. It chooses a color, a shade (how light or dark), and a warmth value
        (cooler or warmer hue shift).
      </p>

      <h2 style={headingStyle}>The Commitment</h2>
      <p style={paraStyle}>
        Before any bets open, the AI&apos;s input (the prompt) is hashed and posted on-chain. You
        can verify after the round that the prompt was locked before betting started. This is a
        prompt commitment proof — the game proves the AI&apos;s input was decided first.
      </p>
    </DocsLayout>
  );
}
