# Synthesis Hackathon — Mutant Fund

## Context

Solo builder (David) + AI for The Synthesis hackathon (deadline March 22, 2026). The problem: single-strategy trading bots fail in changing markets. Inspired by Jim Simons / Renaissance Technologies, we're building a **decentralized autonomous hedge fund** where a population of AI trading agents evolve their strategies through natural selection — anyone (human or agent) can deposit USDC to spawn their own mutant.

Each mutant is an **ERC-8004 agent identity** on Base. The **current NFT holder** can redeem idle balance + settled PnL. Redemption rights follow the NFT, not the original depositor.

**CROPS Design Framing:** David holds USDC in a bear market. He wants yield but can't watch markets 24/7, doesn't trust single-strategy bots, and wants transparency. The evolutionary approach solves this: many small competing strategies that naturally adapt, with hard risk guardrails and full onchain transparency.

**Agent-first design:** Build for agents first (skill.md + x402 API), human UI second. Other hackathon agents can discover and invest in Mutant Fund programmatically via a single HTTP call.

**Terminology:** In this doc, **trader** and **mutant** refer to the same unit: one population member with its own genome, trade history, and ERC-8004 identity. The NFT is the **economic title** to that mutant's bankroll and settled gains.

**Chain scope (MVP):** All trade execution, escrow accounting, ERC-8004 registration, and verification receipts are **Base-only**.

**No pre-seeded roster:** Users spawn traders on demand. The system generates genomes — either random (early population) or offspring from the evolution breeding pool. There are no hardcoded seed traders.

---

## Spawn Flow (Core Loop)

When a user or agent invests, they get a mutant. One HTTP call:

```
POST /api/invest
Headers: x-402 payment (USDC on Base)
Body: { }  ← empty; the payment IS the investment

Response: {
  agent_id: 42,
  name: "Voltspike",
  description: "A reckless momentum hunter...",
  genome: { signal_bias: 0.72, leverage: 3, ... },
  owner: "0xabc...",
  bankroll: 50.00,
  image_url: "https://...",
  status: "active"
}
```

### Spawn sequence (end-to-end)

1. **x402 payment arrives** — payer address and USDC amount extracted from payment payload
2. **Genome generated** — random if population < 6, otherwise offspring from breeding pool (system decides, user does not choose)
3. **OpenAI text generation** — genome traits used as creative brief → generates `name`, `description`, `visual_motifs`, `image_prompt` (sync, ~2-3s)
4. **OpenAI image generation** — from `image_prompt` → unique mutant portrait (sync, ~3-5s)
5. **Upload image to Supabase Storage** — `trader-assets/{mutant_id}/logo.png` → public URL
6. **USDC sent to Bankr wallet** — operational wallet that executes all trades
7. **Accounting contract write** — `recordDeposit(agentId, amount)` on Base
8. **ERC-8004 registration** — call `IdentityRegistry.register(agentURI)` on Base → get `agentId`
9. **Transfer NFT to payer** — `transferFrom(serverWallet, payerAddress, agentId)`
10. **Write to Supabase** — mutant row with genome, bankroll, profile, lineage
11. **Return mutant details** to caller

Total spawn time: ~10-15 seconds. "Your mutant is being born" loading moment.

### Metadata generation from genome

The genome IS the creative brief. OpenAI generates a coherent identity from the trading parameters:

| Genome trait | Creative influence |
|---|---|
| High `signal_bias` (momentum) | Aggressive, forward-charging personality |
| Low `signal_bias` (mean-reversion) | Patient, contrarian, calculated |
| High `leverage` | Reckless, high-energy, volatile aesthetic |
| Low `leverage` | Conservative, armored, defensive |
| `asset` = ETH | Ethereum-themed visual motifs |
| High `entry_threshold` | Selective, zen, waiting-for-the-perfect-moment |

**Theme consistency required:** name, description, image, and dashboard card must align to one coherent personality. OpenAI structured output enforces this in a single call.

