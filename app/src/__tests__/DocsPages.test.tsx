import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/navigation — DocsLayout uses usePathname
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/how-it-works"),
}));

// Mock next/link — simplify to a plain anchor for testing
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import HowItWorksPage from "@/app/how-it-works/page";
import AiArtistPage from "@/app/ai-artist/page";
import RulesPage from "@/app/rules/page";
import FairnessPage from "@/app/fairness/page";
import FaqPage from "@/app/faq/page";
import { ExpandableSection } from "@/components/docs/ExpandableSection";

describe("DocsPages", () => {
  it('/how-it-works renders "The Game" heading', () => {
    render(<HowItWorksPage />);
    expect(screen.getByText("The Game")).toBeDefined();
  });

  it('/ai-artist renders "What the AI Sees" heading', () => {
    render(<AiArtistPage />);
    expect(screen.getByText("What the AI Sees")).toBeDefined();
  });

  it('/rules renders "Bet Limits" heading', () => {
    render(<RulesPage />);
    expect(screen.getByText("Bet Limits")).toBeDefined();
  });

  it('/fairness renders "prompt commitment proof" text', () => {
    render(<FairnessPage />);
    // The text appears in the expandable nerdy section (initially hidden but in DOM)
    const elements = screen.getAllByText(/prompt commitment proof/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('/faq renders "Do I need a Solana wallet?" text', () => {
    render(<FaqPage />);
    expect(screen.getByText("Do I need a Solana wallet?")).toBeDefined();
  });
});

describe("ExpandableSection", () => {
  it("hides content by default (defaultOpen=false)", () => {
    render(
      <ExpandableSection title="Secret Section">
        <span>Hidden content</span>
      </ExpandableSection>
    );

    // Content should be in DOM but inside collapsed container (max-height: 0)
    const toggleBtn = screen.getByRole("button", { name: /Secret Section/i });
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands content on click", () => {
    render(
      <ExpandableSection title="Click Me">
        <span>Visible content</span>
      </ExpandableSection>
    );

    const toggleBtn = screen.getByRole("button", { name: /Click Me/i });
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggleBtn);

    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapses content on second click", () => {
    render(
      <ExpandableSection title="Toggle Me">
        <span>Content</span>
      </ExpandableSection>
    );

    const toggleBtn = screen.getByRole("button", { name: /Toggle Me/i });

    // Open
    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");

    // Close
    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("starts open when defaultOpen=true", () => {
    render(
      <ExpandableSection title="Open Section" defaultOpen={true}>
        <span>Already visible</span>
      </ExpandableSection>
    );

    const toggleBtn = screen.getByRole("button", { name: /Open Section/i });
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
  });
});
