"use client";

import { DocsLayout } from "@/components/docs/DocsLayout";
import { ExpandableSection } from "@/components/docs/ExpandableSection";

export default function FairnessPage() {
  const paraStyle: React.CSSProperties = {
    margin: "0 0 16px 0",
    fontSize: "0.95rem",
    color: "#d0d0d0",
  };

  const nerdy = (
    <div>
      <p style={{ margin: "0 0 12px 0" }}>
        The oracle constructs a prompt from the canvas state, neighboring pixels, and recent history.
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        It computes SHA-256 of the full prompt text and posts the hash on-chain via{" "}
        <code
          style={{
            fontFamily: "var(--font-family-mono, 'JetBrains Mono', monospace)",
            backgroundColor: "#1e1e2e",
            padding: "1px 4px",
            borderRadius: "3px",
            fontSize: "0.85em",
          }}
        >
          open_round
        </code>
        . Bets open <em>after</em> the hash is on-chain.
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        At resolution, the full prompt text and AI response are published. The prompt is uploaded to
        Arweave for permanent storage.
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        Anyone can hash the published prompt and verify it matches the on-chain commitment.
      </p>
      <p style={{ margin: "0 0 0 0" }}>
        This is a prompt commitment proof — the game proves the input was decided before betting, not
        that you can reproduce the output.
      </p>
    </div>
  );

  const vrfFallback = (
    <div>
      <p style={{ margin: "0 0 12px 0" }}>
        If the AI is unavailable for 30+ minutes, the round resolves via Switchboard VRF (verifiable
        random function).
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        VRF-resolved pixels show a cyan dot on the canvas and a note in the tooltip.
      </p>
      <p style={{ margin: "0 0 0 0" }}>VRF is independently verifiable on-chain.</p>
    </div>
  );

  const howToVerify = (
    <div>
      <p style={{ margin: "0 0 12px 0" }}>Tap any resolved pixel on the canvas.</p>
      <p style={{ margin: "0 0 12px 0" }}>
        Look for the &ldquo;Verified fair&rdquo; badge.
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        Expand &ldquo;View proof&rdquo; to see the commitment hash and Arweave link.
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        Click the Arweave link to see the full prompt text.
      </p>
      <p style={{ margin: "0 0 0 0" }}>
        Hash the prompt text with SHA-256 and compare to the on-chain commitment.
      </p>
    </div>
  );

  return (
    <DocsLayout title="Fairness & Verification">
      {/* Casual explanation — always visible */}
      <p style={{ ...paraStyle, marginTop: "8px" }}>
        Every round, the AI&apos;s input is locked before bets open. A hash of the prompt is posted
        on-chain. After the round, you can check that the prompt matches the hash. The AI can&apos;t
        change its mind after seeing your bets.
      </p>

      {/* Expandable sections */}
      <ExpandableSection title="The Nerdy Version">{nerdy}</ExpandableSection>

      <ExpandableSection title="VRF Fallback">{vrfFallback}</ExpandableSection>

      <ExpandableSection title="How to Verify">{howToVerify}</ExpandableSection>
    </DocsLayout>
  );
}