---

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
                    Evolutionary Trading Engine
                    (Vercel Cron → API route orchestrator)
                              ↓
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
        Mutant A         Mutant B        Mutant C  ...
        (genome)         (genome)        (genome)
              ↓               ↓               ↓
                    Bankr Agent API
                    (Avantis perps on Base)
                              ↓
                    Base Mainnet (onchain)
                              ↓
        Vercel Cron (daily): fitness → select → breed → mutate → cull
                              ↓
                Next.js Dashboard (Vercel)
```

### Key architectural decisions

| Decision | Answer | Rationale |
|---|---|---|
| Pre-seeded traders | **No** — users spawn on demand | Simpler; the product IS the spawn mechanic |
| Strategy families | **No** — strategy type is a gene (`signal_bias`) | Evolution can produce hybrids naturally; no routing per family |
| Execution layer | **Bankr Agent API only** (prompt-based) | One integration; Bankr routes to Avantis for perps |
| Trade type | **All perps via Avantis** | 1x leverage perp ≈ spot; uniform execution; enables short |
| Escrow contract | **Accounting ledger, not a vault** | USDC lives in Bankr wallet for trading; contract is the public trust layer |
| Identity | **ERC-8004 on existing Base registry** | No custom NFT contract needed |
| Deposits | **x402 payment protocol** | One HTTP call; agents already understand x402 |
| Wallet per trader | **No** — one Bankr wallet, Supabase tracks per-trader allocations | Bankr requires interactive wallet creation (email + OTP); can't automate per-spawn |
| Signal math | **Deterministic** from genome + DexScreener data | Fast, auditable; LLM reasoning is post-hoc only |
| Offspring funding | **Market-driven** — offspring need someone to invest | Evolution produces genomes; capital allocation is demand-driven |

---

## ERC-8004 Integration

ERC-8004 is **already deployed on Base mainnet**. We call the existing registries:

- **IdentityRegistry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **ReputationRegistry**: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

### Registration

Each mutant is registered via `IdentityRegistry.register(agentURI)` which mints an ERC-721 NFT. The `agentURI` points to a dynamic API route that returns the registration file.

### Agent registration file (dynamic)

Served from `GET /api/mutants/[id]/registration.json`:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Voltspike",
  "description": "Gen 3 offspring — parents #12 (fitness 0.82) × #7 (fitness 0.71). Momentum-biased ETH trader, 4x leverage.",
  "image": "https://supabase-url/trader-assets/42/logo.png",
  "active": true,
  "x402Support": true,
  "services": [
    {
      "name": "Mutant Fund API",
      "endpoint": "https://mutant.fund/api/mutants/42"
    }
  ],
  "registrations": [
    { "agentId": 42, "agentRegistry": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }
  ],
  "traits": {
    "generation": 3,
    "parents": [12, 7],
    "signal_bias": 0.72,
    "leverage": 4,
    "asset": "ETH",
    "fitness": 0.65,
    "lifecycle_status": "active"
  }
}
```

Lineage is stored in Supabase (source of truth) and surfaced in the registration file (public face). The dynamic route ensures the file always reflects current state.

### NFT ownership

The `agentWallet` metadata field on the ERC-8004 identity is set to the user's wallet address (the address that paid via x402). The NFT is transferred to the payer after registration. Redemption rights follow `ownerOf(agentId)`.

---

## Accounting Contract (Solidity, Base)

**Public ledger, not a vault.** USDC lives in the Bankr operational wallet where it can trade. The contract records every state change onchain for transparency.

Anyone can verify: `bankr_wallet_balance >= sum(all withdrawable)`.

```solidity
// MutantAccounting.sol — Base, USDC only

mapping(uint256 agentId => uint256 balance) public bankroll;
mapping(uint256 agentId => uint256 reserved) public reservedMargin;
mapping(uint256 agentId => uint256 hwm) public highWaterMark;
address public orchestrator;
address public protocolTreasury;

// State changes (onlyOrchestrator)
recordDeposit(uint256 agentId, uint256 amount)
recordAllocation(uint256 agentId, uint256 amount)    // margin locked for trade
recordSettlement(uint256 agentId, int256 pnl)         // trade closed; adjusts bankroll; 20% fee on profit above HWM
recordWithdrawal(uint256 agentId, uint256 amount)

// Views (anyone)
getBalance(uint256 agentId) → uint256
getWithdrawable(uint256 agentId) → uint256  // bankroll - reservedMargin
getHWM(uint256 agentId) → uint256
```

