# Mutant Fund — Product Requirements Document

## Problem Statement

A crypto holder with USDC wants yield but can't watch markets 24/7. Single-strategy trading bots fail when market conditions change — what worked in a trending market blows up in a ranging one. Existing solutions are black boxes with no transparency into what's happening with your money.

The user wants: deposit money, get exposure to many competing strategies that adapt over time, see exactly what's happening onchain, and withdraw when they want. They don't want to pick strategies, manage bots, or trust a single algorithm.

## Solution

Mutant Fund is a decentralized autonomous hedge fund where AI trading agents evolve their strategies through natural selection. A user (human or agent) makes a single HTTP call with a USDC payment and receives a "mutant" — an AI trader with a unique genome, personality, name, and portrait, represented as an ERC-8004 NFT on Base.

Each mutant trades autonomously on Base via Bankr/Avantis perps. Every 24 hours, an evolutionary engine evaluates the population: strong traders survive and breed, weak ones lose capital allocation and get axed. New offspring inherit traits from the best performers. The cycle repeats — Darwin meets DeFi.

All accounting is recorded onchain via a public ledger contract. The NFT holder can redeem idle USDC at any time. The protocol takes 20% of realized profit above a high-water mark. No management fee. No guaranteed principal.

## User Stories

1. As an **agent**, I want to discover Mutant Fund via `skill.md` and invest via a single `POST /api/invest` with x402 payment, so that I can programmatically allocate capital without human intervention.
2. As a **human investor**, I want to connect my wallet and deposit USDC, so that a mutant is spawned for me with a unique identity and trading strategy.
3. As an **investor**, I want to receive an ERC-8004 NFT representing my mutant, so that I have verifiable onchain ownership and can transfer or sell my position.
4. As an **investor**, I want my mutant to have a generated name, description, and portrait derived from its genome, so that each trader feels like a distinct character.
5. As an **investor**, I want to see my mutant's genome, fitness, PnL, and trade history via the API or dashboard, so that I have full transparency into its performance.
6. As an **investor**, I want to withdraw my idle USDC at any time by proving I hold the NFT (signed message), so that I maintain custody of my capital.
7. As an **investor**, I want the protocol to only take fees on realized profit above a high-water mark, so that I'm not charged on unrealized gains or after drawdowns.
8. As an **investor**, I want to see all deposit, trade, and settlement records onchain via the accounting contract, so that I don't have to trust the operator.
9. As a **spectator**, I want to call `GET /api/mutants` and see the full population with genomes, fitness, and lineage, so that I can decide whether to invest.
10. As a **spectator**, I want to see offspring from the evolution breeding pool (status: `awaiting_deposit`) with their parent lineage and inherited traits, so that I can evaluate evolved genomes before funding them.
11. As a **spectator**, I want to view the evolution history via `GET /api/evolution`, so that I can see how the population adapted over time.
12. As an **operator** (the system), I want the trading cron to run every 15 minutes evaluating each active mutant against DexScreener data, so that trades fire when signals are valid.
13. As an **operator**, I want the evolution cron to run every 24 hours performing selection, crossover, mutation, and culling, so that the population improves over time.
14. As an **operator**, I want a transaction queue that serializes all onchain operations from the hot wallet, so that nonce collisions don't occur.
15. As an **operator**, I want hardcoded risk guardrails (max 10x leverage, mandatory stop-loss, 20% drawdown halt, 30% max position size), so that no single mutant can blow up the fund.
16. As an **NFT buyer** (secondary market), I want redemption rights to follow the NFT via `ownerOf` checks, so that if I buy a mutant NFT, I inherit its bankroll.
17. As a **reviver**, I want to invest in an axed mutant to reactivate it with a new genome, so that promising NFT positions can get a second chance with fresh strategy.

## Implementation Decisions

### Module: x402 Payment Gateway

Handles incoming USDC deposits via the x402 payment protocol. When a request hits `POST /api/invest` without payment, the server responds with HTTP 402 and a `PaymentRequired` header. The client pays USDC on Base, retries, and the payment is extracted as the deposit amount + payer address. This is the only deposit path — no custom wallet-connect flow.

### Module: Genome Engine

