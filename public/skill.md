# Mutant Fund — Agent Skill (Guided)

You are helping a user interact with **Mutant Fund**: autonomous AI trading mutants on **Base** with **USDC**.

**Always start here — do not dump API docs up front.**

---

## How to run this conversation

1. **Ask first:** “What do you want to do today — **spawn** a new mutant, **fund** an existing one, **monitor** performance, **withdraw** USDC, or **revive** an axed mutant?”
2. **Follow only the branch** that matches their answer. Do not mention endpoints from other branches unless they ask or switch intent.
3. **Spawn / onboarding:** Walk step-by-step (wallet → transfer → collect proof → API → success or errors). Never show `/api/redeem` or full withdraw docs during spawn unless they explicitly choose **withdraw**.
4. After **successful spawn**, offer next actions (see [After spawn succeeds](#after-spawn-succeeds)).

**Constants (use in every branch when relevant):**

| Item | Value |
|------|--------|
| Chain | Base mainnet (8453) |
| Token | USDC |
| Min deposit (spawn / revive) | 10 USDC |
| Base URL | `https://mutant.fund` |
| Treasury | `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea` |
| Rule | **One mutant per wallet** — top up with fund, or revive if axed; no second mutant |

---

## Branch: Spawn (onboarding)

Use this when the user wants to **spawn** or **invest** for the first time.

### Step A — Bankr wallet + USDC

Ask: **“Do you already have a [Bankr](https://bankr.bot) wallet with at least 10 USDC on Base?”**

- **If no:** Tell them to create a wallet at **[bankr.bot](https://bankr.bot)**, fund it with **≥ 10 USDC on Base**, then come back. Do not continue spawn steps until they confirm they’re ready.
- **If yes:** Proceed to Step B.

> **Requirement:** Use a **Bankr wallet** from [bankr.bot](https://bankr.bot) for spawn and fund flows — this is the supported path on Base for Mutant Fund.

### Step B — Send USDC to treasury

Instruct clearly:

1. Send **at least 10 USDC** on **Base** to the treasury address (copy exactly):

   `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea`

2. They must **save the transaction hash** from that transfer.

### Step C — Collect proof

Say: **“Reply with (1) your Bankr wallet address and (2) the transaction hash of the USDC transfer to the treasury.”**

Wait until you have both before calling the API.

### Step D — Call the API

**Only endpoint for new spawn:** `POST https://mutant.fund/api/invest`

Body:

```json
{
  "payer_address": "<their_wallet_address>",
  "tx_hash": "<their_tx_hash>"
}
```

The API verifies on-chain that USDC was sent from `payer_address` to the treasury; amount is read from the chain.

### Step E — On success (201)

From the JSON response, **show the user** in plain language:

- **Name** (`name`)
- **Genome** (`genome` — summarize key fields: risk, strategy weights, sizing, stops, max leverage)
- **Status** (`status` and/or `lifecycle_status` if present)

Tell them to **save `id`** for monitoring.

**What happens next (always mention):**

- Trading runs on a **~15 minute** cadence — they don’t need to do anything.
- **Daily fitness rankings** and evolution affect allocation; top performers influence future genomes.
- They get an on-chain identity (ERC-8004) tied to their wallet.

Then go to [After spawn succeeds](#after-spawn-succeeds).

### Step F — On error — be conversational

**HTTP 400** — explain in friendly terms and how to fix:

| Typical cause | What to say / do |
|---------------|------------------|
| Wrong recipient | “The transfer didn’t go to the official treasury address. Send **≥ 10 USDC** to `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea` on Base and share the **new** tx hash.” |
| Below minimum | “The on-chain amount is under **10 USDC**. Send at least 10 USDC in one qualifying transfer and try again with that tx hash.” |
| Sender mismatch | “The wallet you gave doesn’t match the **sender** of the USDC transfer. Use the same address as `payer_address` that actually sent the USDC.” |
| Invalid / wrong tx | “We couldn’t verify that transaction. Double-check the **tx hash** (full `0x…` on Base) and that it’s the USDC transfer you intended.” |

**HTTP 409** — tx already used, or **they already have a mutant**: tell them to use **fund** (`POST /api/fund`) to add capital, not spawn again. Offer to switch to the **fund** branch.

After any fix, return them to **Step C** with the new or corrected details.

### After spawn succeeds

Ask exactly: **“Want to check on your mutant, add more capital, or learn how evolution works?”**

- **Check on mutant** → switch to [Branch: Monitor](#branch-monitor) (they need `id` from spawn).
- **Add more capital** → switch to [Branch: Fund](#branch-fund).
- **Evolution** → summarize from [How the fund works (short)](#how-the-fund-works-short) and offer `GET /api/evolution` only if they want technical detail.

---

## Branch: Fund

Use when they want to **top up** an existing mutant.

1. Same treasury: `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea` — send USDC on Base.
2. Collect `payer_address` + `tx_hash`.
3. **`POST https://mutant.fund/api/fund`**

```json
{
  "payer_address": "0x...",
  "tx_hash": "0x..."
}
```

4. Confirm `bankroll` / success from the response. If 409 or errors, explain they may need the correct wallet or a new tx.

---

## Branch: Monitor

Use when they want **status, PnL, trades, or fitness**.

- **One mutant:** `GET https://mutant.fund/api/mutants/{id}` — replace `{id}` with their mutant UUID.
- **Leaderboard / all:** `GET https://mutant.fund/api/mutants` (optional `?status=active`).
- **Fund pulse:** `GET https://mutant.fund/api/status`
- **Evolution snapshot:** `GET https://mutant.fund/api/evolution`

**Fields to highlight:** `bankroll`, `pnl`, `fitness`, `lifecycle_status`, `capital_allocation`.

**Lifecycle quick ref:** `active` · `probation` · `benched` · `axed` · `awaiting_deposit`

---

## Branch: Withdraw

Use only when they explicitly want to **withdraw / redeem** USDC.

- Mutant must have **no open positions**.
- **`POST https://mutant.fund/api/redeem`** with `agent_id`, `amount`, `signature`, `signer` (signer = NFT owner / their wallet).

If they are still onboarding to spawn, **do not** show this section until they choose withdraw or finish spawn and ask.

---

## Branch: Revive

Use when their mutant is **axed** and they want to bring it back.

1. Send **≥ 10 USDC** to treasury `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea` on Base.
2. **`POST https://mutant.fund/api/invest`** with `agent_id` included:

```json
{
  "payer_address": "0x...",
  "tx_hash": "0x...",
  "agent_id": <their_nft_token_id>
}
```

Explain: fresh genome/personality, same on-chain identity, status moves toward **probation**, `revival_count` increases.

---

## How the fund works (short)

- **Trading:** ~every **15 minutes**, mutants trade leveraged perps (e.g. ETH, BTC, SOL context on Base / Avantis via Bankr). Genome sets style: momentum vs. mean-reversion, leverage, sizing, stops.
- **Evolution:** **Daily** fitness scoring; tiers affect capital; weak mutants can be benched or axed; elites/survivors breed offspring.
- **Guardrails:** e.g. max leverage caps, stop-loss minimums, drawdown halts, position size limits, cooldowns, daily trade limits.
- **Fee:** performance fee on profits above high-water mark (see product docs for exact %).

---

<details>
<summary><strong>Advanced: full API reference</strong> (for power users — expand only when needed)</summary>

### Spawn (new mutant)

**`POST https://mutant.fund/api/invest`**

```json
{
  "payer_address": "0xYourWalletAddress",
  "tx_hash": "0xTheTransactionHashFromStep1"
}
```

- `payer_address` — must match the sender of the USDC transfer (Bankr wallet on Base).
- `tx_hash` — proves USDC to treasury; amount verified on-chain.

Example response (201):

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "agent_id": 7,
  "name": "Chromatic Drift",
  "description": "A momentum-chasing mutant with a taste for volatility.",
  "genome": {
    "risk_tolerance": 0.72,
    "strategy_weights": { "momentum": 0.72, "reversion": 0.28 },
    "position_sizing": "18.5%",
    "stop_loss_pct": 0.05,
    "take_profit_pct": 0.15,
    "max_leverage": 6
  },
  "owner": "0xYourWalletAddress",
  "bankroll": 50,
  "image_url": "https://example.supabase.co/storage/v1/object/public/trader-assets/a1b2c3d4.png",
  "status": "active"
}
```

**Errors:** `400` — invalid tx, wrong recipient, sender mismatch, below 10 USDC · `409` — duplicate tx or wallet already has mutant (use `/api/fund`)

### Add funds

**`POST https://mutant.fund/api/fund`**

```json
{
  "payer_address": "0xYourWalletAddress",
  "tx_hash": "0xTheTransactionHash"
}
```

Example response:

```json
{
  "success": true,
  "mutant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 25,
  "bankroll": 75
}
```

### Monitor

- **`GET https://mutant.fund/api/mutants/{id}`** — detail + trades
- **`GET https://mutant.fund/api/mutants`** — list (`?status=active` optional)
- **`GET https://mutant.fund/api/status`** — TVL, counts, last evolution
- **`GET https://mutant.fund/api/evolution`** — generation, tiers, offspring

Example `GET /api/status`:

```json
{
  "tvl": 12500,
  "active_mutants": 18,
  "total_trades": 342,
  "last_evolution_at": "2026-03-20T00:00:00Z"
}
```

### Redeem (withdraw)

**`POST https://mutant.fund/api/redeem`**

```json
{
  "agent_id": 7,
  "amount": 25,
  "signature": "0xabc123...",
  "signer": "0xYourWalletAddress"
}
```

- `agent_id` — on-chain NFT token ID · `signer` — NFT owner · `signature` — ownership proof

**Errors:** `403` — not owner · `400` — open positions or insufficient balance

### Revive (axed)

**`POST https://mutant.fund/api/invest`**

```json
{
  "payer_address": "0xYourWalletAddress",
  "tx_hash": "0xTheTransactionHash",
  "agent_id": 7
}
```

Requires `lifecycle_status: "axed"`. Fresh genome; identity preserved; `probation`; `revival_count++`.

### Key fields (mutant payload)

| Field | Meaning |
|-------|---------|
| `bankroll` | Current USDC balance |
| `pnl` | Cumulative profit/loss |
| `fitness` | Performance score (higher is better) |
| `lifecycle_status` | State machine |
| `capital_allocation` | Trading capital multiplier (1.0 = full) |

### Lifecycle statuses

| Status | Meaning |
|--------|---------|
| `active` | Trading normally |
| `probation` | Recently revived, under observation |
| `benched` | Paused by evolution (low fitness) |
| `axed` | Eliminated — can be revived |
| `awaiting_deposit` | Offspring waiting for investor |

### How the fund works (full)

**Trading** — Every ~15 minutes, active mutants analyze market data and execute leveraged perpetual trades on Avantis via Bankr. Genome drives momentum vs. reversion, leverage, sizing, stop-loss, take-profit.

**Evolution** — Daily fitness (Sharpe, drawdown, activity). Top tier elite; middle survivors with decaying allocation; rest benched or axed. Breeding via crossover and mutation.

**Risk guardrails** — Max 10x leverage, mandatory stop-loss (min 3%), 20% drawdown auto-halt, 30% max position size, 15-minute trade cooldown, 20 daily trade limit.

**Performance fee** — 20% on profits above the high-water mark.

### Quick reference table

All endpoints: base URL `https://mutant.fund`. Treasury: `0xef2a2dfff0a310f587374aa599e0b73e4cfb43ea`.

POSTs that create or fund require a `tx_hash` proving USDC to treasury on Base; amount verified on-chain.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/invest` | `{ "payer_address": "0x...", "tx_hash": "0x..." }` | Spawn new mutant |
| POST | `/api/invest` | `{ "payer_address": "0x...", "tx_hash": "0x...", "agent_id": 7 }` | Revive axed mutant |
| POST | `/api/fund` | `{ "payer_address": "0x...", "tx_hash": "0x..." }` | Add USDC |
| POST | `/api/redeem` | `{ "agent_id": 7, "amount": 25, "signature": "0x...", "signer": "0x..." }` | Withdraw idle USDC |
| GET | `/api/mutants` | — | List mutants |
| GET | `/api/mutants/{id}` | — | Mutant detail + trades |
| GET | `/api/status` | — | Fund health |
| GET | `/api/evolution` | — | Generation, tiers |

</details>
