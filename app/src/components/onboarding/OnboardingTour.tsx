"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TourStep {
  targetId: string;
  fallbackTargetId?: string;
  title: string;
  body: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "game-canvas",
    title: "Watch the Canvas",
    body: "The AI paints one pixel every 30 minutes.",
  },
  {
    targetId: "betting-panel",
    title: "Pick a Color. Place Your Bet.",
    body: "Pick a color. Place your bet in SOL.",
  },
  {
    targetId: "countdown-timer",
    fallbackTargetId: "betting-panel",
    title: "Watch the Clock",
    body: "Bets lock 2 minutes before resolution.",
  },
  {
    targetId: "splat-header",
    title: "You're All Set!",
    body: "Check your bets, explore the docs, and win SOL!",
  },
];

const LOCAL_STORAGE_KEY = "splat_tour_done";

interface TooltipPosition {
  top: number;
  left: number;
  width: number;
  placement: "below" | "above";
}

function getTooltipPosition(
  targetRect: DOMRect,
  tooltipHeight: number = 160
): TooltipPosition {
  const tooltipWidth = 280;
  const gap = 12;
  const viewportH = window.innerHeight;

  // Determine whether to place tooltip below or above target
  const spaceBelow = viewportH - targetRect.bottom;
  const placement: "below" | "above" =
    spaceBelow >= tooltipHeight + gap ? "below" : "above";

  const top =
    placement === "below"
      ? targetRect.bottom + gap
      : targetRect.top - tooltipHeight - gap;

  // Center horizontally on the target, clamped to viewport
  const idealLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
  const left = Math.max(12, Math.min(idealLeft, window.innerWidth - tooltipWidth - 12));

  return { top, left, width: tooltipWidth, placement };
}

/**
 * OnboardingTour — 4-step first-visit tooltip tour.
 *
 * - Self-contained: reads/writes localStorage to show only once per device.
 * - Positions tooltip relative to target element via getBoundingClientRect().
 * - Uses semi-transparent backdrop with pointer-events: none to not block the page.
 * - Respects prefers-reduced-motion for entrance animation.
 */
export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // On mount: check if tour has already been seen
  useEffect(() => {
    try {
      const done = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (done !== "true") {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (SSR or private mode) — show tour
      setVisible(true);
    }
  }, []);

  // Position tooltip whenever step changes or tour becomes visible
  const updatePosition = useCallback(() => {
    if (!visible) return;

    const currentStep = TOUR_STEPS[step];
    let targetEl = document.getElementById(currentStep.targetId);

    if (!targetEl && currentStep.fallbackTargetId) {
      targetEl = document.getElementById(currentStep.fallbackTargetId);
    }

    if (!targetEl) {
      // No target found — center in viewport
      setTooltipPos({
        top: window.innerHeight / 2 - 80,
        left: window.innerWidth / 2 - 140,
        width: 280,
        placement: "below",
      });
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const tooltipH = tooltipRef.current?.offsetHeight ?? 160;
    setTooltipPos(getTooltipPosition(rect, tooltipH));
  }, [step, visible]);

  useEffect(() => {
    if (visible) {
      // Small delay to let layout settle
      const timer = setTimeout(updatePosition, 80);
      return () => clearTimeout(timer);
    }
  }, [visible, updatePosition]);

  // Reposition on resize
  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [visible, updatePosition]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setVisible(false);
  }, []);

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (!visible) return null;

  const currentStep = TOUR_STEPS[step];
  const isLastStep = step === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Semi-transparent backdrop — pointer-events none so page is still usable */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: "rgba(10, 10, 20, 0.55)",
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      {tooltipPos && (
        <div
          ref={tooltipRef}
          role="dialog"
          aria-label={`Onboarding step ${step + 1} of ${TOUR_STEPS.length}: ${currentStep.title}`}
          style={{
            position: "fixed",
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: tooltipPos.width,
            zIndex: 901,
            background: "#1E1E2E",
            borderRadius: "12px",
            border: "1px solid rgba(59, 219, 255, 0.3)",
            padding: "16px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
            fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
          }}
        >
          {/* Step indicator dots */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginBottom: "10px",
              alignItems: "center",
            }}
          >
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  borderRadius: "4px",
                  background: i === step ? "#3BDBFF" : "rgba(255,255,255,0.2)",
                  transition: "width 0.2s ease, background 0.2s ease",
                }}
              />
            ))}
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              {step + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 6px",
            }}
          >
            {currentStep.title}
          </h3>

          {/* Body */}
          <p
            style={{
              fontSize: "0.85rem",
              color: "rgba(255, 255, 255, 0.7)",
              margin: "0 0 14px",
              lineHeight: 1.5,
            }}
          >
            {currentStep.body}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
            }}
          >
            {/* Skip button */}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Skip tour"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                fontSize: "0.8rem",
                padding: "8px 10px",
                borderRadius: "6px",
                fontFamily: "var(--font-family-body, 'Nunito', sans-serif)",
              }}
            >
              Skip
            </button>

            {/* Next / Got it! button */}
            <button
              type="button"
              onClick={handleNext}
              aria-label={isLastStep ? "Got it! Close tour" : `Next step: ${TOUR_STEPS[step + 1]?.title ?? ""}`}
              style={{
                background: isLastStep
                  ? "linear-gradient(135deg, #3BDBFF 0%, #22a8cc 100%)"
                  : "#3BDBFF",
                border: "none",
                color: "#0a0a14",
                cursor: "pointer",
                fontSize: isLastStep ? "0.85rem" : "0.85rem",
                fontFamily: isLastStep
                  ? "var(--font-family-display, 'Luckiest Guy', cursive)"
                  : "var(--font-family-body, 'Nunito', sans-serif)",
                fontWeight: isLastStep ? undefined : 700,
                padding: "8px 16px",
                borderRadius: "8px",
                letterSpacing: isLastStep ? "0.03em" : undefined,
              }}
            >
              {isLastStep ? "Got it!" : "Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