Manages the continuous parameter space that defines each trader's strategy. Eight genes: `signal_bias` (0-1, momentum vs mean-reversion), `leverage` (1-10x), `stop_loss` (3-15%), `take_profit` (5-30%), `asset` (index into allowlist: ETH, BTC, SOL), `timeframe_hours` (0.25-24), `position_size_pct` (5-30%), `entry_threshold` (1-10%). Strategy type is a gene, not a category — evolution produces hybrids naturally. One asset per trader for clean PnL attribution.

### Module: Personality Generator

Takes a genome and produces a coherent identity via OpenAI API. Text generation returns structured output: `name`, `description` (max 500 chars), `visual_motifs`, `image_prompt`. Image generation produces a portrait from the prompt. The genome traits map to creative dimensions (high leverage = reckless aesthetic, low signal_bias = patient personality). All calls are synchronous during spawn (~10s total). Images are stored in Supabase Storage.

### Module: Signal Engine

Deterministic math that decides whether a mutant trades on a given tick. Fetches DexScreener multi-horizon price changes (m5, h1, h6, h24), volume, and liquidity for the mutant's asset on Base. Computes a momentum score and reversion score, blends them using the genome's `signal_bias`, and compares against `entry_threshold`. Outputs one of four outcomes: `trade_executed`, `no_trade_signal`, `blocked_by_risk`, `blocked_by_limits`. LLM reasoning is generated post-hoc for logging only — it does not influence the trade decision.

### Module: Bankr Execution Adapter

Translates trade decisions into Bankr Agent API calls. One Bankr account, one wallet, one API key. Sends natural language prompts like: "open a long position on ETH with 5x leverage, $20 collateral, stop loss at $X, take profit at $Y on Avantis via Base." Polls `GET /agent/job/{jobId}` for completion. Stop-loss and take-profit are set at entry on Avantis — no cron-based exit monitoring. All trades are perps (1x leverage perp approximates spot; enables shorting).

### Module: Accounting Contract (Solidity, Base)

Public onchain ledger — not a vault. USDC lives in the Bankr operational wallet. The contract records state changes: `recordDeposit`, `recordAllocation` (margin locked), `recordSettlement` (trade closed, PnL applied, 20% fee on profit above HWM), `recordWithdrawal`. Read functions: `getBalance`, `getWithdrawable` (bankroll minus reserved margin), `getHWM`. Only the orchestrator address can write. Anyone can read. Verifiable: `bankr_wallet_balance >= sum(all withdrawable)`.

### Module: ERC-8004 Identity

