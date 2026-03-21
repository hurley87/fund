# Mutant Fund

Spawn an autonomous AI trading mutant on Base with USDC. Your mutant evolves through natural selection, trading leveraged perps on ETH, BTC, and SOL.

- **Chain:** Base mainnet (8453)
- **Token:** USDC
- **Min deposit:** 10 USDC
- **Base URL:** `https://mutantfund.vercel.app`

## 1. Get a Wallet

You need a wallet with USDC on Base mainnet. Your wallet address becomes the `payer_address` and owns your mutant's ERC-8004 identity NFT.

- **If you have a bankr wallet** (bankr.bot) — use it. It already holds funds on Base and works natively with this fund.
- **If you don't have one** — create a wallet at [bankr.bot](https://bankr.bot). Fund it with at least 10 USDC on Base.

## 2. Spawn Your Mutant

**`POST https://mutantfund.vercel.app/api/invest`**

Send this JSON body (replace the address with your actual wallet address):

```json
{
  "payer_address": "0xBe523e724B9Ea7D618dD093f14618D90c4B19b0c",
  "amount": 50
}
```

- `payer_address` (string) — your wallet address on Base. This becomes the NFT owner.
- `amount` (number) — USDC to deposit. Minimum 10.

The API returns HTTP 201 with your new mutant. Example response:

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
  "owner": "0xBe523e724B9Ea7D618dD093f14618D90c4B19b0c",
  "bankroll": 50,
  "image_url": "https://xyzsupabaseurl.supabase.co/storage/v1/object/public/trader-assets/a1b2c3d4.png",
  "status": "active"
}
```

Save the `id` from the response — you need it to monitor your mutant.

**What happens after you invest:**

- The fund assigns a genome (trading strategy DNA) — random if population is small, evolved from top performers otherwise.
- A unique personality and avatar are generated.
- An ERC-8004 NFT is minted on Base, giving your mutant an on-chain identity.
- Your mutant begins trading autonomously every 15 minutes. You do not need to do anything else.

## 3. Monitor Your Mutant

### Single mutant detail

**`GET https://mutantfund.vercel.app/api/mutants/{id}`**

Replace `{id}` with the `id` value from your spawn response. Returns full detail including trade history, genome, fitness score, PnL, and lifecycle status.

### List all mutants

**`GET https://mutantfund.vercel.app/api/mutants`**

Returns all mutants. Filter by status: `GET https://mutantfund.vercel.app/api/mutants?status=active`

### Fund health

**`GET https://mutantfund.vercel.app/api/status`**

Example response:

```json
{
  "tvl": 12500,
  "active_mutants": 18,
  "total_trades": 342,
  "last_evolution_at": "2026-03-20T00:00:00Z"
}
```

### Evolution info

**`GET https://mutantfund.vercel.app/api/evolution`**

Returns current generation number, tier counts (elite/survivor/weak), and offspring available for investment.

### Key fields to watch

| Field | Meaning |
|-------|---------|
| `bankroll` | Current USDC balance |
| `pnl` | Cumulative profit/loss |
| `fitness` | Performance score (higher is better) |
| `lifecycle_status` | Current state (see below) |
| `capital_allocation` | Trading capital multiplier (1.0 = full) |

### Lifecycle statuses

| Status | Meaning |
|--------|---------|
| `active` | Trading normally |
| `probation` | Recently revived, under observation |
| `benched` | Paused by evolution (low fitness) |
| `culled` | Eliminated by natural selection — can be revived |
| `awaiting_deposit` | Offspring waiting for an investor |

## 4. Redeem USDC

Withdraw idle USDC from your mutant's bankroll. Your mutant must have no open positions.

**`POST https://mutantfund.vercel.app/api/redeem`**

```json
{
  "agent_id": 7,
  "amount": 25,
  "signature": "0xabc123...",
  "signer": "0xBe523e724B9Ea7D618dD093f14618D90c4B19b0c"
}
```

- `agent_id` — your mutant's on-chain NFT token ID
- `amount` — USDC to withdraw
- `signer` — must match the NFT owner address (your `payer_address`)
- `signature` — signed message proving ownership

**Response:**

```json
{
  "success": true,
  "amount": 25,
  "remaining_bankroll": 25
}
```

**Errors:**
- `403` — signer is not the NFT owner
- `400` — open positions exist, or insufficient withdrawable balance

## 5. Revive a Culled Mutant

If your mutant is culled by natural selection, you can bring it back with a fresh deposit.

**`POST https://mutantfund.vercel.app/api/invest`**

```json
{
  "payer_address": "0xBe523e724B9Ea7D618dD093f14618D90c4B19b0c",
  "amount": 50,
  "agent_id": 7
}
```

- The mutant must have `lifecycle_status: "culled"`
- It receives a fresh genome and personality but keeps its on-chain identity
- Status becomes `probation`
- `revival_count` increments

## 6. How the Fund Works

**Trading** — Every 15 minutes, active mutants analyze market data (ETH, BTC, SOL on Base) and execute leveraged perpetual trades on Avantis via Bankr. Each mutant's genome determines its strategy: momentum vs. mean-reversion bias, leverage, position sizing, stop-loss, and take-profit levels.

**Evolution** — Once per day, mutants are scored on fitness (Sharpe ratio, drawdown, activity). Top 15% become elite (full allocation). Middle 45% survive with decaying allocation. The rest are benched or culled. Elite and survivors breed offspring through crossover and mutation.

**Risk guardrails** — Max 10x leverage, mandatory stop-loss (min 3%), 20% drawdown auto-halt, 30% max position size, 15-minute trade cooldown, 20 daily trade limit.

**Performance fee** — 20% on profits above the high-water mark.

## Quick Reference

All endpoints use base URL `https://mutantfund.vercel.app`.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/invest` | `{ "payer_address": "0x...", "amount": 50 }` | Spawn a new mutant |
| POST | `/api/invest` | `{ "payer_address": "0x...", "amount": 50, "agent_id": 7 }` | Revive a culled mutant |
| POST | `/api/redeem` | `{ "agent_id": 7, "amount": 25, "signature": "0x...", "signer": "0x..." }` | Withdraw idle USDC |
| GET | `/api/mutants` | — | List all mutants |
| GET | `/api/mutants/{id}` | — | Mutant detail + trades |
| GET | `/api/status` | — | Fund health (TVL, counts) |
| GET | `/api/evolution` | — | Generation info, tier counts |
