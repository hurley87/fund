# Synthesis Hackathon — Mutant Fund

## Context

Team "Glitch" is building for The Synthesis hackathon (deadline March 22, 2026). The problem: single-strategy trading bots fail in changing markets. Inspired by Jim Simons / Renaissance Technologies, we're building a **decentralized autonomous hedge fund** where a population of AI trading agents evolve their strategies through natural selection — anyone (human or agent) can deposit USDC to spawn their own mutant. Each mutant is backed by its **own on-escrow bankroll** (not a pooled LP share); the **current ERC-8004 NFT holder** can redeem idle balance + settled PnL subject to the rules below.

**CROPS Design Framing:** David holds USDC in a bear market. He wants yield but can't watch markets 24/7, doesn't trust single-strategy bots, and wants transparency. The evolutionary approach solves this: many small competing strategies that naturally adapt, with hard risk guardrails and full onchain transparency.

**Agent-first design:** Build for agents first (skill.md + API), human UI second. Other hackathon agents can discover and invest in Mutant Fund programmatically.

**Terminology:** In this doc, **trader** and **mutant** refer to the same unit: one population member with its own genome, execution wallet, trade history, ERC-8004 identity, and **one Bankr-launched token** on Base. The NFT is the **economic title** to that mutant’s escrowed bankroll and settled gains (redemption rights follow the **current** holder, not the original depositor). Depositors can spawn new mutants over time; the rows below describe the **seed traders** we launch at demo time.

**Chain scope (MVP):** All **live** token launches, liquidity pools, trade execution, escrow settlement, fee routing, and verification receipts for Mutant Fund are **Base-only**. No other chain is used for live mutant trading in the MVP; any non-Base logic must stay explicitly marked as simulation / paper mode until documented otherwise.

**Doc vs code today:** This repository is still mostly scaffold; there is no implemented pipeline that creates trader images or syncs metadata to Bankr yet. The sections below define the **intended** source-of-truth model. Until code lands, names and symbols live in this doc’s seed matrix and in planned Supabase columns.

---

## Trader and token metadata

### Why a single `TraderProfile`

Earlier versions of this doc implied “metadata + optional social proof URL” at launch but did not define a concrete object. Every surface that needs a consistent story (Bankr token metadata, dashboard cards, `skill.md`, optional ERC-8004 or offchain references) should read from **one** record per mutant — not duplicated strings in three places.

### `TraderProfile` fields (source of truth)

