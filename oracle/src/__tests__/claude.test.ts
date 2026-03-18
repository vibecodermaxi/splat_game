/**
 * Unit tests for Claude API client module (claude.ts)
 * TDD: These tests are written before the implementation.
 *
 * Tests cover parseClaudeResponse and validateClaudeResult only.
 * callClaude is not unit-tested here (requires API key — integration concern).
 */

import { expect } from "chai";
import { ClaudeResult } from "../types";

// Import under test
import { parseClaudeResponse, validateClaudeResult } from "../claude";

describe("parseClaudeResponse", () => {
  it("Test 1: extracts COLOR, SHADE, WARMTH, REASONING from valid response", () => {
    const raw = `COLOR: Blue
SHADE: 50
WARMTH: 70
REASONING: Blue creates a calming focal point in the upper quadrant.`;
    const result = parseClaudeResponse(raw);
    expect(result).to.not.be.null;
    expect(result!.colorIndex).to.equal(7); // Blue is index 7
    expect(result!.colorName).to.equal("Blue");
    expect(result!.shade).to.equal(50);
    expect(result!.warmth).to.equal(70);
    expect(result!.reasoning).to.equal("Blue creates a calming focal point in the upper quadrant.");
  });

  it("Test 2: handles response with preamble text before structured fields", () => {
    const raw = `Looking at the canvas, I see a great opportunity for contrast.

COLOR: Red
SHADE: 80
WARMTH: 90
REASONING: A vibrant red anchor draws the eye to this corner.`;
    const result = parseClaudeResponse(raw);
    expect(result).to.not.be.null;
    expect(result!.colorIndex).to.equal(0); // Red is index 0
    expect(result!.colorName).to.equal("Red");
    expect(result!.shade).to.equal(80);
    expect(result!.warmth).to.equal(90);
  });

  it("Test 3: returns null for response missing COLOR field", () => {
    const raw = `SHADE: 50
WARMTH: 70
REASONING: Missing the color field.`;
    const result = parseClaudeResponse(raw);
    expect(result).to.be.null;
  });

  it("Test 4: returns null for response missing REASONING field", () => {
    const raw = `COLOR: Blue
SHADE: 50
WARMTH: 70`;
    const result = parseClaudeResponse(raw);
    expect(result).to.be.null;
  });

  it("Test 9: handles multi-line REASONING (takes only first line after REASONING:)", () => {
    const raw = `COLOR: Green
SHADE: 40
WARMTH: 30
REASONING: The first reasoning line.
This is a continuation that should be ignored.
And another continuation.`;
    const result = parseClaudeResponse(raw);
    expect(result).to.not.be.null;
    expect(result!.reasoning).to.equal("The first reasoning line.");
    expect(result!.reasoning).to.not.include("continuation");
  });

  it("Test 10: maps color name to correct index (Blue -> 7, Red -> 0, White -> 15)", () => {
    const blueRaw = `COLOR: Blue\nSHADE: 50\nWARMTH: 50\nREASONING: Test.`;
    const redRaw = `COLOR: Red\nSHADE: 50\nWARMTH: 50\nREASONING: Test.`;
    const whiteRaw = `COLOR: White\nSHADE: 50\nWARMTH: 50\nREASONING: Test.`;

    expect(parseClaudeResponse(blueRaw)!.colorIndex).to.equal(7);
    expect(parseClaudeResponse(redRaw)!.colorIndex).to.equal(0);
    expect(parseClaudeResponse(whiteRaw)!.colorIndex).to.equal(15);
  });

  it("Test 11: returns null for unrecognized color name (e.g., 'Turquoise')", () => {
    const raw = `COLOR: Turquoise
SHADE: 50
WARMTH: 50
REASONING: This color is not in the palette.`;
    const result = parseClaudeResponse(raw);
    expect(result).to.be.null;
  });
});

describe("validateClaudeResult", () => {
  const validBase: ClaudeResult = {
    colorIndex: 7,
    colorName: "Blue",
    shade: 50,
    warmth: 50,
    reasoning: "Valid test result.",
  };

  it("Test 8: accepts valid result { colorIndex: 7, shade: 50, warmth: 50 }", () => {
    expect(validateClaudeResult(validBase)).to.be.true;
  });

  it("Test 5: rejects colorIndex outside 0-15 (e.g., 16)", () => {
    const invalid = { ...validBase, colorIndex: 16 };
    expect(validateClaudeResult(invalid)).to.be.false;
  });

  it("Test 5b: rejects colorIndex below 0 (e.g., -1)", () => {
    const invalid = { ...validBase, colorIndex: -1 };
    expect(validateClaudeResult(invalid)).to.be.false;
  });

  it("Test 6: rejects shade outside 0-100 (e.g., 101)", () => {
    const invalid = { ...validBase, shade: 101 };
    expect(validateClaudeResult(invalid)).to.be.false;
  });

  it("Test 6b: rejects shade below 0 (e.g., -1)", () => {
    const invalid = { ...validBase, shade: -1 };
    expect(validateClaudeResult(invalid)).to.be.false;
  });

  it("Test 7: rejects warmth outside 0-100 (e.g., 101)", () => {
    const invalid = { ...validBase, warmth: 101 };
    expect(validateClaudeResult(invalid)).to.be.false;
  });

  it("Test 7b: rejects warmth below 0 (e.g., -1)", () => {
    const invalid = { ...validBase, warmth: -1 };
    expect(validateClaudeResult(invalid)).to.be.false;
  });
});
