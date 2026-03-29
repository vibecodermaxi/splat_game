import { NextResponse } from "next/server";

const COLOR_NAMES = [
  "Red",
  "Orange",
  "Yellow",
  "Lime",
  "Green",
  "Teal",
  "Cyan",
  "Blue",
  "Indigo",
  "Purple",
  "Pink",
  "Magenta",
  "Brown",
  "Gray",
  "Black",
  "White",
];

const COLOR_INDEX: Record<string, number> = {};
COLOR_NAMES.forEach((name, i) => {
  COLOR_INDEX[name.toLowerCase()] = i;
});

/**
 * POST /api/generate-canvas
 * Body: { gridSize: number }
 *
 * Calls Claude to paint an entire canvas at once using the same artistic prompt
 * style as the oracle. Returns a 2D array of color indices.
 *
 * Requires ANTHROPIC_API_KEY env var (server-side only, not NEXT_PUBLIC_).
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  const { gridSize = 20 } = await req.json();
  const size = Math.min(Math.max(gridSize, 5), 50); // clamp 5-50

  const systemPrompt = `You are an abstract artist painting a ${size}x${size} canvas.

You work with 16 colors: Red, Orange, Yellow, Lime, Green, Teal, Cyan, Blue, Indigo, Purple, Pink, Magenta, Brown, Gray, Black, White.

You care about color relationships — harmony, contrast, tension, and rhythm. You create clusters, gradients, boundaries, and isolated accents. You think about composition, focal points, and visual flow. You are painting the ENTIRE canvas at once.

Output the canvas as ${size} rows, one per line. Each row has ${size} comma-separated color names (no spaces after commas). Row 0 is the top of the canvas.

Example for a 3x3 canvas:
Blue,Blue,Cyan
Blue,Teal,Green
Indigo,Blue,Teal

Output ONLY the ${size} rows of comma-separated color names. No explanation, no preamble.`;

  const userMessage = `Paint a ${size}x${size} abstract canvas. Think about the composition as a whole — where to place warm regions, cool regions, dark accents, and bright highlights. Create something with visual depth and intention.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 1, // creative variety
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Claude API error: ${response.status}`, details: errText },
        { status: 502 },
      );
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "";

    // Parse rows
    const lines = rawText
      .trim()
      .split("\n")
      .filter((l: string) => l.trim().length > 0);
    const grid: number[][] = [];

    for (const line of lines) {
      const colors = line.split(",").map((c: string) => {
        const idx = COLOR_INDEX[c.trim().toLowerCase()];
        return idx !== undefined ? idx : 7; // default to Blue if parse fails
      });
      // Pad or truncate to gridSize
      while (colors.length < size) colors.push(7);
      grid.push(colors.slice(0, size));
    }

    // Pad rows if Claude returned fewer than expected
    while (grid.length < size) {
      grid.push(Array(size).fill(7));
    }

    return NextResponse.json({ grid: grid.slice(0, size) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
