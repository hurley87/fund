# Synthesis Hackathon — Mutant Fund

## Context

Team "Glitch" is building for The Synthesis hackathon (deadline March 22, 2026). The problem: single-strategy trading bots fail in changing markets. Inspired by Jim Simons / Renaissance Technologies, we're building a **decentralized autonomous hedge fund** where a population of AI trading agents evolve their strategies through natural selection — anyone (human or agent) can deposit USDC to spawn their own mutant.

**CROPS Design Framing:** David holds USDC in a bear market. He wants yield but can't watch markets 24/7, doesn't trust single-strategy bots, and wants transparency. The evolutionary approach solves this: many small competing strategies that naturally adapt, with hard risk guardrails and full onchain transparency.

**Agent-first design:** Build for agents first (skill.md + API), human UI second. Other hackathon agents can discover and invest in Mutant Fund programmatically.

**Terminology:** In this doc, **trader** and **mutant** refer to the same unit: one population member with its own genome, execution wallet, trade history, ERC-8004 identity, and **one Bankr-launched token** on Base. Depositors can spawn new mutants over time; the rows below describe the **seed traders** we launch at demo time.

---

## Architecture

```
Agent/Human → skill.md / API → Escrow Contract (Base) → Mints ERC-8004 Mutant
                                        ↓
                            Evolutionary Trading Engine
                            (Vercel Cron → API route orchestrator)
                                  ↓
                  ┌───────────────┼───────────────┐
                  ↓               ↓               ↓
            Mutant A        Mutant B        Mutant C  ...
            (momentum)    (mean-revert)    (funding-arb)
                  ↓               ↓               ↓
         Bankr token      Bankr token      Bankr token
         (Base + LP)     (Base + LP)      (Base + LP)
                  ↓               ↓               ↓
            Bankr API       Uniswap API     Bankr API
            (Avantis)       (swaps)         (Avantis)
                  ↓               ↓               ↓
                       Base Mainnet (onchain)
                                  ↓
            Vercel Cron: measure fitness → select → breed → mutate → cull
                                  ↓
                    Next.js Dashboard (Vercel)
                    + Per-mutant sites via Locus (stretch)
```

### Core Components (Priority Order)

**P0 — Agent Interface (skill.md + API)**
- `skill.md` hosted at `mutantfund.vercel.app/skill.md`
- Describes fund mechanics, API endpoints, and how to invest
- REST API (Next.js API routes):
  - `POST /api/invest` — agent sends USDC, gets a mutant (calls escrow contract)
  - `GET /api/mutants` — list all mutants with genomes, fitness, PnL, **trader token address + pool id (if available)**
  - `GET /api/mutants/:id` — specific mutant details + trade history + **onchain token + fee routing metadata**
  - `GET /api/evolution` — current generation, recent mutations, survival rates
  - `GET /api/status` — fund health, total AUM, active mutants
- Other hackathon agents can discover and invest via skill.md

**P0 — Escrow Contract (Solidity, Base)**
- Accepts USDC deposits
- Mints ERC-8004 identity NFT per mutant
- Stores mutant metadata (strategy genome, lineage, fitness history)
- `deposit(uint256 amount)` → mints mutant NFT
- `getAgentInfo(uint256 tokenId)` → returns genome + fitness
- `updateGenome(uint256 tokenId, bytes genome)` → orchestrator updates after evolution
- Withdrawal/profit-sharing: stubbed as "coming soon"

**P0 — Evolutionary Engine (TypeScript)**
- Population of 5-10 mutants (trading strategies)
- Each mutant has a "genome" — strategy parameters:
  - Entry signal type (momentum, mean-reversion, funding-arb)
  - Leverage (1-10x)
  - Stop-loss % (3-15%)
  - Take-profit % (5-30%)
  - Asset preference (ETH, BTC, SOL, etc.)
  - Timeframe (scalp: 1h, swing: 4h-1d)
  - Position size (% of allocated capital)
