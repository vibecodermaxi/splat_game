import { NextResponse } from "next/server";

/**
 * POST /api/test-pixel
 *
 * Mirrors the oracle's per-pixel Claude call, but with no on-chain side effects.
 * Used by the /canvas-lab test page to experiment with season summary prompts.
 *
 * Body:
 *   canvasPixels: Array<{ x: number, y: number, color: string }>
 *   currentX: number
 *   currentY: number
 *   gridWidth: number
 *   gridHeight: number
 *   history: Array<{ pixelIndex, x, y, color, reasoning }>
 *   seasonStyleSummary: string
 *
 * Returns: { colorIndex, colorName, reasoning } | { error }
 *
 * The prompt structure here is intentionally a near-verbatim copy of
 * oracle/src/prompt.ts and oracle/config/system-prompt.txt — keep them in sync.
 */

// v2 test palette: 8 colors. Drops the in-between hues (Lime, Teal, Cyan,
// Indigo, Pink, Magenta, Brown, Gray) that nobody can distinguish on small
// grids, leaving 6 spectrum colors plus Black/White as anchors.
const COLOR_NAMES = [
  "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Black", "White",
];

const COLOR_ABBREV: Record<string, string> = {
  Red: "R", Orange: "O", Yellow: "Y", Green: "G",
  Blue: "B", Purple: "P", Black: "K", White: "W",
};

interface CanvasPixel {
  x: number;
  y: number;
  color: string;
}

interface HistoryEntry {
  pixelIndex: number;
  x: number;
  y: number;
  color: string;
  reasoning: string;
}

function buildSystemPrompt(
  gridWidth: number,
  gridHeight: number,
  seasonStyleSummary: string,
): string {
  return `You are a pixel artist painting a ${gridWidth}x${gridHeight} canvas, one pixel at a time. Pixels are placed left-to-right, top-to-bottom (row 0, then row 1, etc.).

You work with 8 colors: Red, Orange, Yellow, Green, Blue, Purple, Black, White.

For each pixel, you select one of the 8 colors above.

Your goal is an aesthetically coherent composition — a real painting, not a pattern. Trust your artistic instincts. Think about color harmony, visual balance, where the eye rests, and where it moves. Let colors cluster into shapes rather than scattering evenly.

Study the visible grid map carefully and respond to what is already on the canvas. If a color has started forming a region, continue it until the region feels complete. If the composition needs contrast or a new element, introduce it with intention.

SUBJECT:
${seasonStyleSummary}

Respond in exactly this format and nothing else:
COLOR: [color name]
REASONING: [1-2 sentences about your choice]
`;
}

function buildUserMessage(
  canvasPixels: CanvasPixel[],
  currentX: number,
  currentY: number,
  gridWidth: number,
  gridHeight: number,
  history: HistoryEntry[],
): string {
  const lines: string[] = [];

  const pixelMap = new Map<string, CanvasPixel>();
  for (const p of canvasPixels) {
    pixelMap.set(`${p.x},${p.y}`, p);
  }

  const row = currentY + 1;
  const col = currentX + 1;
  const filledRows = currentY > 0 ? currentY : 0;
  lines.push(
    `Canvas progress: Row ${row} of ${gridHeight}, Column ${col} of ${gridWidth} (${canvasPixels.length} of ${gridWidth * gridHeight} pixels filled).`,
  );
  if (filledRows > 0) {
    lines.push(
      `You have completed ${filledRows} full row${filledRows > 1 ? "s" : ""}.`,
    );
  }
  lines.push("");

  lines.push("Canvas grid (letter = color, . = empty, * = current pixel):");
  lines.push(
    "Key: R=Red O=Orange Y=Yellow G=Green B=Blue P=Purple K=Black W=White",
  );

  const maxRowToRender = Math.min(currentY + 2, gridHeight - 1);
  for (let y = 0; y <= maxRowToRender; y++) {
    let rowStr = "";
    for (let x = 0; x < gridWidth; x++) {
      if (x === currentX && y === currentY) {
        rowStr += "* ";
      } else {
        const p = pixelMap.get(`${x},${y}`);
        rowStr += p ? (COLOR_ABBREV[p.color] ?? "?") + " " : ". ";
      }
    }
    const rowLabel = String(y).padStart(2, " ");
    lines.push(`  ${rowLabel}| ${rowStr.trimEnd()}`);
  }
  if (maxRowToRender < gridHeight - 1) {
    lines.push(`  ... (rows ${maxRowToRender + 1}-${gridHeight - 1} are empty)`);
  }
  lines.push("");

  lines.push(`Current pixel to paint: (${currentX}, ${currentY})`);
  lines.push("");

  lines.push("Neighboring pixels:");
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];
  for (const [dx, dy] of directions) {
    const nx = currentX + dx;
    const ny = currentY + dy;
    if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
    const neighbor = pixelMap.get(`${nx},${ny}`);
    if (neighbor) {
      lines.push(`(${nx}, ${ny}): ${neighbor.color}`);
    } else {
      lines.push(`(${nx}, ${ny}): empty`);
    }
  }
  lines.push("");

  lines.push("Your last 20 selections:");
  const recentHistory = history.slice(-20);
  if (recentHistory.length === 0) {
    lines.push("No previous selections.");
  } else {
    recentHistory.forEach((entry, idx) => {
      lines.push(
        `${idx + 1}. (${entry.x}, ${entry.y}): ${entry.color} - "${entry.reasoning}"`,
      );
    });
  }
  lines.push("");

  lines.push(
    `Select the color for pixel (${currentX}, ${currentY}).`,
  );

  return lines.join("\n");
}

