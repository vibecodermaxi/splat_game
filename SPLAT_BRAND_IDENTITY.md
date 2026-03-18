# Splat — Brand Identity

## Name

**Splat.** One syllable. A color hitting a canvas. The sound of impact, of commitment, of fun.

"Splat" works as both noun and verb. Players don't "place bets" — they splat. The game doesn't "resolve rounds" — it splats. Every interaction is a splat. This single word carries the entire brand voice.

## Tagline

**"Bet the canvas."**

Three words. Communicates the entire game in one breath. Alternative taglines for specific contexts:
- Hero/landing: "Bet the canvas."
- Social/sharing: "An AI is painting. Can you predict what comes next?"
- Degen context: "16 colors. 30 minutes. How lucky are you?"

---

## Logo

### Wordmark

The primary logo is "SPLAT" in Fredoka One, all caps. The word sits next to or below the **splat mark** — an asymmetric cluster of overlapping colored circles suggesting paint impact.

The splat mark is always composed of exactly 6 circles using 5 brand colors (Pink, Cyan, Yellow, Purple, Orange, Green — one dominant, five satellite). The dominant circle is always Splat Pink (#FF3B6F) and the largest. The arrangement is intentionally uneven — this is a splat, not a pattern.

### App Icon

The splat mark inside a rounded rectangle with the Void background (#14141F). The mark is centered but the circles themselves are off-center — the visual weight sits slightly upper-left.

### Logo Usage Rules

- Minimum clear space: 1x the height of the "S" in SPLAT on all sides
- The splat mark always appears to the left of or above the wordmark, never to the right or below
- Never rotate, stretch, or rearrange the circles in the splat mark
- On dark backgrounds: white wordmark + full color mark
- On light backgrounds: Void (#14141F) wordmark + full color mark
- Never place the logo on a busy or multicolored background

---

## Color System

### Brand Colors (UI Chrome)

These are the colors used for the UI — buttons, accents, badges, highlights. They are deliberately vivid and saturated. This is a game, not a dashboard.

| Name | Hex | Usage |
|------|-----|-------|
| Splat Pink | #FF3B6F | Primary accent, CTA buttons, logo dominant, win states |
| Splat Cyan | #3BDBFF | Timer, countdown, secondary accent, info states |
| Splat Yellow | #FFD93B | Warnings, highlights, streak indicators |
| Splat Purple | #A83BFF | Multiplier badges, special events, jackpot references |
| Splat Orange | #FF6B3B | Secondary CTA, gradient partner with Pink |
| Splat Green | #3BFF8A | Success states, claim buttons, correct prediction |
| Void | #14141F | Primary background |
| Surface | #1E1E2E | Cards, panels, input backgrounds |
| Muted | #2A2A3E | Borders, dividers, unfilled pixels |

### Game Colors (The 16 Betting Outcomes)

These are the 16 colors the AI selects from. They are separate from the brand palette. On the game screen, they appear as-is inside the canvas grid and as swatches in the betting panel. They should never be modified or filtered for the UI — their exact hex values are canonical.

See SPEC.md for the full 16-color table with hex values.

### Gradient Usage

Gradients are reserved for primary action buttons only. Two approved gradients:

- **Primary CTA (bet/splat):** linear-gradient(135deg, #FF3B6F, #FF6B3B) — Pink to Orange
- **Claim/win:** linear-gradient(135deg, #3BDBFF, #A83BFF) — Cyan to Purple

All other UI elements use solid colors. Backgrounds are always solid Void or Surface. Never use gradients on backgrounds, cards, or decorative elements.

---

## Typography

### Font Stack

| Role | Font | Weight | Size Range |
|------|------|--------|------------|
| Display / Logo / Headings / Buttons | Fredoka One | 700 (Bold) | 16px – 64px |
| Subheadings / Stats / Multipliers | Nunito | 700 (Bold) | 14px – 28px |
| Body / UI text / Docs | Nunito | 400 (Regular) | 13px – 16px |
| Monospace (addresses, hashes) | JetBrains Mono | 400 | 12px – 14px |

### Why Fredoka One

Fredoka is round, chunky, and immediately reads as "game." It has the visual weight of an arcade title without being retro or pixel-art coded. Paired with Nunito (which shares its rounded terminals), the combination feels cohesive — playful but legible.

### Typography Rules

- All button text is uppercase Fredoka One with 0.5px letter-spacing
- All body text is sentence case Nunito
- Numbers (SOL amounts, multipliers, percentages) are Nunito Bold, slightly larger than surrounding text
- The timer countdown uses Nunito Bold at 1.5x body size with Splat Cyan color
- Never use more than two font sizes in a single UI component
- Minimum font size anywhere in the UI: 12px

---

## UI Design Language

### Overall Aesthetic

Dark, vivid, chunky. The background is nearly black (Void), making the colorful canvas and UI elements pop with maximum contrast. Every interactive element is oversized and tactile — this is designed for thumbs on phones.

### Key Principles

1. **The canvas is the hero.** Every UI decision serves the canvas. Chrome recedes. The grid is always the largest element on screen.
2. **Big, dumb buttons.** CTA buttons are 44px minimum height, full-width on mobile, with clear labels in Fredoka. "SPLAT IT!" not "Place Bet." "CLAIM 2.4 SOL" not "Withdraw Winnings."
3. **Color means something.** Pink = action. Cyan = time/info. Green = success/win. Yellow = warning. Purple = special. Don't use color decoratively — it always communicates state.
4. **Motion is juice.** Every interaction has feedback. See Animation section.

### Corner Radius

Everything is rounded. This is a game, not a terminal.

- Buttons: 10–12px
- Cards/panels: 12–16px
- Small elements (badges, pills, color swatches): 4–8px
- Canvas pixels: 4px (subtle rounding, not circles)
- Never use sharp corners (0px radius) anywhere

### Spacing

- Component padding: 16–20px
- Gap between elements: 8–12px
- Section spacing: 24–32px
- Canvas pixel gap: 3px (the dark gap between pixels is part of the aesthetic)

### Cards & Panels

- Background: Surface (#1E1E2E)
- Border: none (color contrast with Void is sufficient) or 0.5px #333 if needed for definition
- Border-radius: 12–16px
- Never use drop shadows. Depth comes from color contrast only.

### Input Fields

- Background: Surface (#1E1E2E)
- Border: 0.5px solid #333, changing to 0.5px solid Splat Pink on focus
- Border-radius: 10px
- Height: 40–44px
- Text: Nunito Regular, white

---

## Animation & Motion

Motion is critical to the Splat identity. Every interaction should feel responsive, satisfying, and slightly over-the-top. Use Framer Motion in the Next.js frontend.

### Core Animations

**Bet placed (the "splat")**
When a player confirms a bet, the selected color swatch briefly scales up (1.0 → 1.2 → 1.0, 300ms) with a subtle radial burst of the selected color behind it. The pool bar for that color smoothly extends. This is the game's signature moment — it should feel like pressing a big satisfying button.

**Countdown tick (final 30 seconds)**
The timer text subtly shakes (translateX ±1px, random, 100ms per tick). In the final 10 seconds, each tick increases in intensity. At lockout (2 min remaining), the timer flashes Splat Yellow once.

**Round resolution (the "reveal")**
The active pixel on the canvas floods with the winning color from center outward (200ms). A brief glow (box-shadow pulse, 0 → 12px → 0, the winning color at 50% opacity, 500ms). If the player won, a particle burst (6-8 small circles in random brand colors) explodes from the pixel (400ms, ease-out, fade).

**Win notification**
Slides in from the bottom. Green background (#3BFF8A at 15% opacity). "+0.47 SOL" text counts up from 0 (number ticker animation, 600ms). Persists for 4 seconds, then slides out.

**Loss notification**
Minimal. The pixel resolves normally. A small text appears below the betting panel: "It was Yellow. Next one?" in muted text. Fades in and out (300ms in, 2s hold, 300ms out). Losses should feel light, not punishing.

**Canvas fill (ongoing)**
Each resolved pixel has a very subtle entry animation — a quick fade-in (150ms) as it transitions from the empty state to its final color. This makes the canvas feel alive, like it's being painted.

**Season completion**
When the final pixel resolves, the entire canvas scales up slightly (1.0 → 1.05, 500ms) and a confetti burst fills the screen for 2 seconds. The UI chrome fades out, leaving only the canvas centered on a Void background. "Season X Complete" fades in below in Fredoka One.

### Animation Rules

- All animations use ease-out or spring curves. Never linear. Never ease-in (feels sluggish).
- Maximum animation duration: 600ms for UI elements, 2s for celebrations
- No animation should block interaction. If something is animating, the player can still tap other things.
- Reduce motion: respect `prefers-reduced-motion`. With reduced motion, replace all animations with instant state changes (opacity 0 → 1, no transforms).

---

## Voice & Tone

### Personality

Splat talks like a fun, slightly cheeky game narrator. Not a crypto bro. Not a formal platform. Think: the voice that appears in a loading screen tooltip, or a board game rulebook that actually wants you to laugh.

### Writing Rules

1. **Short sentences.** Max 15 words for UI copy. If it doesn't fit in a button or a toast notification, it's too long.
2. **Active voice.** "You won 0.47 SOL" not "0.47 SOL has been credited to your account."
3. **Use "splat" as a verb.** "Splat a color" not "Place a bet." "You splatted Blue" not "Your bet was placed on Blue."
4. **Celebrate wins loudly, dismiss losses lightly.** Wins get exclamation marks and specific numbers. Losses get a shrug and a redirect to the next round.
5. **Never sound like a bank.** No "transaction confirmed," no "processing your request," no "please wait." Instead: "Splatted!" "Done." "You're in."
6. **Crypto terminology is minimal.** Say "SOL" not "Solana tokens." Say "connect wallet" but never "sign transaction" in the UI (handle signing silently). The docs can go deeper, but the game UI should be understandable by someone who has never used crypto.

### Example Copy

| Context | Copy |
|---------|------|
| CTA button | SPLAT IT! |
| Bet confirmed | Splatted! You're on Blue. |
| Win | SPLAT! You nailed it. +0.47 SOL |
| Loss | Splat. It was Yellow. Next one? |
| Claim button | CLAIM 2.4 SOL |
| Round starting | Pixel (3,7) is up. 30 minutes on the clock. |
| Countdown warning | 2 minutes. Last chance to splat. |
| Bets locked | Locked. The AI is thinking... |
| Season complete | The AI dropped its masterpiece. Season 4 starts in 11h. |
| Empty state (no bets) | Pick a pixel. Pick a color. Splat. |
| How to play (hero) | An AI paints a canvas. You bet on every pixel. |
| Jackpot teaser | Jackpot pool: 203 SOL. Coming soon. |

---

## Docs Site Design

The docs site matches the game's visual identity but is slightly more subdued for readability.

- Background: Void (#14141F)
- Text: #E0E0E0 (slightly off-white for reduced glare)
- Headings: Fredoka One, white
- Body: Nunito Regular, 16px, 1.6 line-height
- Code/addresses: JetBrains Mono, 14px, Surface background with 0.5px border
- Links: Splat Cyan (#3BDBFF), no underline, underline on hover
- Max content width: 680px, centered
- Sections separated by 48px vertical spacing
- No sidebar navigation — single scrollable page with anchor links at top

---

## Social & Sharing

### Share Image (Season Complete)

Generated PNG when a player shares a completed canvas:
- 1200×630px (Twitter card size)
- Void background
- Canvas rendered at center, ~400×400px
- "SPLAT" wordmark + splat mark top-left
- "Season X" label top-right in Nunito Bold, Splat Cyan
- Bottom bar: "splat.gg" (or domain) in Nunito, muted gray

### Twitter/X Profile

- Avatar: Splat mark (the colored circles) on Void background
- Banner: A completed canvas from a recent season, stretched to banner dimensions with Void fade on edges
- Bio: "An AI paints. You bet. 🎨" (one of the rare emoji-approved contexts)
- Pinned tweet: Animated GIF of a canvas being painted pixel by pixel (30-second timelapse)

---

## File Naming & Assets

All brand assets follow this naming convention:

```
splat-logo-full-dark.svg        # Full logo (mark + wordmark) on dark bg
splat-logo-full-light.svg       # Full logo on light bg
splat-mark.svg                  # Splat mark only
splat-icon-rounded.svg          # App icon (mark in rounded rect)
splat-share-season-{n}.png      # Season completion share image
splat-og.png                    # Default Open Graph image
```

---

## Quick Reference

| Element | Value |
|---------|-------|
| Primary font | Fredoka One (display), Nunito (body) |
| Primary accent | #FF3B6F (Splat Pink) |
| Background | #14141F (Void) |
| Surface | #1E1E2E |
| CTA gradient | 135deg, #FF3B6F → #FF6B3B |
| Win gradient | 135deg, #3BDBFF → #A83BFF |
| Corner radius | 10–16px (buttons/cards), 4px (pixels) |
| Min button height | 44px |
| Body text size | 14–16px |
| Animation curve | ease-out or spring |
| Max animation length | 600ms (UI), 2s (celebrations) |
| Tagline | "Bet the canvas." |
| Bet action word | "Splat" |
