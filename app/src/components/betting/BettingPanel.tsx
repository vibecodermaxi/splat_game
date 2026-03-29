"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "@/store/gameStore";
import { useCountdown } from "@/hooks/useCountdown";
import { useColorPools } from "@/hooks/useColorPools";
import { usePlaceBet } from "@/hooks/usePlaceBet";
import { CountdownTimer } from "@/components/round/CountdownTimer";
import { ColorSwatch } from "@/components/betting/ColorSwatch";
import { BetInput } from "@/components/betting/BetInput";
import { COLOR_NAMES, BASE_HEX } from "@/lib/color";
import { MIN_BET_SOL } from "@/lib/constants";
import { StreakBadge } from "@/components/ui/StreakBadge";

// Toast notification for transaction feedback
interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

let toastIdCounter = 0;

/**
 * Full betting panel component: color grid, bet input, place bet button, lockout state.
 *
 * Sections:
 * 1. CountdownTimer
 * 2. Color Grid (4x4, 16 swatches with multiplier overlays)
 * 3. Bet Input (disabled during lockout/submitting)
 * 4. Action Button ("SPLAT IT!" / "Locked" / "Splatting...")
 * 5. After Bet display
 * 6. Toast notifications
 */
export function BettingPanel() {
  const { currentPixelIndex, pixels, playerBet, setPlayerBet } = useGameStore();
  const activePixelData = pixels[currentPixelIndex] ?? null;

  const openedAtSeconds = activePixelData?.openedAtSeconds ?? null;
  const colorPools = activePixelData?.colorPools ?? Array(16).fill(0);
  const totalPool = activePixelData?.totalPool ?? 0;

  const { isLocked, roundNotOpen } = useCountdown(openedAtSeconds);
  const { computeMultiplier, computePoolPercent } = useColorPools();
  const { placeBet, isSubmitting, error, clearError } = usePlaceBet();

  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState<number>(MIN_BET_SOL);
  const [addingMore, setAddingMore] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Round transition drip — detect when active pixel resolves
  const [dripColor, setDripColor] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const status = activePixelData?.status ?? null;
    if (status === "resolved" && prevStatusRef.current !== null && prevStatusRef.current !== "resolved") {
      const winColor = activePixelData?.winningColor;
      if (winColor !== null && winColor !== undefined) {
        const name = COLOR_NAMES[winColor] ?? "Red";
        setDripColor(BASE_HEX[name] ?? "#FF3B6F");
        const timer = setTimeout(() => setDripColor(null), 1800);
        return () => clearTimeout(timer);
      }
    }
    prevStatusRef.current = status;
  }, [activePixelData]);

  // Lock selected color to playerBet.colorIndex after betting (can only increase)
  const effectiveSelectedColor =
    playerBet && !addingMore ? playerBet.colorIndex : selectedColor;

  // Map Anchor/wallet errors to user-friendly messages
  const mapError = (raw: string): string => {
    if (raw.includes("AccountNotInitialized"))
      return "Waiting for the next round to open. Try again in a moment.";
    if (raw.includes("BettingClosed") || raw.includes("BettingLocked") || raw.includes("betting_closed") || raw.includes("betting_locked"))
      return "Bets are locked for this round.";
    if (raw.includes("InsufficientFunds") || raw.includes("insufficient"))
      return "Not enough SOL in your wallet.";
    if (raw.includes("rejected") || raw.includes("User rejected"))
      return "Transaction cancelled.";
    return "Something went wrong.";
  };

  // Track error state for inline retry
  const [lastError, setLastError] = useState<string | null>(null);
  useEffect(() => {
    if (error) {
      console.error("[BettingPanel] Raw error from hook:", error);
      setLastError(mapError(error));
      clearError();
    }
  }, [error, clearError]);

  // Clear error when user starts a new action
  useEffect(() => {
    if (isSubmitting) setLastError(null);
  }, [isSubmitting]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timeout = type === "success" ? 3000 : 5000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeout);
  }, []);

  const handlePlaceBet = async () => {
    if (effectiveSelectedColor === null) return;
    await placeBet(effectiveSelectedColor, betAmount);
    // Check success by seeing if playerBet was updated (via store)
    // Toast shown after state update via useEffect below
  };

  // Detect bet success: playerBet changes
  const prevPlayerBetRef = useState<typeof playerBet>(null);
  useEffect(() => {
    if (playerBet && playerBet !== prevPlayerBetRef[0]) {
      prevPlayerBetRef[0] = playerBet;
      const colorName = COLOR_NAMES[playerBet.colorIndex];
      addToast(`Splatted! You're on ${colorName}.`, "success");
      setAddingMore(false);
    }
  }, [playerBet, addToast]);

  // Determine button state and appearance
  const noColorSelected = effectiveSelectedColor === null;
  const isActionDisabled = roundNotOpen || isLocked || isSubmitting || noColorSelected || betAmount < MIN_BET_SOL;

  const buttonBg = (() => {
    if (roundNotOpen || isLocked) return "#2A2A3E";
    if (effectiveSelectedColor !== null) {
      return BASE_HEX[COLOR_NAMES[effectiveSelectedColor]];
    }
    // Default gradient CTA
    return "linear-gradient(135deg, #FF3B6F, #FF6B3B)";
  })();

  const buttonLabel = (() => {
    if (roundNotOpen) return "Waiting for next round...";
    if (isLocked) return "Locked. The AI is thinking...";
    if (isSubmitting) return "Splatting...";
    if (noColorSelected) return "Pick a color";
    return "SPLAT IT!";
  })();

  // Show after-bet section if player has a bet and not adding more
  const showAfterBet = playerBet !== null && !addingMore;

  return (
    <div
      id="betting-panel"
      className={isLocked || roundNotOpen ? "panel-locked" : ""}
      style={{
        background: isLocked || roundNotOpen
          ? "linear-gradient(rgba(255, 59, 111, 0.08), rgba(255, 59, 111, 0.08)), #1E1E2E"
          : "#1E1E2E",
        borderRadius: "16px",
        padding: "20px",
        transition: "background 300ms ease-out",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Round transition drip — winning color drips down then fades */}
      <AnimatePresence>
        {dripColor && (
          <motion.div
            key="round-drip"
            initial={{ y: "-100%" }}
            animate={{ y: "0%" }}
            exit={{ opacity: 0 }}
            transition={{
              y: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.8, delay: 0.6 },
            }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              pointerEvents: "none",
              background: `linear-gradient(180deg, ${dripColor}55 0%, ${dripColor}22 60%, transparent 100%)`,
              borderRadius: "16px",
            }}
          >
            {/* Drip blobs at bottom edge */}
            <svg
              viewBox="0 0 400 40"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                bottom: -1,
                left: 0,
                width: "100%",
                height: "40px",
              }}
            >
              <path
                d={`M0,0 Q50,35 100,8 Q150,40 200,5 Q250,38 300,10 Q350,35 400,0 L400,40 L0,40 Z`}
                fill={`${dripColor}22`}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 1: Countdown Timer */}
      <div style={{ marginBottom: "16px" }}>
        <CountdownTimer />
      </div>

      {/* Section 2: Color Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <ColorSwatch
            key={i}
            colorIndex={i}
            isSelected={effectiveSelectedColor === i}
            multiplier={computeMultiplier(colorPools[i] ?? 0, totalPool)}
            poolFraction={totalPool > 0 ? (colorPools[i] ?? 0) / totalPool : 0}
            onSelect={(idx) => {
              if (!playerBet || addingMore) {
                setSelectedColor(idx);
              }
            }}
          />
        ))}
      </div>

      {/* Pool percent for selected color */}
      {effectiveSelectedColor !== null && (
        <p
          style={{
            color: "#aaa",

            fontSize: "0.8rem",
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          {COLOR_NAMES[effectiveSelectedColor]}:{" "}
          {computePoolPercent(colorPools[effectiveSelectedColor] ?? 0, totalPool)} of pool
        </p>
      )}

      {/* Section 3: Bet Input */}
      {!showAfterBet && (
        <div style={{ marginBottom: "16px" }}>
          <BetInput
            value={betAmount}
            onChange={setBetAmount}
            disabled={roundNotOpen || isLocked || isSubmitting}
          />
        </div>
      )}

      {/* Section 4: Action Button */}
      {!showAfterBet && (
        <motion.button
          type="button"
          onClick={handlePlaceBet}
          disabled={isActionDisabled}
          className={!isActionDisabled && !isSubmitting ? "splat-btn-ready" : ""}
          animate={
            !isActionDisabled && !isSubmitting
              ? { scale: [1, 1.02, 1] }
              : { scale: 1 }
          }
          transition={
            !isActionDisabled && !isSubmitting
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.1 }
          }
          whileTap={!isActionDisabled ? { scale: 0.93 } : undefined}
          style={{
            width: "100%",
            height: "52px",
            borderRadius: "12px",
            border: "none",
            background: buttonBg,
            color: isLocked || roundNotOpen ? "#888" : "#fff",
            fontFamily: "var(--font-family-display)",
            fontSize: "1.1rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: isActionDisabled ? "not-allowed" : "pointer",
            opacity: isActionDisabled && !isLocked && !roundNotOpen ? 0.6 : 1,
            transition: "background 0.2s ease-out, opacity 0.2s, box-shadow 0.2s ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {isSubmitting && (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
              }}
            />
          )}
          {buttonLabel}
        </motion.button>
      )}

      {/* Error with Retry */}
      {lastError && !isSubmitting && !showAfterBet && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            marginTop: "12px",
          }}
        >
          <span style={{ color: "#FF3B6F", fontSize: "0.85rem", fontWeight: 600 }}>
            {lastError}
          </span>
          <button
            type="button"
            onClick={handlePlaceBet}
            disabled={isActionDisabled}
            style={{
              background: "transparent",
              border: "1px solid #FF3B6F",
              color: "#FF3B6F",
              fontWeight: 700,
              fontSize: "0.8rem",
              padding: "6px 14px",
              borderRadius: "8px",
              cursor: isActionDisabled ? "not-allowed" : "pointer",
              minHeight: "32px",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Section 5: After Bet */}
      {showAfterBet && playerBet && (
        <div
          style={{
            padding: "12px 0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <p
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                margin: 0,
              }}
            >
              Splatted! You're on {COLOR_NAMES[playerBet.colorIndex]}.
            </p>
            <StreakBadge />
          </div>
          <p
            style={{
              color: "#aaa",
  
              fontSize: "0.875rem",
              marginBottom: "12px",
            }}
          >
            {(playerBet.amount / 1e9).toFixed(3)} SOL
          </p>

          {!isLocked && !roundNotOpen && (
            <button
              type="button"
              onClick={() => {
                setSelectedColor(playerBet.colorIndex);
                setAddingMore(true);
              }}
              style={{
                background: "transparent",
                border: "1px solid #444",
                color: "#3BDBFF",
    
                fontWeight: 700,
                fontSize: "0.875rem",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                minHeight: "36px",
              }}
            >
              Add more
            </button>
          )}
        </div>
      )}

      {/* Section 6: Toast notifications */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "center",
        }}
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                background:
                  toast.type === "success"
                    ? "rgba(72, 187, 120, 0.15)"
                    : "rgba(255, 59, 111, 0.15)",
                border:
                  toast.type === "success"
                    ? "1px solid rgba(72, 187, 120, 0.4)"
                    : "1px solid rgba(255, 59, 111, 0.4)",
                color: "#fff",
    
                fontWeight: 600,
                fontSize: "0.875rem",
                padding: "10px 20px",
                borderRadius: "12px",
                backdropFilter: "blur(8px)",
                whiteSpace: "nowrap",
              }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
