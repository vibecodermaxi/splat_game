"use client";

import { useState, useCallback } from "react";
import { MIN_BET_SOL, MAX_BET_SOL, QUICK_BET_AMOUNTS } from "@/lib/constants";

interface BetInputProps {
  value: number;
  onChange: (val: number) => void;
  disabled: boolean;
}

function clamp(val: number): number {
  return Math.max(MIN_BET_SOL, Math.min(MAX_BET_SOL, val));
}

/**
 * Bet amount input with +/- adjustment buttons and quick-set preset buttons.
 * Uses type="text" to avoid mobile number pad decimal issues.
 * All tap targets are minimum 44px per FE-14.
 */
export function BetInput({ value, onChange, disabled }: BetInputProps) {
  // Local string state for the text field to support mid-edit decimal entry
  const [inputStr, setInputStr] = useState(String(value));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputStr(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const handleBlur = () => {
    // Normalize display on blur
    setInputStr(String(value));
  };

  const increment = useCallback(() => {
    const step = value >= 1 ? 0.1 : 0.01;
    const next = clamp(parseFloat((value + step).toFixed(2)));
    onChange(next);
    setInputStr(String(next));
  }, [value, onChange]);

  const decrement = useCallback(() => {
    const step = value > 1 ? 0.1 : 0.01;
    const next = clamp(parseFloat((value - step).toFixed(2)));
    onChange(next);
    setInputStr(String(next));
  }, [value, onChange]);

  const setQuick = useCallback(
    (amount: number) => {
      onChange(amount);
      setInputStr(String(amount));
    },
    [onChange]
  );

  const containerStyle: React.CSSProperties = {
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };

  const buttonBase: React.CSSProperties = {
    height: "44px",
    width: "44px",
    borderRadius: "10px",
    background: "#2A2A3E",
    border: "0.5px solid #444",
    color: "#fff",

    fontWeight: 700,
    fontSize: "1.2rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      {/* Main input row: [-] [input] [+] */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={decrement}
          disabled={disabled}
          aria-label="Decrease bet amount"
          style={buttonBase}
        >
          -
        </button>

        <input
          type="text"
          inputMode="decimal"
          value={inputStr}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-label="Bet amount in SOL"
          style={{
            flex: 1,
            height: "44px",
            background: "#1E1E2E",
            border: "0.5px solid #333",
            borderRadius: "10px",
            color: "#fff",
        
            fontWeight: 700,
            fontSize: "1rem",
            textAlign: "center",
            padding: "0 12px",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#FF3B6F";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = "#333";
          }}
        />

        <button
          type="button"
          onClick={increment}
          disabled={disabled}
          aria-label="Increase bet amount"
          style={buttonBase}
        >
          +
        </button>
      </div>

      {/* Quick-set preset row */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "8px",
        }}
      >
        {QUICK_BET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setQuick(amount)}
            disabled={disabled}
            aria-label={`Set bet to ${amount} SOL`}
            style={{
              flex: 1,
              minHeight: "36px",
              borderRadius: "8px",
              background: "#1E1E2E",
              border: "0.5px solid #444",
              color: "#fff",
          
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {amount}
          </button>
        ))}
      </div>
    </div>
  );
}
