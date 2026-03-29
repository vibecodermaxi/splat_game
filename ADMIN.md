# Splat Admin Guide

## 1. Modify the Base Prompt

Edit this file directly:

```
oracle/config/system-prompt.txt
```

It has three template variables: `{grid_width}`, `{grid_height}`, and `{season_style_summary}`. Changes take effect on the next round (the template is cached in-process, so restart the oracle after editing).

## 2. Start / Restart / End Seasons

**Start a new season:**

```bash
npx tsx scripts/devnet-setup.ts --season 2 --grid 10x10
```

Then update `CURRENT_SEASON=2` in `oracle/.env` and restart the oracle.

**Restart the oracle mid-season:**

Just kill and restart — the ticker picks up where it left off automatically. The state-machine ticker reads on-chain state each tick, so there's no lost progress.

**End a season:**

Seasons end automatically when all pixels are resolved (the on-chain program sets `status = Completed` after the last pixel). There's no manual "end season" command. If you want to abandon a season mid-way, just start a new one with `--season N+1` and update the env var.

## 3. Change the Prompt/Style for the Next Season

Set the `SEASON_STYLE_SUMMARY` env var in `oracle/.env`. This gets injected into the `{season_style_summary}` slot in the system prompt. Example:

```
SEASON_STYLE_SUMMARY=You are continuing from Season 1, which developed a warm gradient from the top-left corner. This season, explore cooler tones and sharper contrasts.
```

For Season 1, this is typically empty (the AI starts fresh). For Season 2+, write a 1-2 sentence summary of the previous season's artistic direction.

## Quick Reference

| Task | How |
|------|-----|
| Edit base prompt | `oracle/config/system-prompt.txt` then restart oracle |
| Start season N | `npx tsx scripts/devnet-setup.ts --season N` then set `CURRENT_SEASON=N` in `.env` and restart |
| Change art style | Set `SEASON_STYLE_SUMMARY` in `oracle/.env` then restart |
| Restart oracle | Kill + start — ticker auto-recovers |
| End season | Automatic after last pixel, or just start next season |
| Fund oracle | `npx tsx scripts/devnet-setup.ts --fund-oracle` or `solana airdrop 2 <pubkey> --url devnet` |

## Environment Variables (oracle/.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `ORACLE_KEYPAIR` | JSON array of 64 bytes | `[1,2,3,...,64]` |
| `PROGRAM_ID` | Deployed program address | `FaVo1qzkbVt1uPwyU4jRZ7hgkJbYTzat8iqtPE3orxQG` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `CURRENT_SEASON` | Active season number | `1` |
| `SEASON_STYLE_SUMMARY` | Art direction for Claude | (empty for Season 1) |
| `ROUND_DURATION_MINUTES` | Total round length | `30` (prod) or `5` (testing) |
| `TICK_INTERVAL_SECONDS` | Oracle polling interval | `90` (prod) or `10` (testing) |
| `TREASURY_WALLET` | 3% rake recipient | `6vTe3x...` |
| `JACKPOT_WALLET` | 2% jackpot accumulation | `HrfnbC...` |
| `TELEGRAM_BOT_TOKEN` | Optional monitoring alerts | |
| `TELEGRAM_CHAT_ID` | Optional monitoring alerts | |
| `RIGGED_COLOR` | Test mode: always resolve to this color index (0-15) | `0` (Red) |
