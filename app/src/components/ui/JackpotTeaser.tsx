"use client";

/**
 * JackpotTeaser — compact header element teasing the upcoming jackpot feature.
 *
 * Static UI element per FS-11. No on-chain read needed.
 * Designed to fit inline in the header row alongside other elements.
 */
export function JackpotTeaser() {
  return (
    <div
      aria-label="Jackpot feature coming soon"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        background: "rgba(59, 219, 255, 0.08)",
        border: "1px solid rgba(59, 219, 255, 0.2)",
        borderRadius: "20px",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span role="img" aria-hidden="true" style={{ fontSize: "0.85rem" }}>
        🏆
      </span>
      <span
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        Jackpot
      </span>
      <span
        style={{
          fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          fontSize: "0.7rem",
          fontStyle: "italic",
          color: "#3BDBFF",
          opacity: 0.8,
        }}
      >
        Coming soon
      </span>
    </div>
  );
}