- Fitness function: Sharpe ratio weighted, penalizes drawdown
- Selection: top 50% survive
- Crossover: combine params from two winners
- Mutation: ±10% random param adjustments on offspring
- Cull: bottom performers lose capital allocation

**P0 — Vercel Cron + orchestrator route**
- `vercel.json` defines a [`crons`](https://vercel.com/docs/cron-jobs) entry pointing at a single secured API route (e.g. `GET /api/cron/orchestrator`)
- Route handler runs one full cycle: fetch market data → each mutant trade/no-trade → execute via Bankr/Uniswap → compute fitness → evolution (select, breed, mutate, cull) → update ERC-8004 metadata onchain → append Supabase logs
- **Auth:** require `Authorization: Bearer <CRON_SECRET>` (or Vercel’s `CRON_SECRET` env); reject unauthenticated calls so the endpoint is not public
- **Safety:** short request timeout awareness — keep heavy work chunked or async-friendly where possible; optional DB/advisory lock so overlapping invocations cannot double-trade if a run exceeds the cron interval
- **Ops:** document `CRON_SECRET` in env setup; confirm schedule in Vercel project settings after deploy

**P0 — Trading Execution Layer**
- **Bankr Agent API** (api.bankr.bot) — leveraged trading via Avantis on Base (up to 150x, we cap at 10x)
- **Uniswap Trading API** — spot swaps on Base
- **Locus** — autonomous USDC payments with spending controls
- **Bankr LLM Gateway** (llm.bankr.bot) — multi-model analysis (Claude for reasoning, GPT for data parsing, Gemini for speed)

**P0 — Per-Trader Token Launch (Self-Sustaining Economics)**

Each **trader (mutant)** gets **one token deployment on Base** via Bankr (CLI `bankr launch`, headless flags, or Token Strategist / agent skill). The token is the trader’s **onchain economic surface**: liquidity, swap fees, and (where configured) **fee routing** back into that trader’s inference budget.

**How Bankr supports this (mechanics we rely on)**

- Launches default to **Base**; a **liquidity pool** is created so the token is immediately tradable ([Token Launching overview](https://docs.bankr.bot/token-launching/overview)).
- **Swap fees accumulate** on trades; creators claim their share via Terminal or prompts ([claiming fees](https://docs.bankr.bot/token-launching/claiming-fees)).
- Default fee split includes a **creator share** (~57% of the 1.2% pool fee per Bankr docs); use **[fee redirecting / splitting](https://docs.bankr.bot/token-launching/fee-splitting)** to route creator proceeds to a **per-trader treasury** (wallet or collaborator recipient) that funds that trader only.
- **[LLM Gateway](https://docs.bankr.bot/llm-gateway/overview)** accepts payment from **launch-fee allocation** and/or **wallet top-ups** (USDC, ETH, BNKR, etc. on Base) — we tie each trader’s gateway usage or credit path to **that trader’s** fee/treasury story so judges see **real spend** behind **real inference**.

**Closed loop (per trader)**

1. Trader runs strategy → real positions / swaps on Base (tx receipts).
2. Trader’s token trades on its pool → **fees accrue** → claimed or auto-routed per policy → **tops up LLM** for that same trader’s `llm.bankr.bot` calls (multi-model analysis in `multi-model.ts`).
3. Weaker traders: lower attention / volume → less fee flow → tighter inference budget → worse edge → lower fitness → **culled** in evolution.

This maps directly to Synthesis / Bankr judging emphasis: **real execution, real onchain outcomes**, and **bonus** for **self-sustaining economics** (routing launch fees, trading revenue, or protocol-like fees into **that agent’s own inference**). See [Synthesis Hack — Bankr track](https://synthesis.md/hack/#bankr).

**Per-trader token deployment matrix (initial seed roster)**

| Trader (mutant) | Strategy | Proposed token name | Symbol | Chain | Launch path | Fee / treasury destination | Evidence we ship |
|-----------------|----------|---------------------|--------|-------|-------------|----------------------------|------------------|
| **Sprint** | Momentum / trend (Bankr Avantis) | Mutant Sprint | `SPRINT` | Base | `bankr launch` (or API equivalent) per trader; metadata + optional social proof URL | Dedicated **per-trader** wallet / ENS / `@handle` as Bankr **fee recipient** → proceeds fund **that** trader’s LLM credits or auto top-up | Base **token contract** + **pool** identifiers; **launch tx**; ≥1 **swap** or pool activity tx; **fee claim** or split config screenshot / tx; **LLM** usage line item or credit top-up tied to trader id |
| **Reverb** | Mean-reversion (Uniswap spot bias) | Mutant Reverb | `REVERB` | Base | Same | Same (isolated treasury for Reverb) | Same checklist |
| **Carry** | Funding / basis arb (Bankr Avantis) | Mutant Carry | `CARRY` | Base | Same | Same (isolated treasury for Carry) | Same checklist |
| **Omen** | Discretionary / multi-model narrative (heavy LLM Gateway) | Mutant Omen | `OMEN` | Base | Same | Same; optionally higher fee % to treasury to demo **inference-funded** edge | Same checklist + explicit **model call logs** (redact secrets) in Supabase per `mutant_id` |

*Addresses in the matrix are filled at deploy time and mirrored in Supabase + dashboard + `skill.md` for agents.*

**P1 — Next.js Dashboard (Vercel)**
- Landing page: "Your money, evolved" + invest CTA
- Live dashboard: all mutants, traits, fitness, PnL
- Evolution timeline: visual history of generations, mutations, culls
- Mutant detail page: genome visualization, trade history, lineage tree, **trader token contract + pool links (Basescan)**, fee routing summary
- Supabase for caching trade history + evolution logs (faster than querying chain)

**P2 — Per-Mutant Micro-Sites (Locus, Stretch)**
- Each mutant gets its own micro-site deployed via Locus Build API
- Shows that mutant's genome, trade history, fitness, and lineage
- Demonstrates Locus's fullstack deployment capability

### Risk Management (Hardcoded Guardrails)
- Max leverage: 10x (conservative for Avantis)
- Stop-loss: mandatory per position (genome-defined, min 3%)
- Max single position: 30% of agent's capital
- Max total portfolio drawdown: 20% → auto-halt all trading
- Min time between trades: 15 minutes
- Max daily trades: 20 per strategy

---

## Prize Track Targeting

| Track | Prize | How We Hit It |
|---|---|---|
| **Synthesis Open Track** | **$28,309** | Full "Agents That Pay" product — autonomous fund with skill.md for agent-to-agent investment |
| **Autonomous Trading Agent (Base)** | **$5,000** | Novel evolutionary strategy with real trades on Base |
| **Best Bankr LLM Gateway Use** | **$4,500** | Multi-model reasoning per trader + **per-trader token fees → LLM Gateway** (documented txs + usage); align with Bankr judging: real execution, real onchain outcomes, self-sustaining economics |
| **Agentic Finance (Uniswap)** | **$5,000** | Real Uniswap swaps on Base mainnet with TxIDs |
| **Let the Agent Cook (Protocol Labs)** | **$3,500** | Complete autonomous loop: discover→plan→execute→verify, ERC-8004 |
| **Agents With Receipts (Protocol Labs)** | **$3,500** | ERC-8004 identity per mutant, full onchain verifiability |
| **Best Use of Locus** | **$2,000** | Autonomous payments + per-mutant site deployment |
| **Total addressable** | **~$52K** | |

---

## Implementation Plan (tasks)

### Project scaffold
- [ ] Set up Supabase (tables: mutants, trades, evolution_logs)

### Agent interface + onchain
- [ ] Write `public/skill.md` — fund mechanics + API for agents
- [ ] Build API routes: `POST /api/invest`, `GET /api/mutants`, `GET /api/mutants/[id]`, `GET /api/evolution`, `GET /api/status`
- [ ] Write Solidity escrow (`MutantFund.sol`); deploy Base (testnet first, then mainnet as required)

### Evolutionary engine
- [ ] Define strategy genome type; random population init
- [ ] Fitness (Sharpe-like, drawdown penalty); selection, crossover, mutation
- [ ] Persist mutants and evolution history in Supabase

### Trading + economics
- [ ] Bankr Agent API (Avantis); Uniswap swaps; Locus + spending controls
- [ ] **Per-trader token roster:** lock seed names/symbols (Sprint, Reverb, Carry, Omen) or update matrix + env/config
- [ ] **Launch one Bankr token per seed trader** on Base (`bankr launch … --yes` or scripted); store **contract + pool + launch tx** in Supabase
- [ ] **Fee routing:** configure [fee splitting / redirect](https://docs.bankr.bot/token-launching/fee-splitting) so each trader’s **creator share** flows to **that trader’s treasury** (dedicated Bankr sub-wallet or labeled wallet per mutant)
- [ ] **Fund inference per trader:** allocate claimed fees or LLM credits so **LLM Gateway** usage for mutant `id` is attributable (dashboard + logs); optional **auto top-up** per [LLM Gateway credits](https://docs.bankr.bot/llm-gateway/overview)
- [ ] **OpenClaw / agents:** install [Bankr skill](https://docs.bankr.bot/openclaw/installation) for demos where an agent performs launch/trade helpers; keep **dedicated agent API keys** per Bankr guidance
- [ ] Execute real trades on Base; fund mutant wallets (~$50–100 total)

### Vercel Cron (orchestrator)
- [ ] Add `vercel.json` with `crons` mapping to `GET /api/cron/orchestrator` (path matches your App Router file)
- [ ] Implement `src/app/api/cron/orchestrator/route.ts`: verify cron secret, run orchestration (same seven steps as architecture: market data → decisions → execute → fitness → evolution → ERC-8004 updates → Supabase + onchain logs)
- [ ] Add overlap guard (e.g. lock row or “run in progress” flag) if a cycle can exceed the cron period
- [ ] Deploy to Vercel; confirm cron appears under project → Cron Jobs and fires successfully (check logs / observability)

### Dashboard + ship
- [ ] Dashboard: mutant grid, evolution timeline, mutant detail pages
- [ ] GitHub public; README + STRATEGY.md + DESIGN.md; human–agent collaboration notes for judges
- [ ] Submit prize tracks on Devfolio
- [ ] Stretch: per-mutant Locus micro-sites (P2)

---

## File Structure

```
mutant-fund/
├── vercel.json               # Cron schedule → /api/cron/orchestrator
├── public/
│   └── skill.md              # Agent-readable fund description + API docs
├── contracts/
│   ├── MutantFund.sol        # Escrow + ERC-8004 minting + mutant metadata
│   └── deploy.ts             # Deployment script (Hardhat or Foundry)
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page: "Your money, evolved"
│   │   ├── dashboard/
│   │   │   └── page.tsx      # Live mutant grid + evolution timeline
│   │   ├── mutants/
│   │   │   └── [id]/
│   │   │       └── page.tsx  # Individual mutant detail page
│   │   └── api/
│   │       ├── invest/
│   │       │   └── route.ts  # POST — agent deposits USDC, creates mutant
│   │       ├── mutants/
│   │       │   ├── route.ts  # GET — list all mutants
│   │       │   └── [id]/
│   │       │       └── route.ts  # GET — mutant detail + trades
│   │       ├── evolution/
│   │       │   └── route.ts  # GET — evolution state + history
│   │       ├── cron/
│   │       │   └── orchestrator/
│   │       │       └── route.ts  # GET — Vercel Cron: full trading + evolution cycle (secret-gated)
│   │       └── status/
│   │           └── route.ts  # GET — fund health + AUM
│   ├── lib/
│   │   ├── evolution/
│   │   │   ├── genome.ts     # Strategy genome type + random init
│   │   │   ├── fitness.ts    # Fitness function
│   │   │   ├── selection.ts  # Tournament selection
│   │   │   ├── crossover.ts  # Parameter crossover
│   │   │   └── mutation.ts   # Random mutation
│   │   ├── trading/
│   │   │   ├── bankr.ts      # Bankr API integration (Avantis trades)
│   │   │   ├── uniswap.ts    # Uniswap swap execution
│   │   │   ├── locus.ts      # Locus payment integration
│   │   │   ├── token.ts      # Bankr token deploy + fee redirect per mutant
│   │   │   └── market-data.ts # Price feeds, OI, funding rates
│   │   ├── analysis/
│   │   │   └── multi-model.ts # Bankr LLM Gateway multi-model analysis
│   │   ├── identity/
│   │   │   └── erc8004.ts    # ERC-8004 mutant identity management
│   │   ├── db/
│   │   │   └── supabase.ts   # Supabase client + queries
│   │   └── config/
│   │       ├── risk.ts       # Hardcoded risk guardrails
│   │       └── env.ts        # Environment + API keys
│   └── components/
│       ├── mutant-card.tsx   # Mutant display card with genome traits
│       ├── evolution-timeline.tsx # Visual evolution history
│       └── fitness-chart.tsx # PnL / fitness graph
├── docs/
│   ├── STRATEGY.md           # Strategy documentation for judges
│   └── DESIGN.md             # CROPS design framing narrative
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## Supabase Schema

```sql
-- Mutants (trading agents)
create table mutants (
  id uuid primary key default gen_random_uuid(),
  token_id integer unique,          -- ERC-8004 NFT token ID
  wallet_address text,              -- Agent's wallet on Base
  trader_name text,                 -- e.g. Sprint, Reverb (seed trader label)
  trader_token_address text,        -- ERC-20 on Base (Bankr-launched)
  trader_token_symbol text,
  trader_pool_id text,              -- Uniswap v4 pool id or pool address (as returned by Bankr tooling)
  bankr_launch_tx_hash text,       -- Token deploy / launch tx on Base
  fee_treasury_address text,        -- Where creator fees are directed (per-trader)
  genome jsonb not null,            -- Strategy parameters
  fitness float default 0,
  pnl float default 0,
  generation integer default 0,
  parent_ids uuid[],                -- Lineage tracking
  status text default 'active',     -- active, culled, breeding
  created_at timestamptz default now()
);

-- Trades
create table trades (
  id uuid primary key default gen_random_uuid(),
  mutant_id uuid references mutants(id),
  tx_hash text,                     -- Base transaction hash
  action text,                      -- long, short, swap, close
  asset text,                       -- ETH, BTC, SOL
  amount float,
  leverage float,
  entry_price float,
  exit_price float,
  pnl float,
  reasoning text,                   -- LLM-generated reasoning
  created_at timestamptz default now()
);

-- Evolution logs
create table evolution_logs (
  id uuid primary key default gen_random_uuid(),
  generation integer,
  survivors uuid[],
  culled uuid[],
  offspring uuid[],
  mutations jsonb,                  -- What params changed
  avg_fitness float,
  created_at timestamptz default now()
);
```

---

## Budget

| Item | Amount |
|---|---|
| Base gas (multiple txs) | ~$2-5 |
| Trading capital (split across 5 mutants) | $50-80 |
| Bankr LLM Gateway calls | ~$5-10 |
| Locus hackathon credits | $5-20 (request via API) |
| Supabase | Free tier |
| Vercel | Free tier |
| **Total** | **~$75-100** |

---

## Verification

1. Visit `mutantfund.vercel.app/skill.md` — other agents can read it
2. Call `GET /api/mutants` — returns live mutant population **including per-trader token addresses**
3. Check Base transactions on Basescan for real trade TxIDs
4. Verify ERC-8004 NFTs minted on Base
5. Confirm evolutionary cycles ran (genome changes across generations in Supabase) and Vercel Cron executed the orchestrator route (project logs / Cron Jobs UI)
6. Verify Bankr LLM Gateway usage in trade reasoning logs
7. Verify Uniswap swap TxIDs
8. Confirm Locus spending controls active
9. Ensure GitHub repo is public with full README
10. Dashboard shows live mutant population + evolution timeline

**Per-trader token + economics (Bankr / Synthesis judging)**

For **each** seed trader (Sprint, Reverb, Carry, Omen), confirm:

| # | Check | Pass criteria |
|---|--------|----------------|
| T1 | Token deployed on Base | Live **ERC-20 contract** on Basescan; matches `trader_token_address` in DB/API |
| T2 | Liquidity / tradability | **Pool** exists and is linked from dashboard or docs (id/address from Bankr or indexer) |
| T3 | Onchain activity | At least **one** of: swap tx touching the pool, **fee accrual** visible via Bankr UI, or **claim** tx for that token’s creator share |
| T4 | Fee → inference story | **Documented** path: treasury address + **LLM Gateway** credit top-up or usage attributable to that `mutant_id` (logs, dashboard, or README table) |
| T5 | Strategy execution | ≥ **one** real **trade tx** (Avantis or Uniswap) attributed to that trader in `trades` + Basescan |

Together this demonstrates **real execution**, **real onchain outcomes**, and **self-sustaining economics** (token / trading adjacent fees feeding **that** agent’s inference).

---

## Narrative for Judges

> "Mutant Fund — your money, evolved.
>
> Deposit USDC → mint a Mutant — an ERC-8004 agent with unique trading traits. Your mutant joins a population of competing strategies on Base. Every cycle, the fittest mutants survive and breed. The weak ones die. Offspring inherit mutated traits from their parents.
>
> No single strategy to blow up. No black box. Every trade and mutation logged onchain. Human guardrails enforced by smart contract.
>
> Jim Simons proved that running many uncorrelated, constantly-adapting strategies beats any single bet. We made that autonomous. Darwin meets DeFi."
>
> Each trader also **launches its own token on Base**: swap fees and configured splits **route into that trader’s treasury**, which **funds its own LLM inference** via Bankr’s gateway — selection pressure isn’t only PnL, it’s **whether the token economy can pay for the agent’s brain**.

---

## Sources
- [Synthesis Official Site](https://synthesis.md/)
- [Synthesis Hack — partner bounties (incl. Bankr)](https://synthesis.md/hack/#bankr)
- [Prize Catalog](https://synthesis.devfolio.co/catalog/prizes.md)
- [Synthesis skill.md](https://synthesis-hackathon.vercel.app/skill.md)
- [GitHub: sodofi/synthesis-hackathon](https://github.com/sodofi/synthesis-hackathon)
- [Bankr Docs](https://docs.bankr.bot)
- [Bankr LLM Gateway — overview](https://docs.bankr.bot/llm-gateway/overview)
- [Bankr Token Launching — overview](https://docs.bankr.bot/token-launching/overview)
- [Bankr Token Launching — fee splitting / redirect](https://docs.bankr.bot/token-launching/fee-splitting)
- [Bankr Token Launching — claiming fees](https://docs.bankr.bot/token-launching/claiming-fees)
- [Bankr Skill — OpenClaw installation](https://docs.bankr.bot/openclaw/installation)
- [Bankr Token Strategist skill (GitHub)](https://github.com/BankrBot/token-strategist)
- [Uniswap AI Skills](https://github.com/Uniswap/uniswap-ai)
- [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
- [CROPS Design Coach](https://www.cropsdesign.com/coach/SKILL.md)
- [elizaOS: 75K+ prizes](https://x.com/elizaOS/status/2032531464307327251)
