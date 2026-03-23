# Orchestrator — Living Repo Summary

> This file is maintained by the orchestrator thread. It survives context compaction.

## Repo Identity

**Mutant Fund** — a decentralized autonomous hedge fund for the Synthesis hackathon (deadline: 2026-03-22). AI trading agents evolve strategies via natural selection on Base. Deposit USDC → mint an ERC-8004 NFT mutant → strategies compete and evolve.

## Current State (2026-03-22)

**Core implementation complete.** All 16 GitHub issues built. TypeScript compiles clean. No tests exist. **tx-queue wired to real on-chain calls** (ERC-8004 register, NFT transfer, accounting contract).

**MutantAccounting contract deployed** to Base mainnet at `0x31598c93FA964cB38A92f0a604Dc8289A6D60b18`. Owner: `0xBe523e724B9Ea7D618dD093f14618D90c4B19b0c`.

**Treasury wallet** (bankr): `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea` — receives USDC deposits, executes trades via Bankr API.

**On-chain payment verification** implemented: `/api/invest` and `/api/fund` require a `tx_hash` proving USDC was sent to the treasury. Amount is read from the blockchain. No way to fake deposits.

**One mutant per wallet** enforced. Agents top up via `/api/fund`.

## Architecture

```
Agent → Send USDC to treasury on Base
      → POST /api/invest { payer_address, tx_hash } → Verify on-chain → Spawn Mutant
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
| `src/lib/db/supabase.ts` | Server-side Supabase client + typed query helpers (`mutants`, `trades`, `evolutionLogs`, `deposits`, `txQueue`) |
| `src/lib/db/types.ts` | TypeScript interfaces: `Mutant`, `Trade`, `EvolutionLog`, `TxQueueItem`, `Deposit`, `LifecycleStatus`, `Genome` |
| `src/lib/db/demo-data.ts` | 5 demo mutants + 5 demo trades for offline/demo mode fallback |
| `supabase/migrations/001_init.sql` | Schema: `mutants`, `trades`, `evolution_logs`, `tx_queue` tables + `trader-assets` storage bucket |
| `supabase/migrations/*_add_deposits_table.sql` | `deposits` table: tracks all USDC deposits with unique `tx_hash` constraint |

### Config Layer
| File | Purpose |
|------|---------|
| `src/lib/config/env.ts` | Lazy getters for all env vars (Supabase, OpenAI, Bankr, cron, orchestrator key, contract addresses, treasury) |
| `src/lib/config/risk.ts` | `RISK_GUARDRAILS` constants + `checkRiskLimits()`, `isWithinCooldown()`, `isDrawdownHalted()` |
| `.env.example` | 8 env vars needed (added `TREASURY_ADDRESS`) |
| `vercel.json` | Cron config: orchestrator every 15min, evolution daily at midnight |

### Payment Verification
| File | Purpose |
|------|---------|
| `src/lib/verify/usdc-transfer.ts` | `verifyUsdcTransfer()` — reads tx receipt on Base, parses ERC-20 Transfer logs via viem `parseEventLogs`, verifies USDC sent to treasury from expected sender. Exports `USDC_ADDRESS`. |

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
| `contracts/src/MutantAccounting.sol` | Solidity ledger: deposits, margin allocation, settlement with 20% performance fee above HWM, withdrawals. Uses OZ `Ownable`. |

### Personality & Queue
| File | Purpose |
|------|---------|
| `src/lib/personality/generate.ts` | `generatePersonality()` (gpt-4o-mini), `generateImage()` (DALL-E 3), `uploadImage()` (Supabase storage) |
| `src/lib/queue/tx-queue.ts` | `enqueue()`, `processQueue()` — FIFO serial tx processing. `executeTx` wired to real on-chain calls: `register` → ERC-8004 + update agent_id + enqueue transfer_nft + record_deposit; `transfer_nft` → NFT to owner; `record_deposit/settlement/withdrawal` → MutantAccounting contract via viem. |

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/invest` | POST | Spawn new mutant or revive axed one. Requires `tx_hash` proving USDC transfer to treasury. One mutant per wallet. |
| `/api/fund` | POST | Top up existing mutant's bankroll. Requires `tx_hash` proving USDC transfer to treasury. |
| `/api/redeem` | POST | Withdraw USDC. Checks NFT ownership via `ownerOf()`, checks withdrawable balance, checks no open positions. |
| `/api/mutants` | GET | List all mutants, optionally filtered by `?status=` |
| `/api/mutants/[id]` | GET | Single mutant detail + trade history |
| `/api/mutants/[id]/registration.json` | GET | ERC-8004 registration metadata (agent URI) |
| `/api/evolution` | GET | Latest generation info, tier counts, offspring available |
| `/api/status` | GET | Fund health: TVL, active count, total trades, last evolution timestamp |
| `/api/cron/orchestrator` | GET | **15min cron**: settle → signals → risk → execute → tx queue |
| `/api/cron/evolution` | GET | **Daily cron**: fitness → selection → breeding → culling |

### Dashboard (Next.js App Router)
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page: hero, stats, "How it works" |
| `src/app/dashboard/page.tsx` | Mutant grid with status filter tabs |
| `src/app/mutants/[id]/page.tsx` | Mutant detail: hero, stats cards, genome bars, lineage, trade history |

### Other
| File | Purpose |
|------|---------|
| `public/skill.md` | Agent-facing skill definition: treasury address, two-step invest flow (send USDC + call API with tx_hash), top-up, revival, monitoring |
| `docs/mutant-fund.md`, `docs/prd.md` | Design docs |

## Key Conventions

- **Next.js 16.2** with App Router. `params` and `searchParams` are `Promise<>` (must `await`).
- **Path alias:** `@/*` → `./src/*`
- **Chain:** Base-only (chainId 8453)
- **UI:** shadcn/ui v4, Tailwind v4, dark theme, Geist/Geist Mono fonts
- **Risk guardrails:** max 10x leverage, 3% min stop-loss, 30% max position, 20% max drawdown auto-halt, 15min cooldown, 20 daily trade limit
- **One mutant per wallet** — enforced in invest route. Top up via `/api/fund`.
- **On-chain verification** — all deposits require `tx_hash` proving USDC was sent to treasury. Amount derived from blockchain, not request body.
- **Deposit tracking** — `deposits` table with unique `tx_hash` constraint prevents replay attacks.
- **Performance fee:** 20% above high-water mark, taken in Solidity contract during settlement.

## Decisions Made

- No pre-seeded traders — users spawn on demand via `/api/invest`
- One Bankr wallet (treasury) for all trades; per-trader accounting in Supabase + contract
- Accounting contract is a ledger, not a vault — USDC lives in treasury bankr wallet
- On-chain USDC transfer verification replaced trust-based JSON body (no more fake deposits)
- One mutant per wallet enforced; top-ups via `/api/fund`
- Genome stored in DB with `_raw` field for crossover/mutation compatibility
- Revival path: axed mutants revived with new deposit + fresh genome + personality
- Explorers (random genomes) added each evolution cycle to maintain genetic diversity

## Known Risks & Gaps

- **No tests** of any kind
- **No real signature verification** in redeem — trusts `signer` field
- **DexScreener rate limits** need handling in production
- **Bankr API untested** with real trades
- **Settlement is incomplete** — cron sets exit_price=0 and pnl=0 (needs real Bankr price data)
- **`trades_today` never resets** — no daily reset mechanism
