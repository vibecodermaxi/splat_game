"use client";

import { useState } from "react";

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ExpandableSection({
  title,
  children,
  defaultOpen = false,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  return (
    <div
      style={{
        borderTop: "0.5px solid #2a2a3e",
        marginTop: "8px",
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "12px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "var(--font-family-display, 'Luckiest Guy', cursive)",
          fontSize: "1rem",
          color: "#e0e0e0",
          textAlign: "left",
        }}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        {/* Chevron — rotates on open */}
        <span
          style={{
            display: "inline-block",
            transition: "transform 300ms ease-out",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            fontSize: "0.75rem",
            color: "#a0a0b0",
            marginLeft: "8px",
          }}
        >
          ▼
        </span>
      </button>

      {/* Collapsible content */}
      <div
        style={{
          maxHeight: isOpen ? "1000px" : "0",
          overflow: "hidden",
          transition: "max-height 300ms ease-out",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-family-body, Nunito, sans-serif)",
            fontSize: "0.9rem",
            color: "#a0a0b0",
            padding: "0 0 16px 0",
            lineHeight: 1.7,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
