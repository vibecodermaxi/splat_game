/**
 * Claude API client for the Pixel Predict oracle service.
 *
 * Provides:
 * - parseClaudeResponse: line-by-line regex parsing of structured Claude output
 * - validateClaudeResult: range checks on colorIndex, shade, warmth
 * - callClaude: API call at temperature 0 with parse + validate pipeline
 *
 * Model: claude-sonnet-4-6 (locked decision per CONTEXT.md — Sonnet for art quality)
 * Temperature: 0.4 (slight variance for artistic diversity; commit-reveal still holds
 *   because the prompt hash is committed before Claude is called — the hash proves
 *   the input was locked, not that the output is deterministic)
 */

import Anthropic from "@anthropic-ai/sdk";
import { ClaudeResult, COLOR_NAMES } from "./types";
import { logger } from "./logger";

/**
 * Parse a raw Claude response string into a ClaudeResult.
 *
 * Uses line-by-line regex matching (not positional parsing) per RESEARCH pitfall #3.
 * Handles preamble text before the structured fields.
 * Takes only the first match for REASONING (ignores continuation lines).
 *
 * @param raw Raw response text from Claude API
 * @returns Parsed ClaudeResult, or null if any required field is missing or color is unrecognized
 */
export function parseClaudeResponse(raw: string): ClaudeResult | null {
  const colorMatch = raw.match(/^COLOR:\s*(.+)$/m);
  const reasoningMatch = raw.match(/^REASONING:\s*(.+)$/m);

  if (!colorMatch || !reasoningMatch) {
    return null;
  }

  const colorName = colorMatch[1].trim();
  const colorIndex = COLOR_NAMES.indexOf(colorName);
  if (colorIndex === -1) {
    return null;
  }

  const reasoning = reasoningMatch[1].trim();

  // Shade and warmth are always neutral (50) — on-chain fields kept for compatibility
  return {
    colorIndex,
    colorName,
    shade: 50,
    warmth: 50,
    reasoning,
  };
}

/**
 * v2 active palette: Claude may only pick from these 8 indices out of the
 * 16-item COLOR_NAMES array. Any other color is rejected by validation.
 *
 * Indices: Red=0, Orange=1, Yellow=2, Green=4, Blue=7, Purple=9, Black=14, White=15
 */
export const BETTABLE_COLOR_INDICES = new Set([0, 1, 2, 4, 7, 9, 14, 15]);

/**
 * Validate a ClaudeResult to ensure all values are within acceptable ranges
 * AND the colorIndex is one of the 8 bettable colors.
 *
 * @param result The parsed ClaudeResult to validate
 * @returns true if all values are valid, false otherwise
 */
export function validateClaudeResult(result: ClaudeResult): boolean {
  if (result.colorIndex < 0 || result.colorIndex > 15) return false;
  if (!BETTABLE_COLOR_INDICES.has(result.colorIndex)) return false;
  return true;
}

/**
 * Call the Claude API with the given system prompt and user message.
 *
 * Uses:
 * - model: claude-sonnet-4-6 (locked per CONTEXT.md)
 * - temperature: 0.4 (slight variance for artistic diversity)
 * - max_tokens: 256 (structured response is short)
 *
 * Throws if the response cannot be parsed or fails validation.
 * The raw response text is included in the error message for debugging.
 *
 * @param anthropicApiKey Anthropic API key
 * @param systemPrompt    System prompt string
 * @param userMessage     User message string
 * @returns Validated ClaudeResult
 */
export async function callClaude(
  anthropicApiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<ClaudeResult> {
  const model = "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey: anthropicApiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 256,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawContent = response.content[0];
  if (rawContent.type !== "text") {
    throw new Error(
      `callClaude: unexpected content type "${rawContent.type}" in Claude response`
    );
  }
  const rawText = rawContent.text;

  logger.info({
    event: "claude_call",
    model,
    tokens_used: response.usage,
  });

  const parsed = parseClaudeResponse(rawText);
  if (parsed === null) {
    throw new Error(
      `callClaude: failed to parse Claude response. Raw response:\n${rawText}`
    );
  }

  if (!validateClaudeResult(parsed)) {
    throw new Error(
      `callClaude: Claude response failed validation (colorIndex=${parsed.colorIndex}, shade=${parsed.shade}, warmth=${parsed.warmth}). Raw response:\n${rawText}`
    );
  }

  return parsed;
}
