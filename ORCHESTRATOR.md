# Orchestrator — Living Repo Summary

> This file is maintained by the orchestrator thread. It survives context compaction.

## Repo Identity

**Mutant Fund** — a decentralized autonomous hedge fund for the Synthesis hackathon (deadline: 2026-03-22). AI trading agents evolve strategies via natural selection on Base. Deposit USDC → mint an ERC-8004 NFT mutant → strategies compete and evolve.

## Current State (2026-03-21)

**Core implementation complete.** All 16 GitHub issues built across 3 waves of parallel agent teams. TypeScript compiles clean.

### What exists

| Layer | Files |
|-------|-------|
| **DB** | `src/lib/db/supabase.ts`, `types.ts`, `demo-data.ts`; `supabase/migrations/001_init.sql` |
| **Config** | `src/lib/config/env.ts`, `risk.ts`; `.env.example`; `vercel.json` (cron) |
| **Evolution** | `src/lib/evolution/genome.ts`, `mutation.ts`, `crossover.ts`, `fitness.ts` |
| **Trading** | `src/lib/trading/signal.ts`, `market-data.ts`, `bankr.ts` |
| **Identity** | `src/lib/identity/erc8004.ts` |
| **Personality** | `src/lib/personality/generate.ts` (OpenAI text + image) |
| **Contract** | `contracts/src/MutantAccounting.sol`; `src/lib/contract/accounting.ts` (viem) |
| **Tx Queue** | `src/lib/queue/tx-queue.ts` |
| **API Routes** | `invest`, `redeem`, `mutants`, `mutants/[id]`, `mutants/[id]/registration.json`, `evolution`, `status`, `cron/orchestrator`, `cron/evolution` |
| **Dashboard** | Landing page, mutant grid (`/dashboard`), mutant detail (`/mutants/[id]`) |
| **Components** | `mutant-card.tsx`, `ui/button.tsx` |
| **Agent Interface** | `public/skill.md` |
| **UI** | shadcn/ui v4, Tailwind v4, dark theme |

### What does NOT exist yet

- Solidity deployment (contract written but not deployed)
- Real x402 payment verification (MVP accepts JSON body)
- Real signature verification in redeem (MVP trusts signer field)
- Token launch + Locus micro-sites (stretch goals, Issue #17)
- Tests

## Architecture

```
Agent/Human → POST /api/invest (x402 USDC) → Spawn Mutant
                                                ↓
                                  ┌─────────────┼─────────────┐
                                  ↓             ↓             ↓
                            Register        Generate       Record
                            ERC-8004        Personality    Deposit
                            (Base)          (OpenAI)       (Contract)
                                  ↓
                    Vercel Cron (15min): Signal → Risk → Execute
                    Vercel Cron (daily): Fitness → Select → Breed → Cull
                                  ↓
                    Dashboard (Next.js) — grid, detail, stats
```

## Key Conventions

- **Next.js 16.2** with App Router, async params pattern
- **Path alias:** `@/*` → `./src/*`
- **Chain:** Base-only (chainId 8453)
- **Risk guardrails:** Hardcoded in `risk.ts`
- **Genome:** 8 continuous genes, strategy type = `signal_bias` gene
- **Signal math:** Deterministic (momentum/reversion blend). LLM reasoning is post-hoc only.
- **Execution:** Bankr Agent API → Avantis perps on Base

## Decisions Made

- No pre-seeded traders — users spawn on demand
- One Bankr wallet for all trades (per-trader accounting in Supabase + contract)
- Accounting contract is a ledger, not a vault
- Demo data fallback for dashboard when Supabase unavailable
- x402 payment simplified to JSON body for hackathon MVP
- Genome stored in DB with evolution-compatible `_raw` field for crossover/mutation

## Known Risks

- **Hackathon deadline: 2026-03-22** (1 day remaining)
- Contract not yet deployed to Base
- No tests
- DexScreener rate limits need handling in production
- Bankr API integration untested with real trades
