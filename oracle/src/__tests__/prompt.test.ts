/**
 * Unit tests for prompt construction module (prompt.ts)
 * TDD: These tests are written before the implementation.
 */

import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import { PixelData, RoundHistoryEntry } from "../types";

// Import under test
import {
  buildSystemPrompt,
  buildUserMessage,
  buildFullPrompt,
  hashPrompt,
} from "../prompt";

describe("buildSystemPrompt", () => {
  it("Test 1: with empty season style summary produces prompt without style section", () => {
    const result = buildSystemPrompt(10, 10, "");
    expect(result).to.include("10x10");
    // With empty season style summary, the placeholder line becomes empty
    // so there should be no substantive season style content beyond the template structure
    expect(result).to.include("abstract artist");
    expect(result).to.include("COLOR: [color name]");
  });

  it("Test 2: with non-empty season style summary includes it in the prompt", () => {
    const styleSummary = "oceanic with volcanic interruptions";
    const result = buildSystemPrompt(10, 10, styleSummary);
    expect(result).to.include("oceanic with volcanic interruptions");
  });

  it("Test 11: injects season style summary when SEASON_STYLE_SUMMARY is non-empty (ORC-11)", () => {
    const styleSummary = "baroque flourishes with neon accents";
    const result = buildSystemPrompt(20, 20, styleSummary);
    expect(result).to.include("baroque flourishes with neon accents");
    expect(result).to.include("20x20");
  });
});

describe("buildUserMessage", () => {
  const emptyCanvas: PixelData[] = [];

  it("Test 3: with empty canvas produces 'No pixels filled yet' and 'No previous selections'", () => {
    const result = buildUserMessage(emptyCanvas, 0, 0, 10, 10, []);
    expect(result).to.include("No pixels filled yet.");
    expect(result).to.include("No previous selections.");
    expect(result).to.include("Current pixel to paint: (0, 0)");
  });

  it("Test 4: with 3 filled pixels includes all in canvas state section", () => {
    const canvas: PixelData[] = [
      { x: 0, y: 0, color: "Red", shade: 50, warmth: 50 },
      { x: 1, y: 0, color: "Blue", shade: 30, warmth: 70 },
      { x: 2, y: 0, color: "Green", shade: 80, warmth: 20 },
    ];
    const result = buildUserMessage(canvas, 5, 5, 10, 10, []);
    expect(result).to.include("(0, 0): Red");
    expect(result).to.include("(1, 0): Blue");
    expect(result).to.include("(2, 0): Green");
  });

  it("Test 5: correctly identifies neighbors (adjacent pixels) for a center pixel", () => {
    // Center pixel at (2, 2), place some neighbors
    const canvas: PixelData[] = [
      { x: 2, y: 1, color: "Red", shade: 50, warmth: 50 },   // above
      { x: 1, y: 2, color: "Blue", shade: 30, warmth: 70 },  // left
      { x: 3, y: 3, color: "Green", shade: 80, warmth: 20 }, // diagonal down-right
    ];
    const result = buildUserMessage(canvas, 2, 2, 10, 10, []);
    // Should list filled neighbors
    expect(result).to.include("(2, 1): Red");
    expect(result).to.include("(1, 2): Blue");
    expect(result).to.include("(3, 3): Green");
    // Unfilled neighbors should be "empty"
    expect(result).to.include("empty");
  });

  it("Test 6: includes last 5 round history entries with reasoning", () => {
    const history: RoundHistoryEntry[] = [
      { pixelIndex: 0, x: 0, y: 0, color: "Red", shade: 50, warmth: 50, reasoning: "First choice" },
      { pixelIndex: 1, x: 1, y: 0, color: "Blue", shade: 30, warmth: 70, reasoning: "Second choice" },
      { pixelIndex: 2, x: 2, y: 0, color: "Green", shade: 80, warmth: 20, reasoning: "Third choice" },
      { pixelIndex: 3, x: 3, y: 0, color: "Yellow", shade: 60, warmth: 60, reasoning: "Fourth choice" },
      { pixelIndex: 4, x: 4, y: 0, color: "Purple", shade: 40, warmth: 40, reasoning: "Fifth choice" },
    ];
    const result = buildUserMessage(emptyCanvas, 5, 0, 10, 10, history);
    expect(result).to.include("First choice");
    expect(result).to.include("Second choice");
    expect(result).to.include("Third choice");
    expect(result).to.include("Fourth choice");
    expect(result).to.include("Fifth choice");
    // Should NOT include "No previous selections" since we have history
    expect(result).to.not.include("No previous selections.");
  });

  it("Test 7: with only 2 history entries shows just those 2 (no padding)", () => {
    const history: RoundHistoryEntry[] = [
      { pixelIndex: 0, x: 0, y: 0, color: "Red", shade: 50, warmth: 50, reasoning: "Entry one" },
      { pixelIndex: 1, x: 1, y: 0, color: "Blue", shade: 30, warmth: 70, reasoning: "Entry two" },
    ];
    const result = buildUserMessage(emptyCanvas, 2, 0, 10, 10, history);
    expect(result).to.include("Entry one");
    expect(result).to.include("Entry two");
    // Verify numbering: should have 1. and 2. but not 3.
    const lines = result.split("\n");
    const historyLines = lines.filter(l => l.match(/^\d+\./));
    expect(historyLines.length).to.equal(2);
  });
});

describe("buildFullPrompt", () => {
  it("Test 10: concatenates system + user with double newline separator", () => {
    const system = "System prompt here";
    const user = "User message here";
    const result = buildFullPrompt(system, user);
    expect(result).to.equal("System prompt here\n\nUser message here");
  });
});

describe("hashPrompt", () => {
  it("Test 8: produces consistent 32-byte SHA-256 hash for same input", () => {
    const prompt = "test prompt string";
    const hash1 = hashPrompt(prompt);
    const hash2 = hashPrompt(prompt);
    expect(hash1).to.be.instanceOf(Buffer);
    expect(hash1.length).to.equal(32);
    expect(hash1.equals(hash2)).to.be.true;
  });

  it("Test 9: produces different hashes for different inputs", () => {
    const hash1 = hashPrompt("input one");
    const hash2 = hashPrompt("input two");
    expect(hash1.equals(hash2)).to.be.false;
  });
});