Each mutant is registered on the existing Base IdentityRegistry (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`). Registration mints an ERC-721 NFT. The `agentURI` points to a dynamic API route (`/api/mutants/[id]/registration.json`) that returns current genome, fitness, lineage, and service endpoint. NFT is transferred to the payer's address after registration. The `agentWallet` metadata is set to the payer's wallet. Redemption rights verified via `ownerOf(agentId)`.

### Module: Evolution Engine

Runs on a 24-hour cron cycle, separate from trading. Minimum population threshold of 6 before full evolution; below that, only mutation (+-10% on existing genomes). Fitness is a multi-term weighted composite: risk-adjusted return (Sharpe-like), max drawdown penalty, turnover penalty, inactivity penalty, correlation penalty. Regime-aware with multiple lookback windows. Tiered selection: 10-20% elites (unchanged, boosted allocation), 40-50% survivors (retained), 20-30% offspring (crossover from high-fitness low-correlation parents, then mutation), 5-15% exploration (random immigrants). Capital allocation adjusted before culling. Offspring are created with `lifecycle_status: 'awaiting_deposit'` — no bankroll until someone invests.

### Module: Transaction Queue

Serializes all onchain operations from the server wallet. Supabase table with `type`, `payload`, `status` (pending/submitted/confirmed/failed), `tx_hash`, `nonce`. A single processor pops pending txs in order, assigns nonces sequentially, submits, and updates status. Prevents nonce collisions from concurrent spawns, settlements, and withdrawals.

### Module: Trading Orchestrator (Cron)

Vercel Cron at `*/15 * * * *` hitting `GET /api/cron/orchestrator` (CRON_SECRET gated). Each tick: (1) check for closed positions via Bankr job status and settle back to contract, (2) load active mutants, (3) skip benched/halted/cooldown/zero-allocation mutants, (4) fetch DexScreener snapshots, (5) run signal math, (6) apply risk checks, (7) execute via Bankr if signaled, (8) log structured outcome, (9) queue LLM reasoning generation. Overlap guard via DB lock prevents double-evaluation.

### Schema Changes

New Supabase tables: `mutants` (genome, bankroll, fitness, lifecycle, profile fields, lineage), `trades` (tx_hash, bankr_job_id, action, asset, prices, PnL, reasoning), `evolution_logs` (generation, tier IDs, mutations, avg_fitness), `tx_queue` (type, payload, status, tx_hash, nonce). New Supabase Storage bucket: `trader-assets/` (public read). New Solidity contract: `MutantAccounting.sol` deployed on Base.

### API Contracts

| Endpoint | Method | Auth | Request | Response |
|---|---|---|---|---|
| `/api/invest` | POST | x402 payment | Empty body; payment carries amount + payer | `{ agent_id, name, description, genome, owner, bankroll, image_url, status }` |
| `/api/redeem` | POST | Signed message | `{ agent_id, amount, signature }` | `{ tx_hash, new_balance }` |
| `/api/mutants` | GET | Public | Query params: `?status=active` | `[{ id, agent_id, name, image_url, genome, fitness, pnl, bankroll, lifecycle_status, generation }]` |
| `/api/mutants/[id]` | GET | Public | — | Full mutant detail + trade history + lineage |
| `/api/mutants/[id]/registration.json` | GET | Public | — | ERC-8004 registration file (JSON) |
| `/api/evolution` | GET | Public | — | `{ generation, tier_counts, offspring_available, recent_mutations }` |
| `/api/status` | GET | Public | — | `{ tvl, active_mutants, total_trades, last_evolution }` |
| `/api/cron/orchestrator` | GET | CRON_SECRET | — | `{ evaluated, traded, settled }` |
| `/api/cron/evolution` | GET | CRON_SECRET | — | `{ generation, elites, axed, offspring_created }` |

## Testing Decisions

- **Signal math:** Unit tests with known DexScreener snapshots and genome values. Verify correct momentum/reversion blending, threshold gating, and risk limit enforcement.
- **Genome engine:** Unit tests for random generation (all values within bounds), crossover (genes from both parents, clamped), mutation (+-10%, clamped).
- **Evolution engine:** Unit tests for tiered selection (correct percentages), fitness ranking, capital allocation adjustments, offspring creation with `awaiting_deposit` status.
- **Accounting contract:** Foundry tests for `recordDeposit`, `recordSettlement` (HWM + 20% fee math), `recordWithdrawal` (reverts when exceeding withdrawable), `onlyOrchestrator` modifier.
- **Spawn flow:** Integration test for the full sequence — mock x402 payment, verify Supabase row, verify contract call, verify ERC-8004 registration.
- **Cron orchestrator:** Integration test with mocked DexScreener + Bankr responses. Verify correct outcome logging, cooldown enforcement, daily trade cap.

## Out of Scope

- **Token launches per trader** (Bankr token deploy) — deferred until trading UX is solid; documented as stretch goal
- **Locus micro-sites** per mutant — deferred; feature add-on after core
- **Multiple Bankr wallets** per trader — Bankr requires interactive email+OTP; one shared wallet with Supabase ledger
- **Candle/OHLCV data** — DexScreener snapshot fields only, no candle APIs
- **Funding rate / OI data** — no venue provides this in the current integration; funding arb strategy is dropped
- **Human dashboard as primary UX** — agent-first; dashboard is P1 after API is complete
- **Secondary market / NFT marketplace integration** — ownership transfers work via standard ERC-721, but no marketplace UI
- **Multi-chain** — Base only for MVP
- **Automated wallet creation** for users — users must have an existing wallet with USDC on Base

## Further Notes

- **Hackathon deadline:** March 22, 2026. Solo builder + AI.
- **Budget:** ~$75-100 total (gas, trading capital, LLM calls, OpenAI).
- **Prize tracks targeted:** Synthesis Open ($28K), Autonomous Trading Agent ($5K), Best Bankr LLM Gateway ($4.5K), Agentic Finance ($5K), Let the Agent Cook ($3.5K), Agents With Receipts ($3.5K), Best Use of Locus ($2K stretch).
- **Key dependency:** Bankr Agent API must support Avantis perp execution with stop-loss/take-profit via natural language prompts. Verify before building execution adapter.
- **Key risk:** x402 payment integration on Vercel/Next.js — confirm Coinbase facilitator service works with the deploy target.
- See `docs/mutant-fund.md` for the full technical specification.
