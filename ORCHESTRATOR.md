# Orchestrator — Living Repo Summary

> This file is maintained by the orchestrator thread. It survives context compaction.

## Repo Identity

**Mutant Fund** — a decentralized autonomous hedge fund for the Synthesis hackathon (deadline: 2026-03-22). AI trading agents evolve strategies via natural selection on Base. Deposit USDC → mint an ERC-8004 NFT mutant → strategies compete and evolve.

## Current State (2026-03-21)

**Core implementation complete.** All 16 GitHub issues built. TypeScript compiles clean. No tests exist.

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
                    Vercel Cron (15min): Signal → Risk → Execute → Settle
                    Vercel Cron (daily):  Fitness → Select → Breed → Cull
                                  ↓
                    Dashboard (Next.js) — grid, detail, stats
```

## File Map

### Database Layer
| File | Purpose |
|------|---------|
| `src/lib/db/supabase.ts` | Server-side Supabase client + typed query helpers (`mutants`, `trades`, `evolutionLogs`, `txQueue`) |
| `src/lib/db/types.ts` | TypeScript interfaces: `Mutant`, `Trade`, `EvolutionLog`, `TxQueueItem`, `LifecycleStatus`, `Genome` |
| `src/lib/db/demo-data.ts` | 5 demo mutants + 5 demo trades for offline/demo mode fallback |
| `supabase/migrations/001_init.sql` | Schema: `mutants`, `trades`, `evolution_logs`, `tx_queue` tables + `trader-assets` storage bucket |

### Config Layer
| File | Purpose |
|------|---------|
| `src/lib/config/env.ts` | Lazy getters for all env vars (Supabase, OpenAI, Bankr, cron, orchestrator key, contract addresses) |
| `src/lib/config/risk.ts` | `RISK_GUARDRAILS` constants + `checkRiskLimits()`, `isWithinCooldown()`, `isDrawdownHalted()` |
| `.env.example` | 7 env vars needed |
| `vercel.json` | Cron config: orchestrator every 15min, evolution daily at midnight |

### Evolution Engine
| File | Purpose |
|------|---------|
| `src/lib/evolution/genome.ts` | `Genome` type (8 genes), `GENE_RANGES`, `ASSET_ALLOWLIST` (ETH/BTC/SOL), `randomGenome()` |
| `src/lib/evolution/mutation.ts` | `mutate()` — +/-10% random adjustment per gene, asset shifts +/-1 with wrapping |
| `src/lib/evolution/crossover.ts` | `crossover()` — uniform crossover, random gene from each parent, clamped |
| `src/lib/evolution/fitness.ts` | `computeFitness()` — weighted: 50% Sharpe, 25% drawdown penalty, 10% inactivity penalty |

### Trading Engine
| File | Purpose |
|------|---------|
| `src/lib/trading/signal.ts` | `computeSignal()` — deterministic momentum/reversion blend based on genome's `signal_bias` |
| `src/lib/trading/market-data.ts` | `fetchMarketData()` — DexScreener API, filters Base pairs with USDC/WETH quote, picks highest liquidity |
| `src/lib/trading/bankr.ts` | `executeTrade()`, `pollJob()`, `closeTrade()` — Bankr Agent API for Avantis perps on Base |

### Identity & Contract
| File | Purpose |
|------|---------|
| `src/lib/identity/erc8004.ts` | `registerAgent()`, `transferNFT()`, `ownerOf()` — viem-based ERC-8004 identity registry interaction |
| `src/lib/contract/accounting.ts` | `recordDeposit/Allocation/Settlement/Withdrawal()`, `getBalance/Withdrawable/HWM()` — MutantAccounting contract |
| `contracts/src/MutantAccounting.sol` | Solidity ledger: deposits, margin allocation, settlement with 20% performance fee above HWM, withdrawals |

### Personality & Queue
| File | Purpose |
|------|---------|
| `src/lib/personality/generate.ts` | `generatePersonality()` (gpt-4o-mini), `generateImage()` (DALL-E 3), `uploadImage()` (Supabase storage) |
| `src/lib/queue/tx-queue.ts` | `enqueue()`, `processQueue()` — FIFO serial tx processing. **executeTx is placeholder** (console.log, returns fake hash) |

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/invest` | POST | Spawn new mutant (random or crossover genome) or revive culled mutant. Generates personality + image. |
| `/api/redeem` | POST | Withdraw USDC. Checks NFT ownership via `ownerOf()`, checks withdrawable balance, checks no open positions. |
| `/api/mutants` | GET | List all mutants, optionally filtered by `?status=` |
| `/api/mutants/[id]` | GET | Single mutant detail + trade history |
| `/api/mutants/[id]/registration.json` | GET | ERC-8004 registration metadata (agent URI) |
| `/api/evolution` | GET | Latest generation info, tier counts, offspring available |
| `/api/status` | GET | Fund health: TVL, active count, total trades, last evolution timestamp |
| `/api/cron/orchestrator` | GET | **15min cron**: settle open trades → filter eligible mutants → compute signals → risk check → execute via Bankr → process tx queue |
| `/api/cron/evolution` | GET | **Daily cron**: compute fitness → tiered selection (elite/survivor/weak) → breed offspring → random explorers → write evolution log |

