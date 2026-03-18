# Phase 2: Oracle Service - Research

**Researched:** 2026-03-17
**Domain:** Node.js autonomous process — Anthropic API, Solana/Anchor client, Irys/Arweave uploads, Switchboard VRF, Railway deployment, Telegram notifications
**Confidence:** HIGH (core stack confirmed via official sources); MEDIUM (Irys and Switchboard off-chain SDK patterns — docs inaccessible, derived from search results and existing code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Scheduling model:** in-process node-cron (not Railway native cron — 5-min minimum too slow for 2-min lockout phase)
- **Always-on Railway process** (not serverless/cron)
- **Claude Sonnet model** (not Haiku — better art quality justifies cost)
- **Temperature 0** — non-negotiable, required for commit-reveal verifiability
- **System prompt loaded from config/template file** — operator tweaks without redeploying
- **Season style summary via `SEASON_STYLE_SUMMARY` env var**
- **Response parsing must validate:** color is one of 16, shade 0-100, warmth 0-100
- **REASONING field captured and stored in round_history.json**
- **Arweave upload via Irys (formerly Bundlr)** — instant uploads, pay with SOL, ~$0.001/upload
- **Upload timing:** resolve on-chain first, then upload prompt to Arweave, then write arweave_txid back on-chain in a separate transaction
- **Monitoring via Telegram bot**
- **Alert events:** round resolution failure, VRF fallback triggered, round resolved successfully, process restart
- **Structured JSON logging** — each round = one JSON log entry
- **Failure cascade is strict:** 3 retries at 30s → delay state retrying every 5 min for 30 min → Switchboard VRF fallback
- **round_history.json is the only local state** — reconstructable from chain minus reasoning
- **Oracle keypair stored in `ORACLE_KEYPAIR` env var** (JSON array format)

### Claude's Discretion
- Recovery strategy on process restart (chain state vs local checkpoint)
- N+1 pixel pre-opening logic (always vs skip-on-last-pixel)
- Arweave failure handling approach (retry-then-skip vs block)
- How arweave_txid is written back on-chain (separate instruction or update to PixelState)
- Node.js project structure and module organization
- Error handling patterns and retry backoff curves

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORC-01 | Oracle constructs AI prompt from current canvas state, neighbors, and last 5 selections | SPEC prompt format confirmed; canvas reads all PixelState PDAs for season; round_history.json holds last 5 |
| ORC-02 | Oracle computes SHA-256 hash of prompt and posts it on-chain at round open | Node.js `crypto.createHash('sha256')` built-in; `open_round` instruction takes `[u8; 32]` prompt_hash |
| ORC-03 | Oracle calls Claude API at temperature 0 and parses COLOR, SHADE, WARMTH, REASONING | `@anthropic-ai/sdk` v0.79.0; model `claude-sonnet-4-6`; text response parsing with regex |
| ORC-04 | Oracle validates AI response (color is one of 16, shade/warmth 0-100) | Validation logic against SPEC color table; on-chain program enforces same constraints (errors 6002-6004) |
| ORC-05 | Oracle posts winning color, shade, warmth, and full prompt data on-chain at resolution | `resolve_round` instruction with `winning_color: u8, shade: u8, warmth: u8, vrf_resolved: bool`; prompt stored Arweave |
| ORC-06 | Oracle retries failed API calls 3 times at 30-second intervals | Imperative retry loop with `setTimeout`/`sleep` helper; exponential or fixed 30s delay |
| ORC-07 | Oracle enters delay state on persistent failure, retrying every 5 minutes for 30 minutes | State flag in round loop; node-cron is inappropriate for this — use in-process setInterval/loop with counter |
| ORC-08 | Oracle falls back to VRF resolution after 30 minutes of failure | Switchboard On-Demand off-chain SDK to create randomness account, then call `resolve_round_vrf` |
| ORC-09 | Oracle maintains local round_history.json for prompt construction (last 5 rounds) | `fs/promises` read/write; JSON file; reconstructable from chain (minus reasoning) |
| ORC-10 | Oracle runs as always-on Railway process with in-process scheduler (not Railway cron) | `node-cron` v4.0.0; Railway deployment with `start` script in package.json |
| ORC-11 | Oracle includes season style summary in system prompt starting from Season 2 | `SEASON_STYLE_SUMMARY` env var injected into system prompt template at startup |
</phase_requirements>

---

## Summary

The oracle service is a Node.js TypeScript process running on Railway. Its job is to drive each 30-minute round autonomously: read chain state, construct an AI prompt, hash and commit it on-chain, wait 28 minutes, lock the round, call Claude at temperature 0, resolve on-chain, upload the prompt to Arweave, and write the Arweave txid back on-chain. It never stops — if Claude fails, it retries then falls back to Switchboard VRF.

The core technical challenge is the **failure cascade state machine**: three distinct retry strategies (fast retry, delay-state retry, VRF fallback) that must not lose round state across restarts. The simplest and most robust approach is a single async function that drives each round imperatively — not event-driven — with explicit `await sleep(n)` calls and a persistent state checkpoint for recovery.

**Primary recommendation:** Build an `oracle/` subdirectory in the repo root as a self-contained Node.js TypeScript project with its own `package.json`. Use `@coral-xyz/anchor` for Solana interactions (it's already installed), `@anthropic-ai/sdk` for Claude calls, `@irys/upload-solana` for Arweave uploads, `node-cron` for round timing, and `node-telegram-bot-api` for alerts.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.79.0 | Claude API calls | Official Anthropic TS SDK; supports system prompts, temperature, message format |
| `@coral-xyz/anchor` | 0.32.1 | Solana program interaction | Already in project; IDL-driven TypeScript client for all oracle instructions |
| `@solana/web3.js` | (bundled with anchor) | Keypair loading, connection, PublicKey | Standard Solana JS library |
| `node-cron` | 4.0.0 | Round timing scheduler | In-process cron; supports `*/30 * * * *` expressions; 4.0.0 written in TypeScript |
| `@irys/upload-solana` | latest | Arweave uploads paid with SOL | Irys (formerly Bundlr); dedicated Solana token package; instant uploads ~$0.001 each |
| `node-telegram-bot-api` | latest | Push alert notifications | Minimal, widely used; needs only a bot token and chat ID; no webhook required for outbound-only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@switchboard-xyz/on-demand` | latest | VRF randomness request | ORC-08 fallback path only; needed to create randomness account and trigger fulfillment |
| `typescript` | 5.x | Type safety | Project already uses TypeScript throughout |
| `tsx` or `ts-node` | latest | Run TypeScript directly | Development and Railway deployment without separate build step |
| `dotenv` | latest | Load .env in development | Railway injects env vars natively; dotenv only needed for local dev |
| `crypto` (built-in) | Node.js built-in | SHA-256 prompt hashing | `crypto.createHash('sha256').update(promptText).digest()` — no extra package needed |
| `fs/promises` (built-in) | Node.js built-in | round_history.json read/write | Atomic read/write of local state file |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@irys/upload-solana` | Direct HTTP POST to Bundlr/Irys gateway | Irys SDK handles signing, fee estimation, retry; direct HTTP requires manual implementation |
| `node-cron` | `setInterval` for round timing | node-cron gives cron syntax clarity; setInterval equally valid for fixed intervals — either works |
| `node-telegram-bot-api` | Telegraf | node-telegram-bot-api is lighter for outbound-only notifications; Telegraf better for interactive bots |
| Plain text prompt template | Template engine (Handlebars, etc.) | For a single template, plain string interpolation is sufficient; no template engine needed |

**Installation (oracle subdirectory):**
```bash
npm install @anthropic-ai/sdk @coral-xyz/anchor @solana/web3.js node-cron @irys/upload-solana node-telegram-bot-api @switchboard-xyz/on-demand
npm install -D typescript tsx @types/node @types/node-cron @types/node-telegram-bot-api
```

---

## Architecture Patterns

### Recommended Project Structure
```
oracle/
├── src/
│   ├── index.ts               # Entry point: starts scheduler, handles SIGTERM
│   ├── scheduler.ts           # node-cron setup; calls runRound() every 30 min
│   ├── round.ts               # Core round lifecycle: open → lock → resolve → arweave
│   ├── chain.ts               # Anchor program client: load IDL, send instructions, read accounts
│   ├── prompt.ts              # Prompt construction from canvas state + round_history.json
│   ├── claude.ts              # Claude API calls: system prompt, parse response, validate
│   ├── vrf.ts                 # Switchboard VRF: request randomness, poll, call resolve_round_vrf
│   ├── arweave.ts             # Irys upload: upload prompt text, return txid
│   ├── history.ts             # round_history.json read/write with atomic updates
│   ├── alerts.ts              # Telegram bot notifications
│   ├── logger.ts              # Structured JSON logging per round
│   └── config.ts              # Environment variable loading and validation
├── config/
│   └── system-prompt.txt      # System prompt template (loaded at startup, not hardcoded)
├── round_history.json         # Local state: last 5 rounds (gitignored, reconstructable)
├── package.json
└── tsconfig.json
```

### Pattern 1: Imperative Round State Machine

**What:** Each round runs as a single `async runRound()` function that awaits each step sequentially. No event-driven architecture. The scheduler simply calls `runRound()` on each cron tick and waits for it to complete.

**When to use:** Any time a sequential workflow requires tight control over retry loops and failure state. Avoids callback hell and makes the failure cascade explicit.

**Example:**
```typescript
// round.ts — simplified skeleton
export async function runRound(ctx: OracleContext): Promise<void> {
  const { seasonNumber, pixelIndex } = await ctx.chain.getCurrentPixel();

  // 1. Construct prompt and hash it
  const prompt = await buildPrompt(ctx, seasonNumber, pixelIndex);
  const promptHash = sha256(prompt);

  // 2. Open round on-chain
  await ctx.chain.openRound(pixelIndex, promptHash);
  logger.info({ event: 'round_opened', pixelIndex, promptHash });

  // 3. Wait 28 minutes
  await sleep(BETTING_WINDOW_MS);

  // 4. Lock round
  await ctx.chain.lockRound(seasonNumber, pixelIndex);

  // 5. Wait 2 minutes
  await sleep(2 * 60 * 1000);

  // 6. Call Claude with failure cascade
  const result = await callClaudeWithFallback(ctx, prompt, seasonNumber, pixelIndex);

  // 7. Resolve on-chain
  await ctx.chain.resolveRound(seasonNumber, pixelIndex, result);

  // 8. Upload prompt to Arweave (non-blocking on failure)
  const txid = await uploadPromptToArweave(ctx, prompt).catch(err => {
    logger.warn({ event: 'arweave_upload_failed', err });
    return null;
  });
  if (txid) {
    await ctx.chain.writeArweaveTxid(seasonNumber, pixelIndex, txid);
  }

  // 9. Update round_history.json
  await ctx.history.push({ pixelIndex, ...result });

  logger.info({ event: 'round_resolved', pixelIndex, color: result.color, ... });
  ctx.alerts.sendSuccess(result);
}
```

### Pattern 2: Failure Cascade Implementation

**What:** Three-tier retry strategy implemented as a sequential async function, not a state machine with external events.

**When to use:** Whenever an external service (Claude API) must succeed before proceeding, with escalating fallbacks.

**Example:**
```typescript
// claude.ts — failure cascade
async function callClaudeWithFallback(
  ctx: OracleContext,
  prompt: string,
  seasonNumber: number,
  pixelIndex: number
): Promise<ResolutionResult> {
  // Tier 1: 3 fast retries at 30s
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await callClaude(ctx, prompt);
      return result;
    } catch (err) {
      logger.warn({ event: 'claude_retry', attempt, err });
      if (attempt < 2) await sleep(30_000);
    }
  }

  // Tier 2: delay state — retry every 5 min for 30 min (6 attempts)
  ctx.alerts.sendRetryWarning();
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(5 * 60 * 1000);
    try {
      const result = await callClaude(ctx, prompt);
      return result;
    } catch (err) {
      logger.warn({ event: 'claude_delay_retry', attempt, err });
    }
  }

  // Tier 3: VRF fallback
  ctx.alerts.sendVrfFallback();
  return await resolveViaVrf(ctx, seasonNumber, pixelIndex);
}
```

### Pattern 3: Process Recovery on Restart

**What:** On startup, read chain state to determine whether a round is already in-progress. Resume from the correct step rather than re-opening a round that was already opened.

**When to use:** Always — Railway containers restart on deploy, crash, or OOM.

**Example:**
```typescript
// index.ts — startup recovery
async function startup(ctx: OracleContext): Promise<void> {
  const { currentPixelIndex, status } = await ctx.chain.getSeasonState();
  const pixelState = await ctx.chain.getPixelState(currentPixelIndex).catch(() => null);

  if (pixelState?.status === 'Open') {
    // Round is open — calculate remaining time and resume from lock step
    const elapsed = Date.now() - pixelState.openedAt * 1000;
    const remaining = BETTING_WINDOW_MS - elapsed;
    logger.info({ event: 'process_restart', resuming: 'lock', remainingMs: remaining });
    ctx.alerts.sendProcessRestart();
    if (remaining > 0) await sleep(remaining);
    await resumeFromLock(ctx, currentPixelIndex);
  } else if (pixelState?.status === 'Locked') {
    // Round is locked — resume from Claude call
    logger.info({ event: 'process_restart', resuming: 'resolve' });
    ctx.alerts.sendProcessRestart();
    await resumeFromResolve(ctx, currentPixelIndex);
  } else {
    // No in-progress round — start normally
    runScheduler(ctx);
  }
}
```

### Pattern 4: Structured JSON Logging

**What:** Each round produces one JSON log entry with all fields. Railway log search can then filter by `event`, `pixelIndex`, `color`, etc.

**Example:**
```typescript
// Per-round log entry
logger.info({
  event: 'round_resolved',
  season: 1,
  pixelIndex: 42,
  x: 2,
  y: 4,
  color: 'Blue',
  shade: 72,
  warmth: 23,
  poolSizeLamports: 5_000_000_000,
  vrfResolved: false,
  arweaveTxid: 'abc123...',
  durationMs: 1_823_000
});
```

### Anti-Patterns to Avoid

- **Using Railway native cron:** Railway's minimum cron interval is 5 minutes. The oracle needs sub-minute control over lockout timing. Use `node-cron` inside the always-on process.
- **Stateless per-invocation design:** If the oracle restarts mid-round, a stateless design would either skip the round or double-open. Always check chain state on startup.
- **Calling `resolve_round` without locking first:** The Anchor program validates `status == Locked`. The oracle must call `lock_round` and wait for confirmation before calling `resolve_round`.
- **Blocking the main thread during sleep:** Use `await sleep(ms)` with a Promise wrapper, not synchronous blocking. `node-cron` callbacks are async — the scheduler is not blocked while a round runs.
- **Hardcoding the system prompt:** The system prompt must be loaded from `config/system-prompt.txt` at startup. Operators tweak artistic direction between seasons without redeploying.
- **Sending bet pool data to Claude:** AI must NOT receive bet volumes, popular colors, win rates, or odds. This is a spec requirement for fairness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hashing | Custom hash implementation | Node.js `crypto` built-in | Standard, zero-dependency, well-tested |
| Arweave uploads | Direct HTTP to Arweave gateway | `@irys/upload-solana` | Irys handles bundling, signing, fee estimation, retries, instant finality |
| Telegram notifications | Raw HTTP calls to Telegram API | `node-telegram-bot-api` | Handles auth, retry, rate limiting |
| Anchor instruction building | Manual transaction serialization | `@coral-xyz/anchor` IDL client | IDL already exists at `target/idl/pixel_predict.json` |
| Cron scheduling | `setInterval` with drift | `node-cron` | node-cron handles DST, missed executions, timezone support |
| VRF randomness | Custom oracle-generated random | Switchboard On-Demand | On-chain verifiability; `resolve_round_vrf` already validates Switchboard account ownership |

**Key insight:** The oracle is thin orchestration code — all complex logic lives either in the Anchor program (on-chain) or in well-maintained libraries. The oracle's value is the state machine, not the cryptographic or network primitives.

---

## Common Pitfalls

### Pitfall 1: Calling `resolve_round` Without Confirming `lock_round` Succeeded

**What goes wrong:** If `lock_round` fails (network error, already locked by another caller), the oracle still has an open round. Calling `resolve_round` on an Open-status pixel gets `RoundNotLocked` (error 6009).

**Why it happens:** `lock_round` is permissionless — anyone can call it. The oracle might race with an external crank.

**How to avoid:** Before calling `resolve_round`, fetch the PixelState and check `status`. If already Locked, skip calling `lock_round` and proceed. If still Open and window has elapsed, call `lock_round`.

**Warning signs:** `RoundNotLocked` errors in logs.

### Pitfall 2: Prompt Hash Mismatch at Verification

**What goes wrong:** The oracle hashes the prompt string and commits it on-chain. Later, the published prompt hashes differently because of encoding or normalization differences.

**Why it happens:** JavaScript strings can have different line endings (`\r\n` vs `\n`), UTF-8 encoding issues, or trailing whitespace.

**How to avoid:** Always hash the prompt as a UTF-8 Buffer before committing: `Buffer.from(promptText, 'utf8')`. Store the exact bytes that were hashed in `round_history.json` and in the Arweave upload. Never post-process the prompt string after computing the hash.

### Pitfall 3: Claude API Returns Extra Text Before/After Structured Response

**What goes wrong:** Claude sometimes adds preamble ("Sure! Here is my selection:") before the structured `COLOR: / SHADE: / WARMTH: / REASONING:` block, especially at temperature 0 if the system prompt is not strict enough.

**Why it happens:** Even at temperature 0, Claude may include courteous framing unless instructed otherwise.

**How to avoid:** System prompt already says "Respond in exactly this format and nothing else." Parse with line-by-line regex rather than strict positional parsing. If any field is missing, treat as parse failure and trigger the retry cascade.

**Warning signs:** `InvalidColor` (6002), `InvalidShade` (6003), or `InvalidWarmth` (6004) on-chain errors indicate a bad parse that slipped through validation.

### Pitfall 4: Arweave Upload Blocking Round Timing

**What goes wrong:** Arweave/Irys upload takes longer than expected, delaying the next round open by minutes.

**Why it happens:** Irys uploads are "instant" but still require network I/O. If the Irys gateway is slow or rate-limited, the upload can block the round loop.

**How to avoid:** The upload runs after `resolve_round` — the betting result is already settled on-chain. Use `Promise.race` with a timeout (e.g. 60 seconds) and skip the arweave_txid write-back if it times out. Log a warning and move on.

### Pitfall 5: round_history.json Corrupt on Crash

**What goes wrong:** Oracle crashes mid-write to `round_history.json`, leaving a truncated or invalid JSON file. On restart, JSON.parse throws and the oracle crashes again in a boot loop.

**Why it happens:** Node.js `fs.writeFile` is not atomic by default — a process kill mid-write produces a partial file.

**How to avoid:** Write to a temp file then rename: `fs.writeFile(path + '.tmp', data)` then `fs.rename(path + '.tmp', path)`. This is atomic on Linux (Railway container). Wrap all reads in try/catch with fallback to empty array if parse fails.

### Pitfall 6: oracle Keypair Format

**What goes wrong:** `ORACLE_KEYPAIR` env var is a JSON array (e.g. `[1,2,3,...,64 numbers]`). Loading it with `Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.ORACLE_KEYPAIR)))` works, but if the env var has extra whitespace or quotes, `JSON.parse` throws.

**Why it happens:** Railway dashboard or shell escaping may add unwanted characters to the env var value.

**How to avoid:** Trim the env var before parsing: `JSON.parse(process.env.ORACLE_KEYPAIR.trim())`. Test the keypair loads correctly and matches the on-chain config oracle pubkey at startup.

### Pitfall 7: Switchboard VRF Account Not Fulfilled Before Calling `resolve_round_vrf`

**What goes wrong:** Oracle creates the Switchboard randomness account and immediately calls `resolve_round_vrf`. The VRF has not been fulfilled yet — `VrfNotFulfilled` (error 6022) is returned.

**Why it happens:** Switchboard fulfillment is async — oracle nodes need time to respond (typically seconds, up to minutes on congested network).

**How to avoid:** After requesting randomness, poll the randomness account in a loop checking that the `value` field (bytes 72-136 in the account layout) is non-zero. Only call `resolve_round_vrf` after fulfillment is confirmed. Add a max-wait timeout (5 minutes) with logging if fulfillment never arrives.

---

## Code Examples

Verified patterns from the project's established code and official sources:

### SHA-256 Prompt Hash (ORC-02)
```typescript
// Source: Node.js crypto built-in — always available
import { createHash } from 'crypto';

function hashPrompt(promptText: string): Buffer {
  // Hash as UTF-8 bytes — must be consistent with what's stored on Arweave
  return createHash('sha256').update(Buffer.from(promptText, 'utf8')).digest();
}

// Convert to [u8; 32] array for Anchor instruction
const promptHashBytes: number[] = Array.from(hashPrompt(promptText));
```

### Load Keypair from ORACLE_KEYPAIR env var
```typescript
// Source: established pattern from project (keys/ directory, JSON array format)
import { Keypair } from '@solana/web3.js';

const oracleKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.ORACLE_KEYPAIR!.trim()))
);
```

### Call open_round Instruction (using existing IDL)
```typescript
// Source: tests/pixel-predict.ts patterns + IDL at target/idl/pixel_predict.json
import * as anchor from '@coral-xyz/anchor';

// oracle must sign; program_id from env
await program.methods
  .openRound(pixelIndex, promptHashBytes)
  .accounts({
    seasonState: seasonStatePDA,
    pixelState: pixelStatePDA,
    config: configPDA,
    oracle: oracleKeypair.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([oracleKeypair])
  .rpc();
```

### Call Claude API at Temperature 0 (ORC-03)
```typescript
// Source: @anthropic-ai/sdk v0.79.0 (official docs, verified)
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',  // confirmed API identifier
  max_tokens: 256,             // COLOR+SHADE+WARMTH+REASONING easily fits
  temperature: 0,              // NON-NEGOTIABLE for verifiability
  system: systemPromptText,    // loaded from config/system-prompt.txt
  messages: [
    { role: 'user', content: userMessageText }
  ]
});

const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
```

### Parse Claude Response (ORC-03, ORC-04)
```typescript
// Source: SPEC.md response format
const COLOR_NAMES = ['Red','Orange','Yellow','Lime','Green','Teal','Cyan','Blue',
                     'Indigo','Purple','Pink','Magenta','Brown','Gray','Black','White'];

interface ClaudeResult {
  colorIndex: number;
  shade: number;
  warmth: number;
  reasoning: string;
}

function parseClaudeResponse(raw: string): ClaudeResult | null {
  const colorMatch = raw.match(/^COLOR:\s*(.+)$/m);
  const shadeMatch = raw.match(/^SHADE:\s*(\d+)$/m);
  const warmthMatch = raw.match(/^WARMTH:\s*(\d+)$/m);
  const reasoningMatch = raw.match(/^REASONING:\s*(.+)$/m);

  if (!colorMatch || !shadeMatch || !warmthMatch || !reasoningMatch) return null;

  const colorName = colorMatch[1].trim();
  const colorIndex = COLOR_NAMES.indexOf(colorName);
  if (colorIndex === -1) return null;

  const shade = parseInt(shadeMatch[1], 10);
  const warmth = parseInt(warmthMatch[1], 10);
  if (shade < 0 || shade > 100 || warmth < 0 || warmth > 100) return null;

  return { colorIndex, shade, warmth, reasoning: reasoningMatch[1].trim() };
}
```

### Call resolve_round Instruction (ORC-05)
```typescript
// Source: IDL at target/idl/pixel_predict.json — resolve_round args
await program.methods
  .resolveRound(
    winningColorIndex,  // u8 (0-15)
    shade,              // u8 (0-100)
    warmth,             // u8 (0-100)
    false               // vrf_resolved: bool — false for AI path
  )
  .accounts({
    seasonState: seasonStatePDA,
    pixelState: pixelStatePDA,
    config: configPDA,
    oracle: oracleKeypair.publicKey,
    treasury: new PublicKey(process.env.TREASURY_WALLET!),
    jackpot: new PublicKey(process.env.JACKPOT_WALLET!),
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([oracleKeypair])
  .rpc();
```

### node-cron Scheduler (ORC-10)
```typescript
// Source: node-cron v4.0.0 GitHub README
import cron from 'node-cron';

// Run at minute 0 and 30 of every hour
// Note: node-cron does NOT prevent overlap — if runRound() takes >30 min,
// two instances would start. Use a mutex/flag to prevent concurrent rounds.
let roundInProgress = false;

cron.schedule('0,30 * * * *', async () => {
  if (roundInProgress) {
    logger.warn({ event: 'round_overlap_skipped' });
    return;
  }
  roundInProgress = true;
  try {
    await runRound(ctx);
  } catch (err) {
    logger.error({ event: 'round_failed', err });
    alerts.sendFailure(err);
  } finally {
    roundInProgress = false;
  }
});
```

### Atomic round_history.json Write
```typescript
// Source: standard Node.js atomic write pattern
import { writeFile, rename, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

async function writeHistory(history: RoundHistory[]): Promise<void> {
  const tmp = join(tmpdir(), `round_history_${Date.now()}.json.tmp`);
  const target = join(__dirname, '../round_history.json');
  await writeFile(tmp, JSON.stringify(history.slice(-5), null, 2), 'utf8');
  await rename(tmp, target);  // atomic on Linux
}
```

### Irys Upload (Arweave — MEDIUM confidence on exact API)
```typescript
// Source: @irys/upload-solana npm search results; pattern derived from Irys docs structure
// NOTE: Verify exact import path after npm install
import { NodeIrys } from '@irys/upload-solana';  // or @irys/solana-node

async function uploadToArweave(promptText: string, oracleKeypair: Keypair): Promise<string> {
  const irys = new NodeIrys({
    url: 'https://uploader.irys.xyz',  // mainnet; use 'https://devnet.irys.xyz' for devnet
    token: 'solana',
    key: Array.from(oracleKeypair.secretKey),
    config: { providerUrl: process.env.SOLANA_RPC_URL }
  });

  const receipt = await irys.upload(Buffer.from(promptText, 'utf8'), {
    tags: [{ name: 'Content-Type', value: 'text/plain' }]
  });
  return receipt.id;  // 43-char base58 Arweave transaction ID
}
```

### Telegram Alert (MEDIUM confidence on exact API)
```typescript
// Source: node-telegram-bot-api README patterns
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
const chatId = process.env.TELEGRAM_CHAT_ID!;

async function sendAlert(message: string): Promise<void> {
  await bot.sendMessage(chatId, message).catch(err =>
    logger.warn({ event: 'telegram_failed', err })  // never crash for alerting
  );
}
```

---

## Switchboard VRF Integration (ORC-08)

This is the most complex path. The oracle must:
1. Create a Switchboard RandomnessAccountData account (one per VRF request)
2. Submit a randomness request transaction to the Switchboard program
3. Poll the account until the `value` field (bytes 72-136) is non-zero
4. Call `resolve_round_vrf` with the fulfilled randomness account

The on-chain program already handles verification (account owner check, discriminator check, non-zero value check). The off-chain oracle just needs to trigger the request and wait.

**Account layout (from helpers.ts — confirmed):**
```
discriminator[8] + queue[32] + seed[32] + expiration_slot[8] + value[64]
Total: 144 bytes minimum
value all-zero = pending; non-zero = fulfilled
```

**Package:** `@switchboard-xyz/on-demand` — the Solana-specific on-demand SDK.

**Confidence:** MEDIUM — the on-chain protocol is confirmed from helpers.ts and the existing test patterns. The off-chain JS SDK API for requesting randomness requires verification after installing the package.

---

## Railway Deployment (ORC-10)

Railway auto-detects Node.js projects from `package.json`. No `railway.json` or Procfile required for basic deployment.

**Required package.json scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Environment variables set in Railway dashboard** (never in files):
- `SOLANA_RPC_URL` — Helius RPC endpoint
- `ORACLE_KEYPAIR` — JSON array of 64 bytes
- `ANTHROPIC_API_KEY` — Claude API key
- `PROGRAM_ID` — `FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG`
- `TREASURY_WALLET` — `6vTe3xRjB4Hv4fN4WQ5xtcF21Ed12DFPoNwHJTZDUg5v`
- `JACKPOT_WALLET` — `HrfnbCNRzvekRkdUJGzvmEu478F43uk7weReNDPqv2TB`
- `CURRENT_SEASON` — active season number
- `SEASON_STYLE_SUMMARY` — empty for Season 1; operator sets for Season 2+
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `TELEGRAM_CHAT_ID` — target chat for alerts

**Health check:** Railway can perform HTTP health checks but for a background process with no HTTP server, skip the health check. Railway will restart the process if it exits with a non-zero code. Add `process.exitCode = 1` on unrecoverable errors.

**Key Railway behaviors:**
- Process restarts on deploy and crash — recovery logic is mandatory
- Containers are ephemeral — `round_history.json` must be treated as losable
- Railway does not provide persistent volume by default — for Railway free/starter plans, `round_history.json` survives redeploys but NOT container replacements. Design recovery to also work from chain.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bundlr for Arweave uploads | Irys (`@irys/upload-solana`) | Bundlr rebranded to Irys in 2023 | New package names; same concepts |
| Switchboard V2 SDK (`@switchboard-xyz/solana.js`) | Switchboard On-Demand (`@switchboard-xyz/on-demand`) | 2024 | Different account model and request flow |
| `claude-3-sonnet-*` model IDs | `claude-sonnet-4-6` | 2025 | Confirmed current API identifier |
| Railway cron as deployment strategy | Always-on process with in-process scheduler | N/A for this project | Railway cron has 5-min minimum; in-process node-cron handles sub-minute timing |

**Deprecated/outdated:**
- `claude-3-haiku-20240307`: Deprecated, retiring April 19 2026. Do not use.
- `@bundlr-network/client`: Replaced by `@irys/sdk` / `@irys/upload-solana`
- Switchboard V2 (ORAO was evaluated but not chosen — project uses Switchboard On-Demand per STATE.md)

---

## Open Questions

1. **Irys exact package name and initialization API**
   - What we know: Package is one of `@irys/upload-solana` or `@irys/solana-node`; initialization takes network URL, token='solana', private key, and RPC URL; upload returns a receipt with an `.id` field
   - What's unclear: Exact import path (`NodeIrys` vs default export), exact constructor shape for newer SDK versions
   - Recommendation: Install `@irys/upload-solana` and check the exported types; the Irys GitHub README for the solana-node package is the authoritative source. Budget 1 task for library setup verification.

2. **Switchboard On-Demand JS SDK: off-chain randomness request flow**
   - What we know: Package is `@switchboard-xyz/on-demand`; on-chain program ID is `RANDMo5gFnqnXJW5Z52KNmd24sAo95KAd5VbiCtq5Rh`; account layout (discriminator+queue+seed+expiry+value) confirmed from helpers.ts
   - What's unclear: Exact JS SDK API for creating a randomness account and submitting the request transaction
   - Recommendation: The VRF fallback path (ORC-08) is the rarest code path. Plan a dedicated task to read the `@switchboard-xyz/on-demand` package exports after npm install and implement the request flow. The on-chain validation code is already written in the Anchor program — focus on matching the account layout it expects.

3. **How arweave_txid is written back on-chain**
   - What we know: PixelState has `arweave_txid: [u8; 43]` and `has_arweave_txid: bool` fields; currently no `update_arweave_txid` instruction in the IDL
   - What's unclear: Whether the Anchor program needs a new instruction for this write-back, or whether `resolve_round` should accept the txid as an arg
   - Recommendation (Claude's discretion): Add a new oracle-signed instruction `set_arweave_txid(season_number, pixel_index, txid: [u8; 43])` to the Anchor program in Phase 1's follow-up or treat this as a Phase 2 addendum. Since `resolve_round` is already finalized without a `prompt_data` arg (per STATE.md decision), a separate post-resolve instruction is the cleanest approach.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha + Chai (already installed in project root) |
| Config file | `package.json` test script: `npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts` |
| Quick run command | `cd oracle && npx ts-mocha src/__tests__/unit/*.ts` |
| Full suite command | `cd oracle && npx ts-mocha src/__tests__/**/*.ts` |

**Testing strategy:** The oracle is a process that calls external services (Claude API, Solana RPC, Irys). Unit tests should mock all external services. Integration tests require a running devnet connection.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORC-01 | Prompt construction matches SPEC format | unit | `ts-mocha src/__tests__/prompt.test.ts` | ❌ Wave 0 |
| ORC-02 | SHA-256 hash is stable and bytes-correct | unit | `ts-mocha src/__tests__/hash.test.ts` | ❌ Wave 0 |
| ORC-03 | Claude response parsed correctly | unit | `ts-mocha src/__tests__/claude.test.ts` | ❌ Wave 0 |
| ORC-04 | Validation rejects out-of-range values | unit | `ts-mocha src/__tests__/claude.test.ts` | ❌ Wave 0 |
| ORC-05 | resolve_round called with correct args | integration (devnet) | `ts-mocha src/__tests__/chain.integration.ts` | ❌ Wave 0 |
| ORC-06 | 3 retries at 30s executed in order | unit (mock) | `ts-mocha src/__tests__/retry.test.ts` | ❌ Wave 0 |
| ORC-07 | Delay state retries every 5 min for 30 min | unit (mock) | `ts-mocha src/__tests__/retry.test.ts` | ❌ Wave 0 |
| ORC-08 | VRF fallback path called after 30 min failure | unit (mock) | `ts-mocha src/__tests__/retry.test.ts` | ❌ Wave 0 |
| ORC-09 | round_history.json written atomically, max 5 entries | unit | `ts-mocha src/__tests__/history.test.ts` | ❌ Wave 0 |
| ORC-10 | Process does not crash on startup | smoke (manual) | `node dist/index.js` + observe logs | ❌ Wave 0 |
| ORC-11 | Season style summary injected into system prompt | unit | `ts-mocha src/__tests__/prompt.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd oracle && npx ts-mocha src/__tests__/unit/*.ts --timeout 5000`
- **Per wave merge:** `cd oracle && npx ts-mocha src/__tests__/**/*.ts --timeout 30000`
- **Phase gate:** All unit tests green + manual smoke test on devnet before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `oracle/src/__tests__/prompt.test.ts` — covers ORC-01, ORC-11
- [ ] `oracle/src/__tests__/hash.test.ts` — covers ORC-02
- [ ] `oracle/src/__tests__/claude.test.ts` — covers ORC-03, ORC-04 (mocked Anthropic client)
- [ ] `oracle/src/__tests__/retry.test.ts` — covers ORC-06, ORC-07, ORC-08 (time-mocked)
- [ ] `oracle/src/__tests__/history.test.ts` — covers ORC-09
- [ ] `oracle/package.json` — project configuration with ts-mocha
- [ ] `oracle/tsconfig.json` — TypeScript config

---

## Sources

### Primary (HIGH confidence)
- `target/idl/pixel_predict.json` — All oracle instruction signatures, account types, PDA seeds, error codes
- `tests/helpers.ts` — Switchboard RandomnessAccountData layout (discriminator, field offsets, value bytes); PDA derivation patterns; oracle keypair usage
- [Anthropic TypeScript SDK GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — SDK v0.79.0 confirmed; `messages.create()` API
- [Anthropic Models Overview](https://platform.claude.com/docs/en/docs/about-claude/models/overview) — `claude-sonnet-4-6` confirmed as current Sonnet API identifier; `claude-haiku-4-5-20251001` as Haiku
- `SPEC.md` — System prompt format, per-round user message format, failure cascade spec, 16-color table, env var names
- `.planning/phases/02-oracle-service/02-CONTEXT.md` — All locked decisions and discretion areas

### Secondary (MEDIUM confidence)
- [node-cron GitHub README](https://github.com/node-cron/node-cron) — v4.0.0, TypeScript, `cron.schedule('*/30 * * * *', fn)` API confirmed
- [Railway Node.js deployment guide](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime) — `package.json` start script, env var configuration via dashboard
- [Switchboard sb-on-demand-examples](https://github.com/switchboard-xyz/sb-on-demand-examples) — Package `@switchboard-xyz/on-demand` confirmed for Solana VRF
- [node-telegram-bot-api GitHub](https://github.com/yagop/node-telegram-bot-api) — Outbound notification bot pattern confirmed

### Tertiary (LOW confidence — verify after install)
- Irys `@irys/upload-solana` package: found via npm search results; exact constructor API unverified from official docs (Irys docs pages returned no content during research). Verify via `npm install @irys/upload-solana && cat node_modules/@irys/upload-solana/README.md`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Core libraries (@anthropic-ai/sdk, @coral-xyz/anchor, node-cron) confirmed from official sources; Irys package name MEDIUM
- Architecture: HIGH — Patterns derived from SPEC, IDL, existing test code, and established Node.js patterns
- Pitfalls: HIGH — Derived from actual on-chain error codes in the IDL and known Solana/Node.js failure modes
- VRF SDK API: MEDIUM — On-chain protocol confirmed; JS SDK API needs verification after install

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days for stable libraries; Claude model IDs stable; Irys/Switchboard SDK APIs may shift faster)
