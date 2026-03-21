import type { Genome } from "../evolution/genome";
import type { MarketSnapshot } from "./market-data";
import { RISK_GUARDRAILS } from "../config/risk";

export type TradeSignal =
  | {
      action: "trade";
      direction: "long" | "short";
      size: number;
      leverage: number;
      stopPrice: number;
      tpPrice: number;
      entryPrice: number;
      asset: string;
    }
  | {
      action: "no_trade";
      reason: string;
    };

export function computeSignal(
  genome: Genome,
  marketData: MarketSnapshot,
  bankroll: number,
  capitalAllocation: number
): TradeSignal {
  const h1 = (marketData.priceChange_h1 ?? 0) / 100;
  const h6 = (marketData.priceChange_h6 ?? 0) / 100;
  const h24 = (marketData.priceChange_h24 ?? 0) / 100;

  // Momentum: weighted average of recent price changes
  const momentumScore = h1 * 0.5 + h6 * 0.3 + h24 * 0.2;

  // Mean-reversion: fade h1 move, amplified when h24 is flat
  const reversionMultiplier = Math.abs(h24) < 0.02 ? 1.5 : 1.0;
  const reversionScore = -h1 * reversionMultiplier;

  // Blend based on genome's signal_bias (1 = pure momentum, 0 = pure reversion)
  const rawSignal =
    genome.signal_bias * momentumScore +
    (1 - genome.signal_bias) * reversionScore;

  if (Math.abs(rawSignal) <= genome.entry_threshold) {
    return {
      action: "no_trade",
      reason: `Signal strength ${rawSignal.toFixed(4)} below entry threshold ${genome.entry_threshold}`,
    };
  }

  const direction: "long" | "short" = rawSignal > 0 ? "long" : "short";
  const entryPrice = marketData.priceUsd;

  // Position sizing: capped by guardrails
  const positionSizePct = Math.min(
    genome.position_size_pct,
    RISK_GUARDRAILS.maxPositionSize
  );
  const effectiveCapital = bankroll * capitalAllocation;
  const size = effectiveCapital * positionSizePct;

  const leverage = genome.leverage;

  const stopPrice =
    direction === "long"
      ? entryPrice * (1 - genome.stop_loss)
      : entryPrice * (1 + genome.stop_loss);

  const tpPrice =
    direction === "long"
      ? entryPrice * (1 + genome.take_profit)
      : entryPrice * (1 - genome.take_profit);

  return {
    action: "trade",
    direction,
    size,
    leverage,
    stopPrice,
    tpPrice,
    entryPrice,
    asset: marketData.asset,
  };
}