### Dashboard (Next.js App Router)
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page: hero, stats (TVL, active mutants, total trades), "How it works" |
| `src/app/dashboard/page.tsx` | Mutant grid with status filter tabs. Uses `searchParams: Promise<>` pattern (Next 16). |
| `src/app/mutants/[id]/page.tsx` | Mutant detail: hero, stats cards, genome visualization bars, lineage links, trade history table |
| `src/app/layout.tsx` | Root layout: Geist font, dark theme via class, `min-h-full flex flex-col` |
| `src/components/mutant-card.tsx` | Card component: image/initial, status badge, fitness bar, PnL/bankroll/gen/asset stats |
| `src/components/ui/button.tsx` | shadcn/ui button (unused currently) |

### Other
| File | Purpose |
|------|---------|
| `public/skill.md` | Agent-facing skill definition: describes endpoints, x402 flow, how the fund works |
| `docs/mutant-fund.md`, `docs/prd.md` | Design docs |

## Key Conventions

- **Next.js 16.2** with App Router. `params` and `searchParams` are `Promise<>` (must `await`).
- **AGENTS.md warning**: "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing code.
- **Path alias:** `@/*` → `./src/*`
- **Chain:** Base-only (chainId 8453)
- **UI:** shadcn/ui v4, Tailwind v4, dark theme, Geist/Geist Mono fonts
- **Risk guardrails:** Hardcoded in `risk.ts` — max 10x leverage, 3% min stop-loss, 30% max position, 20% max drawdown auto-halt, 15min cooldown, 20 daily trade limit
- **Genome:** 8 continuous genes. `signal_bias` controls momentum vs reversion blend. `asset` is 0-2 index into `['ETH','BTC','SOL']`.
- **Signal math:** Deterministic — `h1*0.5 + h6*0.3 + h24*0.2` for momentum, `-h1 * reversionMultiplier` for reversion, blended by `signal_bias`.
- **Execution:** Bankr Agent API → Avantis perps on Base. Natural language prompt-based API.
- **DB genome vs evolution genome:** DB stores extended format with `_raw` field preserving original evolution genome for crossover/mutation.
- **Demo fallback:** All dashboard pages try API first, fall back to `DEMO_MUTANTS`/`DEMO_TRADES` when Supabase unavailable.
- **Cron auth:** Both cron routes verify `CRON_SECRET` via Bearer header or `?cron_secret=` query param.
- **Route context typing:** `ctx: RouteContext<'/api/mutants/[id]'>` pattern for dynamic route params.
- **Evolution tiers:** 15% elite (full allocation), 45% survivors (allocation decays 5%/cycle), remaining split between offspring (crossover+mutation) and explorers (random immigrants). Population <6 → small-pop mode (mutate everyone, no selection).
- **Performance fee:** 20% above high-water mark, taken in Solidity contract during settlement.

## Decisions Made

- No pre-seeded traders — users spawn on demand via `/api/invest`
- One Bankr wallet for all trades (per-trader accounting in Supabase + contract)
- Accounting contract is a ledger, not a vault — USDC lives in Bankr wallet
- Demo data fallback for dashboard when Supabase unavailable
- x402 payment simplified to JSON body for hackathon MVP
- Genome stored in DB with `_raw` field for crossover/mutation compatibility
- Revival path: culled mutants can be revived with new deposit + fresh genome + personality
- Offspring spawned as `awaiting_deposit` — need investor to fund them
- Explorers (random genomes) added each evolution cycle to maintain genetic diversity
- Fitness-weighted parent selection for breeding (roulette wheel)

## Known Risks & Gaps

- **Hackathon deadline: 2026-03-22** (1 day remaining)
- **Contract not deployed** to Base — Solidity exists but no deployment script or address
- **tx-queue executeTx is a placeholder** — `console.log` + fake hash, not wired to real onchain calls
- **No tests** of any kind
- **No real x402 payment verification** — MVP accepts JSON body
- **No real signature verification** in redeem — trusts `signer` field
- **DexScreener rate limits** need handling in production
- **Bankr API untested** with real trades
- **Settlement is incomplete** — cron sets exit_price=0 and pnl=0 for all settled trades (needs real price data from Bankr)
- **`/api/mutants` returns `{ mutants: data }`** but dashboard expects bare array — potential shape mismatch
- **Dashboard `getMutants()` expects array** but API wraps in `{ mutants: [...] }` — currently works only via demo fallback
- **`RouteContext` type** used in `[id]/route.ts` but not imported from anywhere visible — may be a Next 16 global type
- **layout.tsx metadata** still says "Create Next App" — not branded
- **capital_allocation starts at 0** for new mutants in invest route but at 1.0 in DB default — new spawns won't trade until evolution runs
- **`trades_today` never resets** — no daily reset mechanism for the trade counter

## Thread State

This is the start of the orchestrator thread. No tasks dispatched yet. Ready for instructions.