| Field | Purpose |
|-------|---------|
| `traderName` | Short label (e.g. Sprint, Reverb) — matches seed roster / `trader_name` in DB |
| `tokenName` | Full token name passed to Bankr (e.g. Mutant Sprint) |
| `tokenSymbol` | Ticker (e.g. `SPRINT`) |
| `description` | Short description for Bankr onchain token metadata (max **500** characters per [Token Deploy API](https://docs.bankr.bot/token-launching/deploy-api)) |
| `themeKey` | Stable id for visual/copy theme (e.g. `sprint-momentum`) |
| `visualMotifs` | Bullet list or short notes: palette, shapes, mood — feeds prompts and UI tokens |
| `imagePrompt` | Exact prompt used (or last-used) for OpenAI image generation — reproducibility |
| `imageUrl` | **Public** URL of the logo/hero image — stored in **Supabase Storage**, not IPFS for this project |
| `websiteUrl` | Project site for token metadata — default **`https://mutant.fund`** for all seed traders unless a dedicated per-mutant URL exists later |
| `tweetUrl` | Optional social proof link for Bankr metadata |

**Separation of concerns:** `TraderProfile` is **brand/display** metadata. Keep it separate from **operational** fields: `genome`, `fitness`, `wallet_address`, `fee_treasury_address`, pool ids, tx hashes, **bankroll / redemption** fields (`principal_deposited`, `reserved_margin`, `withdrawable_balance`, `high_water_mark`, etc.). The same `TraderProfile` payload (or a subset) is what you send to Bankr; trading state stays in other columns.

### How metadata is created (end-to-end)

1. **Seed brief** — Strategy, personality, and theme for the trader (from the roster row + design notes).
2. **Structured text** — Use OpenAI **text** generation to produce or refine `tokenName`, `tokenSymbol`, `description`, `themeKey`, `visualMotifs`, and an `imagePrompt` (JSON or structured output is fine; pin model snapshots in production).
3. **Image** — Use OpenAI **image** generation from `imagePrompt` (same API key as step 2). Export PNG (or WebP for the app; Bankr accepts a URL — confirm acceptable formats in Bankr docs before launch).
4. **Host on Supabase Storage** — Upload to a public bucket (e.g. `trader-assets/{mutant_id}/logo.png`). The **public object URL** becomes `imageUrl`. We are **not** using IPFS for Mutant Fund assets.
5. **Bankr launch** — Call `bankr launch` (CLI) or `POST /token-launches/deploy` with at least `tokenName`, optional `tokenSymbol`, `description`, `image` = `imageUrl`, `websiteUrl` = `https://mutant.fund`, optional `tweetUrl`, and `feeRecipient` per trader treasury. Bankr may mirror/upload imagery into their own metadata pipeline; our canonical hosted asset remains Supabase unless we intentionally change that.
6. **Mirror in Supabase** — Persist the same fields on the `mutants` row (see schema) so API and dashboard stay consistent with chain-facing metadata.

### Theme consistency (required)

Every trader must align **name**, **token name/symbol**, **description**, **image**, **dashboard card styling** (Tailwind tokens keyed off `themeKey`), and any **micro-site** copy to one coherent theme. Random mismatches (e.g. “calm zen” copy on a neon chaos logo) fail review before launch.

### OpenAI + Bankr handoff

- **One OpenAI API key** can drive both text metadata and image generation; scope it to server-side scripts or secured API routes only — never expose in client bundles.
- **Bankr Token Deploy API** fields we rely on: `tokenName`, `tokenSymbol`, `description`, `image`, `tweetUrl`, `websiteUrl`, `feeRecipient`. See [Token Deploy API](https://docs.bankr.bot/token-launching/deploy-api) and [Token Launching overview](https://docs.bankr.bot/token-launching/overview) (CLI `bankr launch` supports `--image`, etc.).
- **Same object for token metadata?** **Yes** — the `TraderProfile` subset (`tokenName`, `tokenSymbol`, `description`, `image`, `websiteUrl`, `tweetUrl`) is exactly what Bankr stores as token metadata. **No** — do not stuff genome, fitness, or treasury routing into the “description” field; keep those in the DB and contracts.

### Flow

```mermaid
flowchart TD
    traderBrief[TraderBrief]
    metadataGen[OpenAITextMetadata]
    imageGen[OpenAIImageGeneration]
    supabaseStorage[SupabaseStorage]
    bankrLaunch[BankrTokenLaunch]
    appDb[SupabaseMutants]
    appUi[DashboardAndSkillMd]

    traderBrief --> metadataGen
    metadataGen --> imageGen
    imageGen --> supabaseStorage
    metadataGen --> bankrLaunch
    supabaseStorage --> bankrLaunch
    metadataGen --> appDb
    supabaseStorage --> appDb
    appDb --> appUi
    bankrLaunch --> appUi
```

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
            Vercel Cron: measure fitness → tiered select → size trades (capital multiplier) → breed → mutate → cull / same-NFT revive (optional)
                                  ↓
                    Next.js Dashboard (Vercel)
                    + Per-mutant sites via Locus (stretch)
```

### Core Components (Priority Order)

**P0 — Agent Interface (skill.md + API)**
- `skill.md` hosted at `mutantfund.vercel.app/skill.md`
- Describes fund mechanics, API endpoints, and how to invest
- REST API (Next.js API routes):
  - `POST /api/invest` — agent sends USDC **either** to **mint a new mutant** (new NFT) **or** to **top up** an existing mutant’s escrow bankroll (must hold that NFT or be allowlisted per contract rules); calls escrow `deposit`
  - `POST /api/redeem` (or `POST /api/withdraw`) — **current NFT holder** requests withdrawal of **idle USDC** after performance fee settlement; rejects or partial-fills if `reserved_margin` / open positions lock capital; returns quote + tx payload or executes via escrow `redeem`
  - `GET /api/mutants` — list all mutants with genomes, fitness, PnL, **`capital_allocation`**, **`lifecycle_status`**, **`correlation_score`** / **`novelty_score`** when computed, **bankroll / redemption hints** (`principal_deposited`, `reserved_margin`, `withdrawable_balance`, `high_water_mark` when implemented), **trader token address + pool id (if available)**, and **`TraderProfile`** mirror fields (`trader_description`, **`theme_key`**, **`image_url`**, **`website_url`**) when implemented
  - `GET /api/mutants/:id` — specific mutant details + trade history + **onchain token + fee routing metadata** + redemption accounting fields when implemented
  - `GET /api/evolution` — current generation, recent mutations, **tier counts** (elite / survivor / offspring / exploration), **capital allocation shifts** (multipliers on each mutant’s bankroll), **revival events** per cycle
  - `POST /api/revive` — pay **revival payment** for a **culled or depleted** mutant; **same ERC-8004 token id**: protocol takes a **revival protocol fee**, **net remainder seeds** the mutant’s **fresh bankroll**; genome replaced with a **new strategy** (probation rules, cooldowns — see Evolutionary Engine); stub escrow acceptable for hackathon
  - `GET /api/status` — fund health, **aggregate TVL** (sum of per-mutant escrow bankrolls), active mutants
- Other hackathon agents can discover and invest via skill.md

**P0 — Escrow Contract (Solidity, Base)**

Per-mutant escrow (not a single pooled vault for all holders): each mutant’s USDC lives in accounting keyed by **token id**. The **current NFT holder** has redemption rights to **that** mutant’s bankroll and **settled** equity.

- Accepts USDC; **mints** one ERC-8004 identity NFT per **new** mutant, or **credits** bankroll for an existing `tokenId` when the caller is authorized (typically the NFT holder).
- Stores mutant metadata (strategy genome, lineage, fitness history).
- `deposit(uint256 tokenId, uint256 amount)` — `tokenId == 0` (or dedicated `mint` path) **mints** a new NFT and seeds its bankroll; non-zero `tokenId` **tops up** that mutant’s bankroll.
- `redeem(uint256 tokenId, uint256 amount, address to)` — **only** callable by **current owner** (or approved operator). Transfers up to **withdrawable** idle USDC after fees. Must **revert** or **cap** if `amount` exceeds post-fee withdrawable or if policy requires **no open positions** (integrate with `reserved_margin` off-chain or on-chain snapshot).
- `getAgentInfo(uint256 tokenId)` → returns genome + fitness (+ optional bankroll view for integrators).
- `updateGenome(uint256 tokenId, bytes genome)` → orchestrator updates after evolution / **after paid revival** (new strategy).
- **Protocol performance fee (20%):** applied **only** to **realized** profit above a per-mutant **high-water mark** (HWM). On each realization event (or batch settlement), compute incremental profit above HWM, take **20%** for protocol treasury, then **raise HWM** to post-fee equity so the **same** gains are not charged twice. **No** ongoing management fee in MVP. Losses reduce bankroll; **no** guaranteed principal.
- **Redemption / settlement:** withdraw only **idle** USDC not locked as margin; **unrealized** PnL is not spendable until positions close and PnL is realized (and performance fee applied). Optional: while a redemption is **pending**, pause new trades for that `tokenId` until settlement completes.
- **Revival (same NFT):** `revive(uint256 tokenId, ...)` when mutant is **culled** or **bankroll depleted** per policy. Caller pays a **revival payment**; a **revival protocol fee** (configurable bps) goes to **protocol treasury**; the **net** credits that **same** `tokenId`’s bankroll as a **fresh seed**. Genome is reset to a **new** strategy; `capital_allocation` restarts **low** (probation); increment `revival_count`, enforce **cooldown** between revivals. **Not** a restore of past rank, peak PnL, or prior HWM unless explicitly reset in contract (recommended: **reset HWM** to new seed baseline for fairness).
- **Separation from Bankr token economics:** per-trader **creator fee / LLM treasury** routes stay **isolated** for inference (see Per-Trader Token Launch). Protocol **20%** and **revival fees** are **separate** and come from investor / escrow flows above, not from siphoning creator fee shares intended for the LLM loop.

```mermaid
flowchart TD
    deposit[DepositUSDC] --> mint[MintOrTopUpMutantNFT]
    mint --> bankroll[MutantBankroll]
    bankroll --> trade[TradeAndSettle]
    trade --> realized[RealizedPnLAndIdleUSDC]
    realized --> fee[PerformanceFee20PercentHWM]
    fee --> redeem[RedeemByCurrentNFTHolder]
    redeem --> death[MutantCulledOrDepleted]
    death --> revive[PayRevivalFeeSameNFTNewGenome]
    revive --> bankroll
```

- **Tooling:** Scaffold and deploy with **[LazerForge](https://github.com/LazerTechnologies/LazerForge)** — a Foundry template with sensible `foundry.toml` profiles, formatter/CI patterns, remappings (OpenZeppelin, Solady, Uniswap suites), and env-driven RPC / explorer keys so Base testnet → mainnet deploys stay reproducible. Quick start: install [Foundry](https://book.getfoundry.sh/getting-started/installation), then `forge init --template lazertechnologies/lazerforge contracts` (use `--branch minimal` for a slimmer tree). Ship `MutantFund.sol` under `contracts/src/` and run deploys via `forge script` (see LazerForge’s deployment docs in-repo).

**P0 — Evolutionary Engine (TypeScript)**

Each mutant has a **genome** — strategy parameters:
- Entry signal type (momentum, mean-reversion, funding-arb)
- Leverage (1-10x)
- Stop-loss % (3-15%)
- Take-profit % (5-30%)
- Asset preference (ETH, BTC, SOL, etc.)
- Timeframe (scalp: 1h, swing: 4h-1d)
- Position size (% of **effective trading notional** = that mutant’s **own bankroll** × `capital_allocation` — see schema). `capital_allocation` is an evolution **multiplier** (0 = benched, >1 boosted), **not** a claim on other mutants’ escrow or a pooled AUM share.

**Fitness (multi-term, regime-aware)**  
Fitness is a weighted composite (tune weights in `fitness.ts`; expose constants for judges):
- **Risk-adjusted return** — e.g. Sharpe-like metric on rolling PnL / return series
- **Max drawdown penalty** — harsh penalty beyond fund guardrails
- **Turnover / fee penalty** — discourages churn that burns edge on small accounts
- **Inactivity penalty** — when the strategy should have signaled (per genome + market data) but did not trade, subject to min trade interval and max daily trades
- **Correlation penalty** — vs cohort or fund aggregate exposure so the population does not collapse into one crowded trade
- **Novelty / diversity** (optional) — small bonus for genomes underrepresented in the active pool (`novelty_score`)
- **Treasury sustainability bonus** (optional, Bankr loop) — rewards per-trader token fee flow relative to LLM Gateway spend when logs support attribution

**Regime-aware scoring:** blend multiple lookbacks (e.g. short + medium windows) with capped weight on the noisiest window so one lucky hour does not dominate a single generation.

**Selection (tiered population policy)**  
Avoid a single cutoff like “top 50% survive” or “top 90% survive” — weak pressure hides adaptation; extreme pressure kills diversity. Each cycle, **target** roughly:
- **10–20% elites** — genomes **unchanged**; retain or **boost** `capital_allocation`
- **40–50% survivors** — retained; **steady or slightly reduced** allocation; eligible to breed
- **20–30% offspring** — **crossover** from parent pairs chosen for **high fitness and low correlation** to each other; then **mutation**
- **5–15% exploration** — **new random** genomes (“immigrants”) to escape local optima

Exact percentages can be **population-size aware** (e.g. minimum 1 explorer in tiny demos).

**Crossover:** combine parameters from two parents (uniform or per-gene blend), then clamp to risk guardrails.

**Mutation:** ±10% random adjustments on offspring parameters (clamp to allowed ranges).

**Capital allocation and cull**  
Prefer **reallocation before deletion**: weak mutants **lose trading budget first** by lowering **`capital_allocation`** (a multiplier on **their** bankroll-only sizing) toward **0** while rows stay for audit. **Cull** the worst tier when fitness stays poor across windows or after repeated strips — set `lifecycle_status` to `culled`; **escrowed USDC remains** under the **same** NFT until redeemed or **revived**; keep history, trades, and ERC-8004 id for receipts.

**Revival (fee → same NFT, new strategy; not pay-to-win)**  
- A **revival payment** **reactivates the same** ERC-8004 token id after **cull** or **depleted bankroll** (policy-defined). The mutant gets a **brand-new genome** (new strategy), **not** a replay of the old parameters unless you explicitly document otherwise.
- **Fee split:** a **revival protocol fee** (configurable bps, documented onchain or in config) goes to **protocol treasury**; the **net remainder is credited** to that **same** mutant’s **bankroll** as the new seed (auditable in txs + DB).
- **Rules:** after revival, **capped low** `capital_allocation`; **no breeding rights** for **1–2** generations; increment `revival_count`; **at most one revival per token per configurable window** (e.g. N generations or wall-clock cooldown).
- **Not pay-to-win:** revival does **not** restore prior **elite tier**, historical peak PnL, or old **high-water mark** for performance fees — recommend **resetting HWM** to the post-revival bankroll baseline.
- **Edge cases:** if population is near minimum, cap revivals per cycle; reject revival if token is not `culled`/eligible or cooldown violated; optional minimum revival payment in USDC; NFT transfer means **only the current holder** can revive or redeem.

### Execution model and cadence (default operating spec)

This section is the default **source of truth** for "how do trades execute?" and "how often do we trade?" until code or env overrides are documented explicitly.

**Execution model**
- The trading system is **evaluation-driven**, not "force trade every tick." On each orchestrator cycle, every **active** mutant is reviewed and returns one of four outcomes: `trade_executed`, `no_trade_signal`, `blocked_by_risk`, or `blocked_by_limits`.
- A mutant can only execute if it is **not** `culled`, **not** globally halted, **not** inside cooldown, and still has non-zero `capital_allocation`.
- Position sizing uses that mutant’s **own bankroll** only: `effective trading notional = bankroll × capital_allocation`.
- `capital_allocation = 0` means the mutant is effectively **benched** for trading, even if it remains in the population for audit/history.
- The **trading loop** and **evolution loop** are intentionally **separate**. We do **not** breed / mutate on every trade evaluation tick.
- All **live** execution in the MVP routes to Base-native venues and contracts only; anything outside Base must remain explicitly labeled as paper mode / simulation.

**Cadence**
- **Trading orchestrator cron:** default `*/15 * * * *` (**every 15 minutes**).
- **Strategy evaluation cadence:** every active mutant is evaluated on **every** trading tick.
- **Trade cadence:** signal-driven; a trade only fires when the strategy signal is valid and all guardrails pass.
- **Minimum time between trades:** `15 minutes` per mutant.
- **Maximum daily trades:** `20` per mutant / strategy.
- **Evolution cadence:** default **once every 24 hours** (or another slower schedule with equivalent intent), after enough trade + no-trade observations have accumulated.
- **Why this split:** a 15-minute trading loop matches the hard cooldown rule, while a slower evolution loop avoids overfitting to a single noisy hour and keeps cron work predictable.

**Lifecycle states used by the trading loop**
- `active` — eligible for normal evaluation and execution
- `benched` — retained for audit/history but skipped because `capital_allocation = 0`
- `culled` — not eligible to trade until revived
- `probation_revival` — revived mutant with capped sizing and temporary breeding restrictions

### Trader decision inputs, tradable assets, and what is available

This subsection answers three questions in one place: **what data drives a decision**, **which coins/assets are in scope**, and **what information exists today** vs only in the spec or future code.

#### Three different “coins” (do not conflate them)

| Layer | Role | Examples in Mutant Fund |
|-------|------|-------------------------|
| **Bankroll / escrow** | Capital deposited and risk-managed per mutant; sizing is USDC-denominated. | USDC in per-mutant escrow (see escrow + schema). |
| **Underlying traded assets** | What a strategy may **long / short / swap** on Base per venue rules — this is the **trading universe**, not the Bankr meme token. | ETH, BTC, SOL and other **liquid majors** as allowed per strategy row in the router table below; genome **`asset preference`** narrows within that allowlist. |
| **Per-trader Bankr ERC-20** | Each seed mutant’s **launched token** — liquidity, fees, treasury → LLM economics; **not** the default perp/spot leg unless you explicitly add a rule. | `SPRINT`, `REVERB`, `CARRY`, `OMEN` on Base (see per-trader token matrix). |

**What the trader “trades” for PnL demos:** the **underlying** column in the deterministic router (e.g. Sprint → ETH/BTC/SOL majors on Avantis; Reverb → wrapped majors on Uniswap spot). The **Bankr token** is parallel **agent economics**, documented separately.

#### What data a trader uses to decide

Decisions are **evaluation-driven** (see execution model above): each tick loads inputs, produces `trade` or `no-trade`, then risk and limits may block execution.

| Input category | Purpose | Concrete examples (MVP spec) |
|----------------|---------|------------------------------|
| **Market data** | Snapshot metrics + ranked pair lists (no OHLCV candle arrays). | **(B) DexScreener** — Base pairs, allowlist filters, **m5/h1/h6/h24** price change, volume, liquidity, tx counts (see below). **No candle APIs.** **Carry (true funding arb)** still needs **funding / OI** (not on DexScreener) → **`no_trade_signal`** / **paper** until a venue funding feed is wired. |
| **Verified agent signals** | Tx-backed **LONG/SHORT/BUY/SELL** signals + provider track records on Base. | **(A) Bankr Signals** — public **feed**, **leaderboard**, filtered **`/api/signals`**; optional **webhooks**. Use as a **prior or filter**, never as a bypass for `risk.ts` / venue rules. Skill: [`bankr-signals/SKILL.md`](https://github.com/BankrBot/skills/blob/main/bankr-signals/SKILL.md). |
| **Strategy / internal state** | Parameters and context that turn market data into a signal. | **Genome**: signal type (momentum / mean-revert / funding-arb), leverage, stop/take-profit bands, **asset preference**, timeframe, position-size % of effective notional; **open positions** / margin picture (`reserved_margin`, etc. when synced); **last** `last_trade_at`, `trades_today`, `last_signal_status`; optional **cohort** hints for fitness (`correlation_score`, `novelty_score`) — used heavily in **evolution**, and optionally to avoid crowding in the trading loop if wired. |
| **Risk and execution limits** | Hard gates after a signal exists. | Max leverage **10x**, max single position **30%** of effective capital, **20%** fund drawdown halt, **15 min** min between trades, **20** max daily trades per mutant, `capital_allocation` (zero = benched), lifecycle (`culled`, halt flags, optional redemption freeze). Centralized in **`src/lib/config/risk.ts`** when implemented. |
| **Narrative / LLM (optional)** | Discretionary or multi-model overlay; must not bypass risk modules. | **Bankr LLM Gateway** for parsing/synthesis; **Omen** records **decisions and reasoning** even in **paper** mode; `trades.reasoning` in the schema stores **LLM-generated reasoning** when used. No separate third-party “sentiment API” is specified in MVP. |

#### DexScreener-only policy (MVP default)

**Scope:** One external provider for **tradable-universe construction** and **signal inputs**: **[DexScreener](https://dexscreener.com)** (HTTP API / documented pair endpoints). **No candle pulls** — no OHLCV arrays from other providers for strategy alpha in this mode.

**Solid trade list (allowlist), not “trending blindly”**

1. Query **Base** pairs (search by chain, boosted/latest/trending endpoints per DexScreener API docs — pin the exact routes in code comments).
2. **Filter** to a conservative set, e.g.:
   - **Minimum liquidity (USD)** — floor illiquid rugs (tune in `risk.ts` / config).
   - **Minimum volume (e.g. 24h USD)** — must trade enough to exit.
   - **Quote token** allowlist where applicable (e.g. **USDC**, **WETH**) so execution paths stay predictable.
   - Optional **pair age** minimum (e.g. exclude pairs younger than N hours) to reduce launch scams.
3. **Intersect** with the deterministic router: e.g. Sprint/Reverb still only consider symbols the venue can execute (majors / wrapped majors); DexScreener supplies **addresses** (`pairAddress`, `baseToken` / `quoteToken`) for routing — map to Bankr/Uniswap execution in the adapter layer.

**Signal data (from pair JSON, no candles)**

Use fields DexScreener exposes on the pair object (names vary slightly by API version — normalize in `market-data.ts`):

| Signal bucket | Typical DexScreener fields (conceptual) | Strategy use |
|---------------|----------------------------------------|--------------|
| **Multi-horizon return** | `priceChange` over **m5 / h1 / h6 / h24** (or equivalent) | **Sprint:** trend alignment (e.g. h1 and h24 same sign + magnitude thresholds). **Reverb:** extreme **h1** vs calmer **h24** as a **mean-reversion** proxy (contrarian), still without candles. |
| **Activity** | **Volume** (e.g. h24, h6), **txn** counts (buys vs sells in window) | Confirm participation; filter noise; optional **buy/sell imbalance** as a micro signal. |
| **Tradability** | **liquidity.usd**, **fdv** (if present) | Hard gates before sizing; reject pairs below liquidity floor. |
| **Identity** | `chainId`, `pairAddress`, token addresses/symbols | Stable join key from signal → execution quote. |

**Carry:** True **funding / basis / OI** arb is **not** available from DexScreener. Default behavior: **do not open Carry positions** on DexScreener-only data (`no_trade_signal` or **paper** with logged reason). Adding Avantis/Bankr funding endpoints later is an explicit **scope change**, not part of this policy.

**Operational:** Respect DexScreener **rate limits**; cache pair snapshots per orchestrator tick; log the **pair address** and **snapshot timestamp** on every decision for audit.

**Fitness (evolution)** uses **realized PnL**, drawdown, turnover, inactivity vs “should have signaled” (**genome + market data**), correlation, and optional treasury/LLM spend signals — that shapes **future** genomes and `capital_allocation`, not necessarily every tick’s raw price feed.

#### What information is available (honest scope)

| Status | What you get |
|--------|----------------|
| **Specified in this doc** | Genome fields, router **allowed assets** per strategy family, cadence, outcomes (`trade_executed`, `no_trade_signal`, `blocked_by_risk`, `blocked_by_limits`), risk constants, Supabase **schema intent** (`mutants`, `trades`, `evolution_logs`), and **API** shapes described under Architecture (`GET /api/mutants`, etc.). |
| **Available when the scaffold is implemented** | Live rows and logs from Supabase + API responses matching those fields; onchain receipts on Base (tx hashes, token/pool addresses). |
| **Not yet in repo / not fully specified** | **DexScreener → execution mapping** (pair → Bankr/Uniswap leg), exact **threshold constants** (min liquidity/volume), **rate-limit** handling, and automated **margin sync** semantics — treat as **TBD** until `market-data.ts`, venue adapters, and cron land. **Candles:** intentionally out of scope under DexScreener-only MVP. |

**Deterministic venue router (default)**

Each strategy family should have one explicit venue policy so routing logic is deterministic and auditable:

| Strategy family | Seed trader(s) | Default venue | Allowed assets | Leverage | Default timeframe | Notes |
|---|---|---|---|---|---|---|
| Momentum / trend | Sprint | **Bankr Agent API / Avantis** | ETH, BTC, SOL majors first | Yes, capped at 10x | 1h to 4h | Good fit for directional perp exposure |
| Mean-reversion | Reverb | **Uniswap Trading API** | ETH, BTC wrappers, liquid majors | No leverage by default | 15m to 4h | Spot-biased to reduce churn and liquidation risk |
| Funding / basis arb | Carry | **Bankr Agent API / Avantis** | Assets with stable funding + OI data | Yes, capped at 10x | 1h to 1d | **DexScreener-only MVP:** no funding/OI from DexScreener — **no live Carry** until venue funding feeds are wired; otherwise `no_trade_signal` / paper. |
| Narrative / discretionary | Omen | **Paper decision mode** first; optionally one approved live venue later | Liquid majors only until rules harden | No leverage by default | 4h to 1d | Record decisions and reasoning even when not live-trading |

**Typed config surface (planned code source of truth)**
- Mirror the router above in `src/lib/config/trader-strategies.ts` with per-strategy fields such as `signalType`, `allowedVenue`, `allowedAssets`, `minTradeIntervalMinutes`, `maxTradesPerDay`, `defaultTimeframe`, and `supportsLeverage`.
- Keep hard limits like max leverage, drawdown halt, and position caps centralized in `src/lib/config/risk.ts`.
- API routes and cron handlers should read from these config modules rather than duplicating business rules in multiple files.

**Per-cycle decision order**
1. Verify cron auth / lock so overlapping runs cannot double-evaluate the same mutant.
2. Load all non-culled mutants plus global risk state.
3. Skip mutants that are benched, halted, or inside cooldown.
4. Fetch **DexScreener** pair set + snapshot metrics for Base (allowlist filters), scoped to that mutant’s strategy family and genome.
5. Generate a `trade` or `no-trade` decision for that mutant.
6. Apply risk and execution limit checks.
7. Route to the correct venue adapter (`Bankr/Avantis`, `Uniswap`, or paper mode).
8. Persist one structured outcome: `trade_executed`, `no_trade_signal`, `blocked_by_risk`, or `blocked_by_limits`.
9. Run fitness / selection / mutation on the slower **daily** evolution cadence, not on every trading tick.

**Open edge cases and default handling**
- **No signal:** log `no_trade_signal`; do not treat every idle tick as a failure unless the inactivity model says the strategy should have acted.
- **Cooldown conflict:** log `blocked_by_limits` if a second signal appears before `15 minutes`.
- **Daily trade cap reached:** log `blocked_by_limits`; reset the counter on the next UTC day boundary (or document an alternative reset convention if changed).
- **Global drawdown breach:** halt all live execution and continue logging evaluations until manually or policy-unhalted.
- **Omen / discretionary mode:** until live execution rules are explicit, keep it in paper-decision mode or restrict it to one approved venue / asset subset.
- **Pending redemption:** optionally freeze new trades for that `tokenId` until open positions settle and `withdrawable_balance` is clear.

**P0 — Vercel Cron + orchestrator route**
- `vercel.json` defines a [`crons`](https://vercel.com/docs/cron-jobs) entry pointing at a single secured API route (e.g. `GET /api/cron/orchestrator`) with default schedule `*/15 * * * *`
- Route handler runs one **trading** cycle: fetch **DexScreener** pair snapshots (allowlisted) → each mutant trade/no-trade → route to Bankr / Uniswap / paper mode → append Supabase logs and update execution state
- **Separate cadence:** fitness + evolution (**tiered select**, **capital allocation**, breed, mutate, cull) should run on a **slower daily schedule** (same orchestrator with a daily branch or a separate internal path such as `GET /api/cron/evolution`)
- **Auth:** require `Authorization: Bearer <CRON_SECRET>` (or Vercel’s `CRON_SECRET` env); reject unauthenticated calls so the endpoint is not public
- **Safety:** short request timeout awareness — keep heavy work chunked or async-friendly where possible; use a DB/advisory lock so overlapping invocations cannot double-trade if a run exceeds the cron interval
- **Ops:** document `CRON_SECRET` in env setup; confirm schedule in Vercel project settings after deploy

**P0 — Trading Execution Layer**
- **Bankr Agent API** (api.bankr.bot) — leveraged trading via Avantis on Base (up to 150x, we cap at 10x)
- **Uniswap Trading API** — spot swaps on Base
- **Locus** — autonomous USDC payments with spending controls
- **Bankr LLM Gateway** (llm.bankr.bot) — multi-model analysis (Claude for reasoning, GPT for data parsing, Gemini for speed)
- Planned modules:
  - `src/lib/trading/router.ts` — deterministic venue routing based on strategy family + lifecycle state
  - `src/lib/trading/orchestrator.ts` — one-trader-at-a-time evaluation and structured result logging
  - `src/lib/config/trader-strategies.ts` — typed strategy / venue metadata
  - `src/lib/config/risk.ts` — hard guardrails reused by cron + API surfaces

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
| **Sprint** | Momentum / trend (Bankr Avantis) | Mutant Sprint | `SPRINT` | Base | `TraderProfile` → `bankr launch` or `POST /token-launches/deploy`; `websiteUrl` **`https://mutant.fund`**; `image` = public Supabase Storage URL; optional `tweetUrl` | Dedicated **per-trader** wallet / ENS / `@handle` as Bankr **fee recipient** → proceeds fund **that** trader’s LLM credits or auto top-up | Base **token contract** + **pool** identifiers; **launch tx**; ≥1 **swap** or pool activity tx; **fee claim** or split config screenshot / tx; **LLM** usage line item or credit top-up tied to trader id |
| **Reverb** | Mean-reversion (Uniswap spot bias) | Mutant Reverb | `REVERB` | Base | Same | Same (isolated treasury for Reverb) | Same checklist |
| **Carry** | Funding / basis arb (Bankr Avantis) | Mutant Carry | `CARRY` | Base | Same | Same (isolated treasury for Carry) | Same checklist |
| **Omen** | Discretionary / multi-model narrative (heavy LLM Gateway) | Mutant Omen | `OMEN` | Base | Same | Same; optionally higher fee % to treasury to demo **inference-funded** edge | Same checklist + explicit **model call logs** (redact secrets) in Supabase per `mutant_id` |

*Addresses in the matrix are filled at deploy time and mirrored in Supabase + dashboard + `skill.md` for agents.*

**P1 — Next.js Dashboard (Vercel)**
- Landing page: "Your money, evolved" + invest CTA
- Live dashboard: all mutants, traits, fitness, PnL; cards use **`theme_key`** + **`image_url`** for consistent visuals with token metadata
- Evolution timeline: visual history of generations, mutations, culls
- Mutant detail page: genome visualization, trade history, lineage tree, **trader token contract + pool links (Basescan)**, fee routing summary
- Supabase for caching trade history + evolution logs (faster than querying chain)

**P2 — Per-Mutant Micro-Sites (Locus)**
- Each mutant gets its own micro-site deployed via Locus Build API
- Shows that mutant's genome, trade history, fitness, and lineage
- Demonstrates Locus's fullstack deployment capability

### Risk Management (Hardcoded Guardrails)
- Max leverage: 10x (conservative for Avantis)
- Stop-loss: mandatory per position (genome-defined, min 3%)
- Max single position: 30% of that mutant’s **effective** capital (bankroll × `capital_allocation`)
- Max total portfolio drawdown: 20% → auto-halt all trading
- Min time between trades: 15 minutes
- Max daily trades: 20 per strategy
- Default orchestrator cadence: every 15 minutes, which matches the minimum inter-trade guardrail
- Default evolution cadence: once every 24 hours, separate from trading ticks

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
- [ ] Supabase Storage: public bucket for trader logos (e.g. `trader-assets/`); document RLS / public read policy for hackathon demo
- [ ] Env: `OPENAI_API_KEY` (server-only) for `TraderProfile` text + image generation scripts or secured routes

### Agent interface + onchain
- [ ] Write `public/skill.md` — fund mechanics + API for agents (per-mutant bankroll, **20%** performance fee on realized profit above HWM, redemption, same-NFT revival)
- [ ] Build API routes: `POST /api/invest`, `POST /api/redeem` (or `withdraw`), `GET /api/mutants`, `GET /api/mutants/[id]`, `GET /api/evolution`, `POST /api/revive`, `GET /api/status`
- [ ] Write Solidity escrow (`MutantFund.sol`): `deposit`, `redeem`, **20%** performance fee + HWM, `revive` (same NFT, revival fee split); deploy Base (testnet first, then mainnet as required) using Foundry + [LazerForge](https://github.com/LazerTechnologies/LazerForge) (`forge init --template lazertechnologies/lazerforge contracts`, then `forge build` / `forge script` per LazerForge deployment guide)

### Evolutionary engine
- [ ] Define strategy genome type; random population init + **exploration** immigrants each cycle
- [ ] Fitness: multi-term composite (Sharpe-like, drawdown, turnover/fees, inactivity, correlation; optional novelty + treasury bonus); **regime-aware** multi-window blend
- [ ] **Tiered selection** (elites / survivors / offspring / exploration); **capital allocation** (per-mutant multiplier on **own** bankroll) before hard cull; parent choice favors **low correlation**
- [ ] Crossover + mutation (±10%, clamped); revival path: **same-NFT reactivation** + new genome + cooldowns + revival fee split (protocol vs bankroll seed)
- [ ] Persist mutants and evolution history in Supabase (including `evolution_logs` tier + allocation fields)
- [ ] Keep evolution on a **slower daily cadence** than trading evaluation; do not mutate / breed on every 15-minute orchestrator tick

### Trading + economics
- [ ] Bankr Agent API (Avantis); Uniswap swaps; Locus + spending controls
- [ ] **`market-data.ts`:** DexScreener-only fetches for Base; **allowlist** (min liquidity / volume / quote token); normalize **m5/h1/h6/h24** price change, volume, liquidity, tx counts into strategy inputs — **no candle APIs**
- [ ] Add `src/lib/config/trader-strategies.ts` and `src/lib/config/risk.ts` as the typed source of truth for venue routing, cooldowns, timeframes, and leverage support
- [ ] Add `src/lib/trading/router.ts` and `src/lib/trading/orchestrator.ts` so each cycle can persist one of: `trade_executed`, `no_trade_signal`, `blocked_by_risk`, `blocked_by_limits`
- [ ] **Trader metadata:** define seed `TraderProfile` records (theme, description ≤500 chars, `imagePrompt`); generate images via OpenAI; upload to Supabase Storage; set `websiteUrl` to **`https://mutant.fund`** on every Bankr deploy unless a per-mutant site URL exists
- [ ] **Per-trader token roster:** lock seed names/symbols (Sprint, Reverb, Carry, Omen) or update matrix + env/config
- [ ] **Launch one Bankr token per seed trader** on Base (`bankr launch … --yes` or `POST /token-launches/deploy`); pass `description`, `image` (Supabase public URL), `websiteUrl`; store **contract + pool + launch tx** + mirrored profile fields in Supabase
- [ ] **Fee routing:** configure [fee splitting / redirect](https://docs.bankr.bot/token-launching/fee-splitting) so each trader’s **creator share** flows to **that trader’s treasury** (dedicated Bankr sub-wallet or labeled wallet per mutant)
- [ ] **Fund inference per trader:** allocate claimed fees or LLM credits so **LLM Gateway** usage for mutant `id` is attributable (dashboard + logs); optional **auto top-up** per [LLM Gateway credits](https://docs.bankr.bot/llm-gateway/overview)
- [ ] **OpenClaw / agents:** install [Bankr skill](https://docs.bankr.bot/openclaw/installation) for demos where an agent performs launch/trade helpers; keep **dedicated agent API keys** per Bankr guidance
- [ ] Execute real trades on Base; fund mutant wallets (~$50–100 total)

### Vercel Cron (orchestrator)
- [ ] Add `vercel.json` with `crons` mapping to `GET /api/cron/orchestrator` and default schedule `*/15 * * * *`
- [ ] Implement `src/app/api/cron/orchestrator/route.ts`: verify cron secret, run the **trading** orchestration (DexScreener snapshots → decisions → execute or no-trade → logs / state)
- [ ] Add a separate slower daily evolution path (`GET /api/cron/evolution` or internal scheduler branch) for fitness, selection, capital allocation updates, breeding, mutation, and cull decisions
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
├── contracts/                # Foundry project (e.g. from LazerForge template)
│   ├── foundry.toml          # Profiles, optimizer, Base RPC via env (see LazerForge)
│   ├── src/
│   │   └── MutantFund.sol    # Escrow + ERC-8004 minting + mutant metadata
│   └── script/               # `forge script` deploy / verify flows
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
│   │       │   └── route.ts  # POST — mint new mutant or top up bankroll (escrow deposit)
│   │       ├── redeem/
│   │       │   └── route.ts  # POST — NFT holder withdraws idle USDC (after fees / margin checks)
│   │       ├── mutants/
│   │       │   ├── route.ts  # GET — list all mutants
│   │       │   └── [id]/
│   │       │       └── route.ts  # GET — mutant detail + trades
│   │       ├── evolution/
│   │       │   └── route.ts  # GET — evolution state + history + tier counts + allocation shifts
│   │       ├── revive/
│   │       │   └── route.ts  # POST — revival payment → same NFT, new genome; fee split + bankroll seed
│   │       ├── cron/
│   │       │   └── orchestrator/
│   │       │       └── route.ts  # GET — Vercel Cron: 15-minute trading cycle (secret-gated)
│   │       └── status/
│   │           └── route.ts  # GET — fund health + aggregate TVL (sum of per-mutant escrow)
│   ├── lib/
│   │   ├── evolution/
│   │   │   ├── genome.ts     # Strategy genome type + random init
│   │   │   ├── fitness.ts    # Multi-term + regime-aware fitness
│   │   │   ├── selection.ts  # Tiered selection, elites/survivors/offspring/exploration
│   │   │   ├── crossover.ts  # Parameter crossover (low-correlation parent pairs)
│   │   │   ├── mutation.ts   # Random mutation (clamped)
│   │   │   ├── allocation.ts # Capital allocation + cull thresholds
│   │   │   └── revival.ts    # Same-NFT revival eligibility + cooldown validation
│   │   ├── trading/
│   │   │   ├── orchestrator.ts # Per-trader evaluation loop + structured outcomes
│   │   │   ├── router.ts     # Deterministic venue router by strategy family
│   │   │   ├── bankr.ts      # Bankr API integration (Avantis trades)
│   │   │   ├── uniswap.ts    # Uniswap swap execution
│   │   │   ├── locus.ts      # Locus payment integration
│   │   │   ├── token.ts      # Bankr token deploy + fee redirect per mutant
│   │   │   └── market-data.ts # DexScreener: Base pairs, allowlist filters, snapshot signal fields (no candles)
│   │   ├── analysis/
│   │   │   └── multi-model.ts # Bankr LLM Gateway multi-model analysis
│   │   ├── identity/
│   │   │   └── erc8004.ts    # ERC-8004 mutant identity management
│   │   ├── db/
│   │   │   └── supabase.ts   # Supabase client + queries
│   │   └── config/
│   │       ├── trader-strategies.ts # Typed strategy routing + cadence metadata
│   │       ├── risk.ts       # Hardcoded risk guardrails
│   │       ├── env.ts        # Environment + API keys
│   │       └── trader-profiles.ts  # Seed TraderProfile constants + theme keys (source for Bankr + UI)
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
  trader_description text,         -- short copy; mirror Bankr token description (max 500 chars on deploy)
  theme_key text,                   -- e.g. sprint-momentum; drives dashboard / card styling
  image_url text,                   -- public Supabase Storage URL passed to Bankr `image`
  image_prompt text,                -- last OpenAI image prompt (reproducibility)
  website_url text default 'https://mutant.fund', -- Bankr `websiteUrl`; override if per-mutant site
  tweet_url text,                   -- optional Bankr `tweetUrl`
  metadata_version integer default 1 not null,  -- bump when profile fields change post-launch
  trader_token_address text,        -- ERC-20 on Base (Bankr-launched)
  trader_token_symbol text,
  trader_pool_id text,              -- Uniswap v4 pool id or pool address (as returned by Bankr tooling)
  bankr_launch_tx_hash text,       -- Token deploy / launch tx on Base
  fee_treasury_address text,        -- Where creator fees are directed (per-trader)
  genome jsonb not null,            -- Strategy parameters
  fitness float default 0,
  pnl float default 0,               -- Display / rolling realized PnL (mirror onchain + trades; fee engine may use high_water_mark separately)
  generation integer default 0,
  parent_ids uuid[],                -- Lineage tracking (breeding); revival keeps same row / token_id
  lifecycle_status text default 'active', -- active, benched, culled, probation_revival, breeding, exploration_seed
  capital_allocation numeric default 1.0 check (capital_allocation >= 0), -- multiplier on this mutant's own bankroll for position sizing (0 = benched)
  principal_deposited numeric default 0,   -- net USDC deposited into this mutant's escrow (mirror contract)
  reserved_margin numeric default 0,       -- USDC / notional locked in open positions (off-chain or synced)
  withdrawable_balance numeric default 0,  -- idle USDC available to redeem after fees (mirror or derived)
  high_water_mark numeric default 0,       -- post-fee equity high-water mark for 20% performance fee on new realized profit
  last_trade_at timestamptz,               -- last live trade execution timestamp (for cooldown checks)
  last_evaluated_at timestamptz,           -- last orchestrator evaluation, even when no trade fired
  trades_today integer default 0 not null, -- per-mutant rolling daily execution count
  last_signal_status text,                 -- trade_executed, no_trade_signal, blocked_by_risk, blocked_by_limits
  halt_reason text,                        -- null unless globally or locally halted
  last_revival_at timestamptz,             -- last same-NFT revival timestamp
  revival_count integer default 0 not null,
  novelty_score float default 0,          -- optional diversity signal
  correlation_score float default 0,      -- optional crowding vs cohort (rolling)
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
  generation integer not null,
  elite_ids uuid[],
  survivor_ids uuid[],
  offspring_ids uuid[],
  explorer_ids uuid[],              -- random "immigrant" genomes this cycle
  culled uuid[],
  revived_ids uuid[],               -- mutant rows same-NFT reactivated via POST /api/revive this cycle (if any)
  tier_counts jsonb,                -- e.g. {"elite":2,"survivor":6,"offspring":3,"exploration":1}
  allocation_summary jsonb,         -- capital reallocations / notable per-id deltas for dashboards
  mutations jsonb,                  -- what params changed (offspring)
  avg_fitness float,
  avg_correlation float,            -- optional cohort metric snapshot post-selection
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
> Deposit USDC → mint a Mutant — an ERC-8004 agent with unique trading traits. **Your USDC backs that mutant’s own on-escrow bankroll**; you’re not buying a blind pool slice. When the strategy **realizes profit**, the protocol takes **20%** of new profit above a **high-water mark** — then **you** (the **current NFT holder**) can **redeem idle USDC** when margin isn’t locked. Your mutant joins a population of competing strategies on Base. Every cycle, **tiered selection** reshapes the roster: elites hold ground, survivors keep trading with **sizing multipliers** on **their** bankroll, offspring inherit **mutated** traits from **low-correlation** parents, and fresh explorers keep the gene pool honest. The weak lose budget first, then get culled. **Revival** is **the same NFT** with a **new strategy** and a **fresh bankroll seed** after a **revival fee** — not a pay-to-win reset of the old edge.
>
> No single strategy to blow up. No black box. Every trade and mutation logged onchain. Human guardrails enforced by smart contract.
>
> Jim Simons proved that running many uncorrelated, constantly-adapting strategies beats any single bet. We made that autonomous. Darwin meets DeFi."
>
> Each trader also **launches its own token on Base**: swap fees and configured splits **route into that trader’s treasury**, which **funds its own LLM inference** via Bankr’s gateway — selection pressure isn’t only PnL, it’s **whether the token economy can pay for the agent’s brain**.

---

## Sources
- [DexScreener](https://dexscreener.com) — Base pair discovery + snapshot metrics (MVP market-data policy)
- [OpenAI API — Text generation](https://platform.openai.com/docs/guides/text-generation)
- [OpenAI API — Image generation](https://platform.openai.com/docs/guides/image-generation)
- [Bankr Token Deploy API](https://docs.bankr.bot/token-launching/deploy-api)
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
