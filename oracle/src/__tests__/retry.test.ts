/**
 * Unit tests for the failure cascade in callClaudeWithFallback (oracle/src/round.ts).
 *
 * Tests the three-tier retry behavior:
 *   Tier 1: 3 fast retries at 30-second intervals
 *   Tier 2: 6 delay retries at 5-minute intervals (after retryWarning alert)
 *   Tier 3: VRF fallback (after all 9 retries exhausted)
 *
 * Sleep is mocked to resolve instantly. Call counts and sleep durations are tracked.
 * Alerts are mocked to track which were sent. resolveViaVrf is mocked.
 */

import { expect } from "chai";
import { callClaudeWithFallback, OracleContext } from "../round";
import type { ResolutionResult } from "../types";
import type { OracleConfig } from "../config";
import type { ChainClient } from "../chain";
import type { RoundHistoryEntry } from "../types";

// ---------------------------------------------------------------------------
// Helpers to build mock contexts
// ---------------------------------------------------------------------------

/**
 * Minimal mock OracleContext for testing failure cascade.
 * callMock controls what callClaude returns per attempt.
 * sleepDurations records all sleep durations called.
 * alertCalls records which alert methods were called.
 */
function buildCtx(
  callMock: (attempt: number) => Promise<ResolutionResult>,
  sleepDurations: number[],
  alertCalls: string[]
): OracleContext {
  const mockConfig = {
    anthropicApiKey: "mock-key",
    currentSeason: 1,
  } as unknown as OracleConfig;

  const mockChain = {} as unknown as ChainClient;

  return {
    config: mockConfig,
    chain: mockChain,
    alerts: {
      sendRetryWarning: async () => {
        alertCalls.push("retryWarning");
      },
      sendVrfFallback: async () => {
        alertCalls.push("vrfFallback");
      },
      sendSuccess: async () => {
        alertCalls.push("success");
      },
      sendProcessRestart: async () => {
        alertCalls.push("processRestart");
      },
      sendArweaveFailure: async () => {
        alertCalls.push("arweaveFailure");
      },
    },
    history: {
      read: async () => [] as RoundHistoryEntry[],
      push: async () => undefined,
    },
    _testHooks: {
      callClaude: callMock,
      sleep: async (ms: number) => {
        sleepDurations.push(ms);
      },
      resolveViaVrf: async (_ctx: OracleContext, _season: number, _pixel: number) => ({
        colorIndex: 7,
        shade: 50 as 50,
        warmth: 50 as 50,
        vrfResolved: true as true,
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Test 1: Returns Claude result on first successful call (no retries)
// ---------------------------------------------------------------------------
describe("callClaudeWithFallback", () => {
  it("Test 1: returns Claude result immediately on first successful call", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];
    let callCount = 0;

    const ctx = buildCtx(async () => {
      callCount++;
      return {
        colorIndex: 3,
        colorName: "Lime",
        shade: 40,
        warmth: 60,
        reasoning: "looks good",
        vrfResolved: false as false,
      };
    }, sleepDurations, alertCalls);

    const result = await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    expect(result.vrfResolved).to.equal(false);
    expect((result as { colorIndex: number }).colorIndex).to.equal(3);
    expect(callCount).to.equal(1);
    expect(sleepDurations).to.deep.equal([]); // No sleep on first success
    expect(alertCalls).to.deep.equal([]); // No alerts on success
  });

  // -------------------------------------------------------------------------
  // Test 2: Retries 3 times, succeeds on 3rd try
  // -------------------------------------------------------------------------
  it("Test 2: retries 3 times on failure, returns result on 3rd try", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];
    let callCount = 0;

    const ctx = buildCtx(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("Claude unavailable");
      }
      return {
        colorIndex: 5,
        colorName: "Teal",
        shade: 50,
        warmth: 50,
        reasoning: "teal it is",
        vrfResolved: false as false,
      };
    }, sleepDurations, alertCalls);

    const result = await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    expect(result.vrfResolved).to.equal(false);
    expect((result as { colorIndex: number }).colorIndex).to.equal(5);
    expect(callCount).to.equal(3);
    // Two sleeps of 30s between attempts 0→1 and 1→2
    expect(sleepDurations).to.deep.equal([30_000, 30_000]);
    expect(alertCalls).to.deep.equal([]); // No alerts yet (still within fast retries)
  });

  // -------------------------------------------------------------------------
  // Test 3: Enters delay state after 3 fast retries fail, retries 6 times at 5 min
  // -------------------------------------------------------------------------
  it("Test 3: enters delay state after 3 fast retries fail, retries 6 times at 5-min intervals", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];
    let callCount = 0;

    const ctx = buildCtx(async () => {
      callCount++;
      // First 3 fast retries fail; succeed on the 1st delay retry (attempt 4 total)
      if (callCount <= 3) {
        throw new Error("Claude down");
      }
      return {
        colorIndex: 1,
        colorName: "Orange",
        shade: 30,
        warmth: 70,
        reasoning: "warm orange",
        vrfResolved: false as false,
      };
    }, sleepDurations, alertCalls);

    const result = await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    expect(result.vrfResolved).to.equal(false);
    expect((result as { colorIndex: number }).colorIndex).to.equal(1);
    // 3 fast retries: 2 sleeps of 30s (between attempts 0→1, 1→2)
    // Entering delay state: 1 sleep of 5 min before first delay attempt
    expect(sleepDurations).to.deep.equal([30_000, 30_000, 5 * 60 * 1000]);
    // retryWarning alert sent when entering delay state
    expect(alertCalls).to.include("retryWarning");
    expect(alertCalls).to.not.include("vrfFallback");
  });

  // -------------------------------------------------------------------------
  // Test 4: VRF fallback after all 9 retry attempts fail
  // -------------------------------------------------------------------------
  it("Test 4: calls VRF fallback after all 9 retry attempts fail (3 fast + 6 delay)", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];
    let callCount = 0;

    const ctx = buildCtx(async () => {
      callCount++;
      throw new Error("Claude permanently down");
    }, sleepDurations, alertCalls);

    const result = await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    // VRF fallback result
    expect(result.vrfResolved).to.equal(true);
    expect(callCount).to.equal(9); // 3 fast + 6 delay

    // 2 sleeps of 30s for fast retries, 6 sleeps of 5 min for delay retries
    const fast30s = sleepDurations.filter((d) => d === 30_000).length;
    const delay5m = sleepDurations.filter((d) => d === 5 * 60 * 1000).length;
    expect(fast30s).to.equal(2); // between attempts 0→1 and 1→2
    expect(delay5m).to.equal(6); // one before each of the 6 delay attempts
    expect(alertCalls).to.include("retryWarning");
    expect(alertCalls).to.include("vrfFallback");
  });

  // -------------------------------------------------------------------------
  // Test 5: Total fast-retry duration is ~60s (2 waits of 30s, call on 3rd)
  // -------------------------------------------------------------------------
  it("Test 5: total fast-retry sleep duration is exactly 60 seconds (2 waits of 30s)", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];
    let callCount = 0;

    const ctx = buildCtx(async () => {
      callCount++;
      // All 3 fast retries fail, succeed immediately on first delay retry
      if (callCount <= 3) {
        throw new Error("failing");
      }
      return {
        colorIndex: 0,
        colorName: "Red",
        shade: 50,
        warmth: 50,
        reasoning: "red",
        vrfResolved: false as false,
      };
    }, sleepDurations, alertCalls);

    await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    const fastRetryTotal = sleepDurations
      .filter((d) => d === 30_000)
      .reduce((sum, d) => sum + d, 0);

    expect(fastRetryTotal).to.equal(60_000); // exactly 2 x 30,000ms = 60s
    expect(callCount).to.equal(4); // 3 fast fails + 1 delay success
  });

  // -------------------------------------------------------------------------
  // Test 6: Alert is sent when entering retry warning state
  // -------------------------------------------------------------------------
  it("Test 6: alert is sent when entering retry warning (delay) state", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];
    let callCount = 0;

    // All 3 fast retries fail, then succeed on first delay attempt
    const ctx = buildCtx(async () => {
      callCount++;
      if (callCount <= 3) throw new Error("fail");
      return {
        colorIndex: 2,
        colorName: "Yellow",
        shade: 50,
        warmth: 50,
        reasoning: "yellow",
        vrfResolved: false as false,
      };
    }, sleepDurations, alertCalls);

    await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    // retryWarning must be in alertCalls (and must appear before vrfFallback if both)
    expect(alertCalls).to.include("retryWarning");
    expect(alertCalls).to.not.include("vrfFallback"); // No VRF needed
  });

  // -------------------------------------------------------------------------
  // Test 7: Alert is sent when VRF fallback is triggered
  // -------------------------------------------------------------------------
  it("Test 7: alert is sent when VRF fallback is triggered", async () => {
    const sleepDurations: number[] = [];
    const alertCalls: string[] = [];

    // All 9 attempts fail
    const ctx = buildCtx(async () => {
      throw new Error("always fail");
    }, sleepDurations, alertCalls);

    await callClaudeWithFallback(ctx, "sys", "user", 1, 0);

    expect(alertCalls).to.include("retryWarning");
    expect(alertCalls).to.include("vrfFallback");
    // retryWarning should come before vrfFallback
    const retryIdx = alertCalls.indexOf("retryWarning");
    const vrfIdx = alertCalls.indexOf("vrfFallback");
    expect(retryIdx).to.be.lessThan(vrfIdx);
  });
});
