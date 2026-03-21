/**
 * Placeholder fitness computation for the genome engine.
 * Weights are tunable — these are starting defaults.
 */

import type { Trade } from "@/lib/db/types";

const WEIGHTS = {
  sharpe:     0.50,
  drawdown:   0.25,
  turnover:   0.15,
  inactivity: 0.10,
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeFitness(
  _mutantId: string,
  trades: Trade[],
): number {
  if (trades.length === 0) {
    return -WEIGHTS.inactivity;
  }

  const returns = trades.map((t) => t.pnl ?? 0);
  const avgReturn = mean(returns);
  const vol = stddev(returns);

  // Sharpe-like ratio
  const sharpe = vol > 0 ? avgReturn / vol : avgReturn > 0 ? 1 : 0;

  // Max drawdown: approximate from sequential PnL
  let peak = 0;
  let worstDrawdown = 0;
  let cumulative = 0;
  for (const r of returns) {
    cumulative += r;
    if (cumulative > peak) peak = cumulative;
    const dd = peak > 0 ? (peak - cumulative) / peak : 0;
    if (dd > worstDrawdown) worstDrawdown = dd;
  }

  // Inactivity: fewer trades = higher penalty
  const inactivityScore = Math.min(trades.length / 5, 1);

  return (
    WEIGHTS.sharpe * sharpe
    - WEIGHTS.drawdown * worstDrawdown
    - WEIGHTS.inactivity * (1 - inactivityScore)
  );
}
