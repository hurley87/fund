# Orchestrator — Living Repo Summary

> This file is maintained by the orchestrator thread. It survives context compaction.

## Repo Identity

**Mutant Fund** — a decentralized autonomous hedge fund for the Synthesis hackathon (deadline: 2026-03-22). AI trading agents evolve strategies via natural selection on Base. Deposit USDC → mint an ERC-8004 NFT mutant → strategies compete and evolve.

## Current State (2026-03-20)

**Scaffold only.** The repo is a fresh Next.js 16.2 app with almost no custom code. Everything described in `docs/mutant-fund.md` is spec, not implementation.

### What exists

| Layer | Status |
|-------|--------|
| Next.js 16 app shell | `src/app/page.tsx` (default template), `src/app/layout.tsx` (Geist fonts, dark mode ready) |
| UI library | shadcn/ui v4 (base-nova style), `@base-ui/react`, CVA, Tailwind v4, `tw-animate-css`. One component: `src/components/ui/button.tsx` |
| Utility | `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge) |
| Config | `components.json` (shadcn), `eslint.config.mjs` (next core-web-vitals + TS), `postcss.config.mjs` (@tailwindcss/postcss), `tsconfig.json` (`@/*` → `./src/*`) |
| Docs | `docs/mutant-fund.md` — comprehensive 700-line spec (architecture, schema, API, evolution, trading, tokenomics, prize targeting) |
| Public assets | Default Next.js SVGs only |

### What does NOT exist yet (all planned)

- **No API routes** (invest, redeem, mutants, evolution, revive, status, cron)
- **No Solidity contracts** (no `contracts/` dir, no MutantFund.sol)
- **No evolutionary engine** (genome, fitness, selection, crossover, mutation, allocation, revival)
- **No trading layer** (orchestrator, router, bankr, uniswap, locus, market-data, token)
- **No analysis** (multi-model LLM gateway)
- **No identity** (ERC-8004 management)
- **No DB** (no Supabase client, no schema applied)
- **No config modules** (risk.ts, trader-strategies.ts, env.ts, trader-profiles.ts)
- **No dashboard components** (mutant-card, evolution-timeline, fitness-chart)
- **No `skill.md`** (agent interface)
- **No `vercel.json`** (cron config)
- **No tests**

## Architecture (from spec)

```
Agents/Humans → skill.md / API → Escrow Contract (Base) → ERC-8004 Mutant NFTs
                                          ↓
                              Evolutionary Trading Engine (Vercel Cron)
                              ├── Trading: every 15 min
                              └── Evolution: every 24h
                                    ↓
                    Mutants (Sprint, Reverb, Carry, Omen)
                    Each has: genome, bankroll, Bankr token, LP
                                    ↓
                    Venues: Bankr/Avantis (perps), Uniswap (spot)
                    Data: DexScreener (Base pairs, no candles)
                                    ↓
                    Next.js Dashboard + Per-mutant Locus sites (stretch)
```

## Key Conventions & Constraints

- **Next.js 16.2** — AGENTS.md warns: "This is NOT the Next.js you know." Must read `node_modules/next/dist/docs/` before writing Next.js code.
- **Path alias:** `@/*` → `./src/*`
- **UI:** shadcn/ui v4 base-nova style, `@base-ui/react` primitives, CVA for variants, Tailwind v4
- **Chain:** Base-only for all live execution (MVP). Non-Base = paper/simulation.
- **Risk guardrails:** max 10x leverage, mandatory stop-loss (min 3%), max 30% single position, 20% drawdown halt, 15 min between trades, 20 max daily trades
- **Execution model:** evaluation-driven, not force-trade. Outcomes: `trade_executed`, `no_trade_signal`, `blocked_by_risk`, `blocked_by_limits`
- **Trading vs evolution:** separate cadences (15 min vs 24h). Never breed/mutate on trading ticks.
- **Market data:** DexScreener-only. No candle APIs. Snapshot metrics (m5/h1/h6/h24 price change, volume, liquidity, txn counts).
- **Per-mutant economics:** each mutant has own bankroll (not pooled), own Bankr token, own fee treasury. 20% performance fee on realized profit above HWM.
- **Config source of truth (planned):** `src/lib/config/risk.ts`, `src/lib/config/trader-strategies.ts`
- **Solidity tooling:** Foundry + LazerForge template

## Seed Traders

| Name | Strategy | Venue | Symbol |
|------|----------|-------|--------|
| Sprint | Momentum/trend | Bankr/Avantis (perps) | SPRINT |
| Reverb | Mean-reversion | Uniswap (spot) | REVERB |
| Carry | Funding/basis arb | Bankr/Avantis | CARRY (paper until funding feed) |
| Omen | Discretionary/narrative | Paper mode first | OMEN |

## Supabase Schema (planned)

Three tables: `mutants` (40+ columns), `trades`, `evolution_logs`. See `docs/mutant-fund.md` lines 548-624.

## Planned File Structure

See `docs/mutant-fund.md` lines 469-543 for the full tree.

Key module boundaries:
- `src/lib/evolution/` — genome, fitness, selection, crossover, mutation, allocation, revival
- `src/lib/trading/` — orchestrator, router, bankr, uniswap, locus, token, market-data
- `src/lib/analysis/` — multi-model LLM
- `src/lib/identity/` — ERC-8004
- `src/lib/db/` — Supabase client
- `src/lib/config/` — risk, strategies, env, trader-profiles
- `src/app/api/` — REST endpoints
- `contracts/src/` — Solidity (Foundry)

## Decisions Made

(None yet — this section tracks decisions as the thread progresses)

## Known Risks & Fragile Areas

- **Hackathon deadline: 2026-03-22** (2 days from now)
- Next.js 16 may have breaking changes vs training data — must consult docs
- No tests infrastructure at all
- Carry strategy is blocked until a funding rate data source is wired
- Omen starts in paper mode only
- DexScreener rate limits need handling
- Cron overlap guard needed to prevent double-trading

## Subagent History

(Updated as subagents complete work)