/**
 * Resilient parser that tolerates Claude's formatting variations:
 * - Case-insensitive COLOR:/REASONING: labels (handles "Color:", "color:", etc.)
 * - Strips markdown wrappers (`**Red**`, `*Red*`, `_Red_`, `` `Red` ``)
 * - Strips trailing punctuation (`Red.`, `Red,`)
 * - Fuzzy-matches when Claude wraps in extra words ("vibrant Red", "dark Blue")
 * - Falls back to scanning the whole response for a valid color name
 * - Treats REASONING as optional — returns empty string if missing
 */
function parseClaudeResponse(
  raw: string,
): { colorIndex: number; colorName: string; reasoning: string } | null {
  const stripMarkdown = (s: string): string =>
    s.replace(/[*_`~]/g, "").trim();

  const normalizeColorText = (s: string): string =>
    stripMarkdown(s).replace(/[.,!?;:]+$/, "").trim();

  const matchColorName = (text: string): number => {
    const clean = normalizeColorText(text);
    // Exact match, case-insensitive
    const exactIdx = COLOR_NAMES.findIndex(
      (n) => n.toLowerCase() === clean.toLowerCase(),
    );
    if (exactIdx !== -1) return exactIdx;
    // Contains-a-known-color (e.g. "vibrant Red", "Red (hot)")
    for (let i = 0; i < COLOR_NAMES.length; i++) {
      const re = new RegExp(`\\b${COLOR_NAMES[i]}\\b`, "i");
      if (re.test(clean)) return i;
    }
    return -1;
  };

  // Try to find a labeled COLOR line (case-insensitive, tolerant of markdown prefixes)
  const colorLineMatch = raw.match(/(?:^|\n)\s*(?:\*+\s*)?COLOR\s*:?\s*\*?\s*(.+?)(?:\n|$)/i);
  const reasoningLineMatch = raw.match(/(?:^|\n)\s*(?:\*+\s*)?REASONING\s*:?\s*\*?\s*(.+?)(?:\n|$)/i);

  let colorIndex = -1;
  if (colorLineMatch) {
    colorIndex = matchColorName(colorLineMatch[1]);
  }

  // Fallback: scan the entire response for any valid color name
  if (colorIndex === -1) {
    colorIndex = matchColorName(raw);
  }

  if (colorIndex === -1) return null;

  const reasoning = reasoningLineMatch
    ? stripMarkdown(reasoningLineMatch[1])
    : "(no reasoning provided)";

  return {
    colorIndex,
    colorName: COLOR_NAMES[colorIndex],
    reasoning,
  };
}

/** Single API call + parse attempt. Returns parsed result or null. */
async function callClaudeOnce(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<{
  parsed: { colorIndex: number; colorName: string; reasoning: string } | null;
  rawText: string;
  httpError: string | null;
}> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return {
      parsed: null,
      rawText: "",
      httpError: `Claude API error ${response.status}: ${errText}`,
    };
  }

  const data = await response.json();
  const rawText: string = data.content?.[0]?.text ?? "";
  return {
    parsed: parseClaudeResponse(rawText),
    rawText,
    httpError: null,
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  let body: {
    canvasPixels?: CanvasPixel[];
    currentX?: number;
    currentY?: number;
    gridWidth?: number;
    gridHeight?: number;
    history?: HistoryEntry[];
    seasonStyleSummary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const canvasPixels = body.canvasPixels ?? [];
  const currentX = body.currentX ?? 0;
  const currentY = body.currentY ?? 0;
  const gridWidth = body.gridWidth ?? 20;
  const gridHeight = body.gridHeight ?? 20;
  const history = body.history ?? [];
  const seasonStyleSummary = body.seasonStyleSummary ?? "";

  const systemPrompt = buildSystemPrompt(gridWidth, gridHeight, seasonStyleSummary);
  const userMessage = buildUserMessage(
    canvasPixels,
    currentX,
    currentY,
    gridWidth,
    gridHeight,
    history,
  );

  // Try up to 3 times. On parse failures, append a stricter reminder to the
  // user message so Claude is nudged back to the expected format.
  const MAX_ATTEMPTS = 3;
  let lastRaw = "";
  let lastHttpError: string | null = null;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const attemptMessage =
        attempt === 0
          ? userMessage
          : userMessage +
            `\n\nREMINDER: Your previous response could not be parsed. Respond with EXACTLY this format, nothing else:\nCOLOR: [one of: ${COLOR_NAMES.join(", ")}]\nREASONING: [one short sentence]`;

      const { parsed, rawText, httpError } = await callClaudeOnce(
        apiKey,
        systemPrompt,
        attemptMessage,
      );

      if (parsed) {
        return NextResponse.json(parsed);
      }

      lastRaw = rawText;
      lastHttpError = httpError;
    }

    return NextResponse.json(
      {
        error: lastHttpError ?? "Failed to parse Claude response after 3 attempts",
        raw: lastRaw,
      },
      { status: 502 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