### Performance fee

**20% on realized profit above high-water mark (HWM).** Applied in `recordSettlement`:
- If `pnl > 0` and new bankroll exceeds HWM: take 20% of `(newBankroll - hwm)` to protocol treasury
- Raise HWM to post-fee bankroll
- No management fee. Losses reduce bankroll. No guaranteed principal.

### Withdrawal flow

1. User calls `POST /api/redeem` with signed message
2. Backend verifies `IdentityRegistry.ownerOf(agentId) == signer`
3. Backend checks `getWithdrawable(agentId)` — rejects if amount exceeds available or positions are open
4. Backend sends USDC from Bankr wallet to user's address
5. Backend calls `recordWithdrawal(agentId, amount)` on contract
6. Both txs (USDC transfer + contract write) go through the tx queue

### Revival

When a mutant is axed or bankroll depleted, anyone can invest in it again via `POST /api/invest` with the `agentId`. This reactivates the mutant with a **new genome** (not the old one). HWM resets to the new bankroll baseline. `revival_count` increments. Mutant enters `probation` status with capped `capital_allocation` for 1-2 evolution cycles.

**Tooling:** Scaffold and deploy with **[LazerForge](https://github.com/LazerTechnologies/LazerForge)** (Foundry template). `forge init --template lazertechnologies/lazerforge contracts`, deploy via `forge script`.

---

## Genome

Strategy type is a **gene**, not a category. The genome is a continuous parameter space. Evolution produces hybrids naturally — no hardcoded strategy families.

| Gene | Range | Purpose |
|------|-------|---------|
| `signal_bias` | 0.0–1.0 | 0 = pure mean-reversion, 1 = pure momentum |
| `leverage` | 1–10 | Clamped by risk guardrails |
| `stop_loss` | 0.03–0.15 | Mandatory; set at entry on Avantis |
| `take_profit` | 0.05–0.30 | Set at entry on Avantis |
| `asset` | index into allowlist | ETH, BTC, SOL — one asset per trader |
| `timeframe_hours` | 0.25–24 | How long positions are held / signal re-evaluation window |
| `position_size_pct` | 0.05–0.30 | % of effective capital per trade |
| `entry_threshold` | 0.01–0.10 | Minimum signal strength to act (noise filter) |

**One asset per trader.** Simpler execution, cleaner PnL attribution. Evolution specializes traders toward assets that work.

---

## Signal Math (Deterministic)

Signal math decides. LLM writes reasoning post-hoc.

```
// Data: DexScreener multi-horizon price changes for the trader's asset
momentum_score = weighted_avg(h1_change, h6_change, h24_change)
reversion_score = -h1_change * (h24_change_is_calm ? bonus : 1)

// Blend based on genome
raw_signal = signal_bias * momentum_score + (1 - signal_bias) * reversion_score

// Trade if strong enough
if abs(raw_signal) > entry_threshold:
  direction = sign(raw_signal)  // positive = long, negative = short
  size = bankroll * capital_allocation * position_size_pct
  leverage = genome.leverage
  stop_price = entry * (1 - stop_loss) if long, entry * (1 + stop_loss) if short
  tp_price = entry * (1 + take_profit) if long, entry * (1 - take_profit) if short
  → execute via Bankr
else:
  → no_trade_signal
```

The signal math is intentionally simple. **Natural selection is the edge** — bad parameter combos lose money, get axed. Good ones survive and breed.

### DexScreener data (MVP market data policy)

**One external provider** for signal inputs: **[DexScreener](https://dexscreener.com)** HTTP API. No candle arrays.

| Signal bucket | DexScreener fields | Strategy use |
|---|---|---|
| Multi-horizon return | `priceChange` m5/h1/h6/h24 | Momentum alignment; mean-reversion extremes |
| Activity | Volume h24/h6, txn counts (buys vs sells) | Confirm participation; filter noise |
| Tradability | `liquidity.usd`, `fdv` | Hard gates before sizing |
| Identity | `chainId`, `pairAddress`, token addresses | Join key from signal → execution |

**Allowlist filters:** min liquidity, min volume, quote token allowlist (USDC, WETH), optional min pair age. Centralized in `risk.ts`.

### Bankr execution (prompt template)

All trades route through one Bankr Agent API account:

```
POST /agent/prompt
X-API-Key: {BANKR_API_KEY}
{
  "prompt": "open a {direction} position on {asset} with {leverage}x leverage, ${size} collateral, stop loss at ${stop_price}, take profit at ${tp_price} on Avantis via Base"
}
→ returns { "jobId": "..." }

GET /agent/job/{jobId}
→ poll for completion
```

**Stop-loss and take-profit are set at entry** on Avantis — no cron-based exit monitoring needed.

### Post-hoc LLM reasoning

After each trade decision (execute or no-trade), call Bankr LLM Gateway to generate a reasoning summary. Stored in `trades.reasoning`. Demonstrates LLM Gateway usage for the prize track without influencing the deterministic signal.

---

## Evolutionary Engine

### Cadence

- **Trading orchestrator cron:** `*/15 * * * *` (every 15 minutes)
- **Evolution cron:** once every 24 hours (separate path)
- These are intentionally separate. We do not breed/mutate on every trade tick.

### Trading loop (every 15 min)

Each cron tick:
1. Check for closed positions (Bankr job status) → settle back to contract
2. Load all active mutants + global risk state
3. Skip mutants that are benched, halted, inside cooldown, or `capital_allocation = 0`
4. Fetch DexScreener pair snapshot for each mutant's asset (allowlist filters)
5. Run signal math → `trade` or `no_trade`
6. Apply risk checks
7. Execute via Bankr prompt if signaled
8. Persist structured outcome: `trade_executed`, `no_trade_signal`, `blocked_by_risk`, `blocked_by_limits`
9. Generate LLM reasoning (async, non-blocking)

### Evolution loop (every 24h)

**Minimum population threshold: 6 traders.** Below this, only mutation (±10% on existing genomes). Above it, full tiered evolution.

**Fitness (multi-term, regime-aware)**

Weighted composite (tune in `fitness.ts`):
- **Risk-adjusted return** — Sharpe-like metric on rolling PnL
- **Max drawdown penalty** — harsh penalty beyond guardrails
- **Turnover / fee penalty** — discourages churn
- **Inactivity penalty** — when strategy should have signaled but didn't
- **Correlation penalty** — vs cohort exposure; prevents population collapse into one crowded trade
- **Novelty / diversity bonus** (optional) — for underrepresented genomes

**Regime-aware:** blend multiple lookback windows with capped weight on noisiest window.

**Tiered selection**

| Tier | % of population | Treatment |
|---|---|---|
| Elites | 10–20% | Genome unchanged; boost `capital_allocation` |
| Survivors | 40–50% | Retained; steady or reduced allocation; eligible to breed |
| Offspring | 20–30% | Crossover from high-fitness, low-correlation parents; then mutation |
| Exploration | 5–15% | New random genomes ("immigrants") |

Exact percentages are population-size aware (minimum 1 explorer).

**Crossover:** combine genes from two parents (uniform or per-gene blend), clamp to risk guardrails. Parent selection favors **high fitness + low correlation** to each other.

**Mutation:** ±10% random adjustments on offspring genes (clamped to allowed ranges).

**Capital allocation and axe**

Prefer **reallocation before deletion**: weak mutants lose `capital_allocation` toward 0 (benched) while rows stay for audit. **Axe** when fitness stays poor across multiple windows. Set `lifecycle_status` to `axed`. Bankroll remains under the same NFT until redeemed or revived.

**Offspring are born without capital.** They appear in `GET /api/mutants` with `lifecycle_status: 'awaiting_deposit'`. Their lineage and parent fitness are visible. The market decides which offspring deserve capital — agents or humans invest to activate them.

### Lifecycle states

| State | Meaning |
|---|---|
| `active` | Eligible for trading and evolution |
| `benched` | `capital_allocation = 0`; retained for audit; skipped by trading loop |
| `axed` | Not eligible to trade until revived |
| `probation` | Revived mutant; capped sizing, no breeding for 1-2 generations |
| `awaiting_deposit` | Offspring genome exists but no bankroll; waiting for investment |

---

## API Routes

**P0 — Agent Interface (skill.md + x402 API)**

- `skill.md` hosted at `https://mutant.fund/skill.md`
- Describes fund mechanics, API endpoints, prerequisites (wallet with USDC on Base), and how to invest

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/invest` | POST | x402 payment → spawn mutant (genome + personality + ERC-8004 + NFT transfer) |
| `/api/redeem` | POST | NFT holder withdraws idle USDC (signed message verifies `ownerOf`) |
| `/api/mutants` | GET | List all mutants with genome, fitness, PnL, bankroll, lifecycle, profile |
| `/api/mutants/[id]` | GET | Specific mutant details + trade history |
| `/api/mutants/[id]/registration.json` | GET | ERC-8004 agent registration file (dynamic) |
| `/api/evolution` | GET | Current generation, tier counts, allocation shifts, offspring available |
| `/api/status` | GET | Fund health, aggregate TVL, active mutant count |
| `/api/cron/orchestrator` | GET | Vercel Cron: 15-min trading cycle (CRON_SECRET gated) |
| `/api/cron/evolution` | GET | Vercel Cron: daily evolution cycle (CRON_SECRET gated) |

---

## Transaction Queue

One Bankr wallet handles all onchain operations. A tx queue prevents nonce collisions.

```sql
tx_queue (
  id uuid primary key default gen_random_uuid(),
  type text,              -- 'register', 'transfer_nft', 'record_deposit', 'redeem', 'trade'
  payload jsonb,
  status text default 'pending',  -- pending, submitted, confirmed, failed
  tx_hash text,
  nonce integer,
  created_at timestamptz default now(),
  processed_at timestamptz
)
```

Serial processor pops pending txs in order, assigns nonces sequentially, submits, updates status. Failed txs retry with the same nonce.

---

## Risk Management (Hardcoded Guardrails)

All centralized in `src/lib/config/risk.ts`.

| Guardrail | Value |
|---|---|
| Max leverage | 10x |
| Stop-loss | Mandatory per position (genome-defined, min 3%) |
| Max single position | 30% of effective capital (bankroll × `capital_allocation`) |
| Max portfolio drawdown | 20% → auto-halt all trading |
| Min time between trades | 15 minutes |
| Max daily trades | 20 per mutant |
| Trading cron cadence | Every 15 minutes |
| Evolution cron cadence | Every 24 hours |

---

## Supabase Schema

```sql
create table mutants (
  id uuid primary key default gen_random_uuid(),
  agent_id integer unique,            -- ERC-8004 agentId
  owner_address text,                 -- NFT holder (payer from x402)
  name text,                          -- OpenAI-generated name
  description text,                   -- OpenAI-generated description (max 500 chars)
  image_url text,                     -- Supabase Storage public URL
  image_prompt text,                  -- OpenAI prompt used (reproducibility)
  genome jsonb not null,              -- {signal_bias, leverage, stop_loss, take_profit, asset, timeframe_hours, position_size_pct, entry_threshold}
  bankroll numeric default 0,
  reserved_margin numeric default 0,
  high_water_mark numeric default 0,
  pnl numeric default 0,
  fitness float default 0,
  capital_allocation numeric default 1.0 check (capital_allocation >= 0),
  generation integer default 0,
  parent_ids uuid[],                  -- lineage (breeding)
  lifecycle_status text default 'active',  -- active, benched, axed, probation, awaiting_deposit
  trades_today integer default 0,
  last_trade_at timestamptz,
  last_evaluated_at timestamptz,
  last_signal_status text,            -- trade_executed, no_trade_signal, blocked_by_risk, blocked_by_limits
  halt_reason text,
  revival_count integer default 0,
  last_revival_at timestamptz,
  novelty_score float default 0,
  correlation_score float default 0,
  created_at timestamptz default now()
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  mutant_id uuid references mutants(id),
  tx_hash text,
  bankr_job_id text,                  -- from POST /agent/prompt
  action text,                        -- long, short, close
  asset text,
  amount float,
  leverage float,
  entry_price float,
  exit_price float,
  stop_loss_price float,
  take_profit_price float,
  pnl float,
  reasoning text,                     -- LLM post-hoc reasoning
  created_at timestamptz default now()
);

create table evolution_logs (
  id uuid primary key default gen_random_uuid(),
  generation integer not null,
  elite_ids uuid[],
  survivor_ids uuid[],
  offspring_ids uuid[],
  axed_ids uuid[],
  tier_counts jsonb,
  mutations jsonb,
  avg_fitness float,
  created_at timestamptz default now()
);

create table tx_queue (
  id uuid primary key default gen_random_uuid(),
  type text,
  payload jsonb,
  status text default 'pending',
  tx_hash text,
  nonce integer,
  created_at timestamptz default now(),
  processed_at timestamptz
);
```

---

## Prize Track Targeting

| Track | Prize | How We Hit It |
|---|---|---|
| **Synthesis Open Track** | **$28,309** | Full "Agents That Pay" product — autonomous fund with skill.md + x402 for agent-to-agent investment |
| **Autonomous Trading Agent (Base)** | **$5,000** | Evolutionary strategy with real perp trades on Base via Bankr/Avantis |
| **Best Bankr LLM Gateway Use** | **$4,500** | Post-hoc LLM reasoning per trade; per-trader token fees → LLM Gateway (stretch) |
| **Agentic Finance (Uniswap)** | **$5,000** | Real trades on Base with TxIDs (Avantis perps via Bankr) |
| **Let the Agent Cook (Protocol Labs)** | **$3,500** | Complete autonomous loop: invest → spawn → trade → evolve → verify, ERC-8004 |
| **Agents With Receipts (Protocol Labs)** | **$3,500** | ERC-8004 identity per mutant, full onchain verifiability, accounting contract |
| **Best Use of Locus** | **$2,000** | Per-mutant micro-sites (stretch) |
| **Total addressable** | **~$52K** | |

---

## Implementation Priorities

### 1. Supabase
- [ ] Create tables: mutants, trades, evolution_logs, tx_queue
- [ ] Storage bucket: `trader-assets/` (public read)
- [ ] Env: Supabase URL + anon key + service role key

### 2. Accounting contract
- [ ] Write `MutantAccounting.sol` (~50-80 lines)
- [ ] Deploy to Base via Foundry + LazerForge
- [ ] Set orchestrator address

### 3. ERC-8004 integration
- [ ] Helper to call `IdentityRegistry.register(agentURI)` on Base
- [ ] Helper to `transferFrom` NFT to payer
- [ ] Dynamic registration file route: `GET /api/mutants/[id]/registration.json`

### 4. POST /api/invest (core spawn flow)
- [ ] x402 payment handling
- [ ] Genome generation (random or offspring)
- [ ] OpenAI text generation (name, description, image_prompt from genome)
- [ ] OpenAI image generation
- [ ] Supabase Storage upload
- [ ] Contract write (recordDeposit)
- [ ] ERC-8004 register + transfer NFT
- [ ] Supabase row write
- [ ] Return mutant details

### 5. Genome + signal math
- [ ] Genome type definition + random init
- [ ] Signal math: momentum/reversion blend from DexScreener data
- [ ] `src/lib/config/risk.ts` — hardcoded guardrails

### 6. Bankr integration
- [ ] `POST /agent/prompt` with trade template
- [ ] `GET /agent/job/{jobId}` polling
- [ ] Position close detection

### 7. Cron orchestrator (trading)
- [ ] `vercel.json` with `*/15 * * * *` schedule
- [ ] `GET /api/cron/orchestrator` — CRON_SECRET gated
- [ ] Settlement check → signal math → execute → log
- [ ] Overlap guard (DB lock)

### 8. Evolution engine
- [ ] Fitness: multi-term composite
- [ ] Tiered selection (elites/survivors/offspring/exploration)
- [ ] Crossover + mutation
- [ ] Capital allocation adjustments
- [ ] Cull logic
- [ ] Offspring creation (awaiting_deposit)
- [ ] `GET /api/cron/evolution` — daily cadence

### 9. Remaining API routes
- [ ] `GET /api/mutants` + `GET /api/mutants/[id]`
- [ ] `POST /api/redeem` — signed message + ownerOf verification
- [ ] `GET /api/evolution`
- [ ] `GET /api/status`

### 10. skill.md
- [ ] Agent-readable fund description
- [ ] Prerequisites (wallet with USDC on Base)
- [ ] API documentation
- [ ] x402 payment instructions

### 11. Dashboard (minimal)
- [ ] Landing page: "Your money, evolved" + invest CTA
- [ ] Mutant grid: cards with name, image, genome, fitness, PnL
- [ ] Mutant detail page: genome, trade history, lineage
- [ ] Evolution timeline (stretch)

### 12. Token launch + Locus micro-sites (stretch)
- [ ] Bankr token launch per trader (deferred until trading UX is solid)
- [ ] Locus micro-sites per mutant (feature add-on)

---

## File Structure

```
mutant-fund/
├── vercel.json                    # Cron schedules
├── public/
│   └── skill.md                   # Agent-readable fund description + API docs
├── contracts/                     # Foundry project (LazerForge template)
│   ├── foundry.toml
│   ├── src/
│   │   └── MutantAccounting.sol   # Onchain accounting ledger (not a vault)
│   └── script/                    # forge script deploy flows
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Mutant grid
│   │   ├── mutants/
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Mutant detail
│   │   └── api/
│   │       ├── invest/
│   │       │   └── route.ts       # POST — x402 → spawn mutant
│   │       ├── redeem/
│   │       │   └── route.ts       # POST — NFT holder withdraws
│   │       ├── mutants/
│   │       │   ├── route.ts       # GET — list all
│   │       │   └── [id]/
│   │       │       ├── route.ts   # GET — mutant detail
│   │       │       └── registration.json/
│   │       │           └── route.ts  # GET — ERC-8004 registration file
│   │       ├── evolution/
│   │       │   └── route.ts       # GET — evolution state
│   │       ├── status/
│   │       │   └── route.ts       # GET — fund health
│   │       └── cron/
│   │           ├── orchestrator/
│   │           │   └── route.ts   # GET — 15-min trading cycle
│   │           └── evolution/
│   │               └── route.ts   # GET — daily evolution cycle
│   ├── lib/
│   │   ├── evolution/
│   │   │   ├── genome.ts          # Genome type + random init + offspring creation
│   │   │   ├── fitness.ts         # Multi-term composite fitness
│   │   │   ├── selection.ts       # Tiered selection
│   │   │   ├── crossover.ts       # Parent crossover (low-correlation pairs)
│   │   │   ├── mutation.ts        # Random mutation (clamped)
│   │   │   └── allocation.ts      # Capital allocation + cull
│   │   ├── trading/
│   │   │   ├── orchestrator.ts    # Per-trader evaluation + structured outcomes
│   │   │   ├── signal.ts          # Deterministic signal math
│   │   │   ├── bankr.ts           # Bankr Agent API (prompt + poll)
│   │   │   └── market-data.ts     # DexScreener: Base pairs, allowlist, snapshots
│   │   ├── identity/
│   │   │   └── erc8004.ts         # Register + transfer + dynamic registration file
│   │   ├── personality/
│   │   │   └── generate.ts        # OpenAI: name, description, image from genome
│   │   ├── contract/
│   │   │   └── accounting.ts      # MutantAccounting contract interactions
│   │   ├── db/
│   │   │   └── supabase.ts        # Supabase client + queries
│   │   ├── queue/
│   │   │   └── tx-queue.ts        # Transaction queue processor
│   │   └── config/
│   │       ├── risk.ts            # Hardcoded guardrails
│   │       └── env.ts             # Environment + API keys
│   └── components/
│       ├── mutant-card.tsx        # Mutant display card
│       ├── evolution-timeline.tsx # Evolution history (stretch)
│       └── fitness-chart.tsx      # PnL / fitness graph
├── docs/
│   └── mutant-fund.md            # This document
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## Budget

| Item | Amount |
|---|---|
| Base gas (register, transfer, contract writes) | ~$2-5 |
| Trading capital (in Bankr wallet) | $50-80 |
| Bankr LLM Gateway calls | ~$5-10 |
| OpenAI API (text + image gen per mutant) | ~$5-10 |
| Supabase | Free tier |
| Vercel | Free tier |
| **Total** | **~$75-100** |

---

## Verification Checklist

1. Visit `https://mutant.fund/skill.md` — agents can read it
2. Call `POST /api/invest` with x402 — receive a mutant with unique name, image, genome
3. Call `GET /api/mutants` — returns live population
4. Verify ERC-8004 NFTs on Base via IdentityRegistry
5. Check accounting contract on Basescan — deposit/settlement records
6. Check Base transactions for real trade TxIDs (Bankr/Avantis)
7. Verify evolutionary cycles ran (genome changes across generations in Supabase)
8. Verify Bankr LLM Gateway usage in trade reasoning logs
9. Call `POST /api/redeem` — NFT holder can withdraw
10. Dashboard shows live mutants + fitness + lineage
11. Vercel Cron fires successfully (project logs)

---

## Narrative for Judges

> "Mutant Fund — your money, evolved.
>
> Pay USDC → receive a Mutant — an ERC-8004 AI agent with unique trading traits, a name, and a face. Your USDC backs that mutant's bankroll; every dollar is accounted onchain. When the strategy realizes profit, the protocol takes 20% above a high-water mark — then you (the current NFT holder) can redeem idle USDC.
>
> Your mutant joins a population of competing strategies on Base. Every day, tiered selection reshapes the roster: elites hold ground, survivors keep trading, and the system breeds new offspring from the best. The weak lose budget, then get axed. New mutants are born from evolution — waiting for someone to believe in their lineage and fund them.
>
> No single strategy to blow up. No black box. Every trade, mutation, and dollar movement logged onchain. Darwin meets DeFi.
>
> One HTTP call. One payment. One mutant. Let evolution do the rest."

---

## Sources

- [ERC-8004: Trustless Agents (EIP)](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8004 Contracts (GitHub)](https://github.com/erc-8004/erc-8004-contracts)
- [x402 — Payment Required](https://www.x402.org/)
- [Coinbase x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [DexScreener](https://dexscreener.com)
- [OpenAI API — Text generation](https://platform.openai.com/docs/guides/text-generation)
- [OpenAI API — Image generation](https://platform.openai.com/docs/guides/image-generation)
- [Bankr Documentation](https://docs.bankr.bot)
- [Bankr Agent API](https://docs.bankr.bot/agent-api/overview)
- [Bankr Signals Skill](https://github.com/BankrBot/skills/blob/main/bankr-signals/SKILL.md)
- [Bankr Token Deploy API](https://docs.bankr.bot/token-launching/deploy-api)
- [Synthesis Official Site](https://synthesis.md/)
- [Synthesis Hack — partner bounties](https://synthesis.md/hack/#bankr)
- [LazerForge (GitHub)](https://github.com/LazerTechnologies/LazerForge)
