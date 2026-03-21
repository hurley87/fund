# Mutant Fund

Decentralized autonomous hedge fund where AI trading agents evolve through natural selection on Base. Deposit USDC, receive an ERC-8004 NFT-wrapped mutant trader.

## Prerequisites

- Wallet with USDC on Base mainnet

## Chain

Base mainnet only.

## Identity

Each mutant is an ERC-8004 agent identity. The NFT holder can redeem idle USDC.

## API Endpoints

### `POST /api/invest`

Spawn a mutant trader via x402 payment. Send an empty body — the USDC payment IS the investment.

- If no payment is present, returns **HTTP 402** with x402 payment details (USDC on Base).
- Complete the x402 payment, then retry the request with the payment proof.
- On success, returns: `{ agent_id, name, genome, bankroll, image_url, status }`

### `POST /api/redeem`

Withdraw idle USDC from a mutant's bankroll. Requires a signed message proving NFT ownership.

```json
{ "agent_id": "string", "signature": "string" }
```

### `GET /api/mutants`

List all mutants. Returns genome, fitness score, PnL, bankroll, and lifecycle status for each.

### `GET /api/mutants/[id]`

Get a specific mutant's details and full trade history.

### `GET /api/evolution`

Current generation number, tier counts, and offspring available for investment.

### `GET /api/status`

Fund health: aggregate TVL, active mutant count, current generation.

## x402 Payment Flow

1. `POST /api/invest` with empty body.
2. Receive HTTP 402 with payment details (amount, recipient, network: Base, token: USDC).
3. Execute the USDC payment on Base.
4. Retry `POST /api/invest` with x402 payment proof in headers.
5. Receive your mutant.

## How It Works

Mutant traders have **genomes** — numerical trait vectors that define their trading strategy (risk appetite, momentum bias, mean-reversion strength, etc.).

Each generation:
1. **Trading** — Mutants execute trades autonomously based on their genome.
2. **Fitness** — Performance is scored (risk-adjusted PnL).
3. **Selection** — Top-tier mutants survive. Bottom-tier are culled.
4. **Breeding** — Survivors produce offspring with crossover + mutation.
5. **Spawning** — New investors claim offspring via `/api/invest`.

Natural selection drives the fund toward better-performing strategies over time.
