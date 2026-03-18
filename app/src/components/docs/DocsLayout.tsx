"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface DocsLayoutProps {
  title: string;
  children: React.ReactNode;
}

const NAV_LINKS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/ai-artist", label: "The AI Artist" },
  { href: "/rules", label: "Rules" },
  { href: "/fairness", label: "Fairness" },
  { href: "/faq", label: "FAQ" },
];

export function DocsLayout({ title, children }: DocsLayoutProps) {
  const pathname = usePathname();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-void, #14141f)",
        color: "#e0e0e0",
        fontFamily: "var(--font-family-body, Nunito, sans-serif)",
      }}
    >
      {/* Fixed header */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "56px",
          backgroundColor: "#14141f",
          borderBottom: "0.5px solid #2a2a3e",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        {/* Back arrow */}
        <Link
          href="/"
          aria-label="Back to game"
          style={{
            color: "#e0e0e0",
            textDecoration: "none",
            fontSize: "20px",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            minWidth: "44px",
            minHeight: "44px",
            justifyContent: "flex-start",
          }}
        >
          ←
        </Link>

        {/* Page title */}
        <h1
          style={{
            fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
            fontSize: "1.1rem",
            color: "#e0e0e0",
            margin: 0,
            flex: 1,
            textAlign: "center",
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </h1>

        {/* FAQ link icon */}
        <Link
          href="/faq"
          aria-label="FAQ"
          style={{
            color: "#a0a0b0",
            textDecoration: "none",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            minWidth: "44px",
            minHeight: "44px",
            justifyContent: "flex-end",
          }}
        >
          ?
        </Link>
      </header>

      {/* Content area */}
      <main
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "0 16px",
          paddingTop: "calc(56px + 24px)",
          paddingBottom: "80px",
          lineHeight: 1.7,
        }}
      >
        {children}
      </main>

      {/* Bottom nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#14141f",
          borderTop: "0.5px solid #2a2a3e",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
          zIndex: 100,
        }}
      >
        {NAV_LINKS.map((link, i) => (
          <span key={link.href} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href={link.href}
              style={{
                fontSize: "0.75rem",
                color: pathname === link.href ? "#3bdbff" : "#666680",
                textDecoration: "none",
                fontWeight: pathname === link.href ? 700 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {link.label}
            </Link>
            {i < NAV_LINKS.length - 1 && (
              <span style={{ color: "#2a2a3e", fontSize: "0.75rem" }}>|</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
