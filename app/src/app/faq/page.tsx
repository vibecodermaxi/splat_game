"use client";

import { DocsLayout } from "@/components/docs/DocsLayout";
import { ExpandableSection } from "@/components/docs/ExpandableSection";

export default function FaqPage() {
  return (
    <DocsLayout title="FAQ">
      <div style={{ marginTop: "8px" }}>
        <ExpandableSection title="Do I need a Solana wallet?">
          Yes, you need a Solana wallet like Phantom, Solflare, or Backpack to place bets and claim
          winnings.
        </ExpandableSection>

        <ExpandableSection title="How do I claim my winnings?">
          Open the My Bets drawer (tap &ldquo;Bets&rdquo; in the header). Find your winning bet and
          tap &ldquo;Claim&rdquo;, or use &ldquo;Claim All&rdquo; to collect everything at once.
        </ExpandableSection>

        <ExpandableSection title="What happens if nobody picks the right color?">
          The net pool goes to the treasury. No refunds. Every round resolves.
        </ExpandableSection>

        <ExpandableSection title="Can I bet on the next pixel before it opens?">
          Yes! You can place bets on the next upcoming pixel before its round officially opens. Early
          bird gets the best odds.
        </ExpandableSection>

        <ExpandableSection title="How long is a season?">
          100 rounds, one per pixel in the 10x10 grid. At 30 minutes per round, a season takes
          about 50 hours.
        </ExpandableSection>

        <ExpandableSection title="What's the jackpot?">
          2% of every pot goes to the jackpot pool. The jackpot mechanic is coming soon.
        </ExpandableSection>

        <ExpandableSection title="Is this fair?">
          Yes. The AI&apos;s input is committed on-chain before bets open. You can verify every
          round. Check the Fairness page for details.
        </ExpandableSection>
      </div>
    </DocsLayout>
  );
}
