export const RISK_GUARDRAILS = {
  maxLeverage: 10,
  minStopLoss: 0.03, // 3% minimum
  maxPositionSize: 0.3, // 30% of effective capital
  maxDrawdown: 0.2, // 20% → auto-halt
  minTimeBetweenTrades: 15, // minutes
  maxDailyTrades: 20,
  minLiquidity: 50_000, // USD minimum for pair
  minVolume: 10_000, // USD minimum 24h volume
  quoteTokenAllowlist: ["USDC", "WETH"],
} as const;

interface Mutant {
  bankroll: number;
  highWaterMark: number;
  dailyTradeCount: number;
  lastTradeAt: Date | null;
}

interface ProposedTrade {
  leverage: number;
  stopLoss: number;
  positionSize: number; // fraction of effective capital
  pairLiquidity: number; // USD
  pairVolume24h: number; // USD
  quoteToken: string;
}

interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkRiskLimits(
  mutant: Mutant,
  proposedTrade: ProposedTrade
): RiskCheckResult {
  if (isDrawdownHalted(mutant.bankroll, mutant.highWaterMark)) {
    return { allowed: false, reason: "Drawdown exceeds 20% — trading halted" };
  }

  if (mutant.lastTradeAt && isWithinCooldown(mutant.lastTradeAt)) {
    return { allowed: false, reason: "Trade cooldown has not elapsed (15 min)" };
  }

  if (mutant.dailyTradeCount >= RISK_GUARDRAILS.maxDailyTrades) {
    return { allowed: false, reason: "Daily trade limit reached (20)" };
  }

  if (proposedTrade.leverage > RISK_GUARDRAILS.maxLeverage) {
    return {
      allowed: false,
      reason: `Leverage ${proposedTrade.leverage}x exceeds max ${RISK_GUARDRAILS.maxLeverage}x`,
    };
  }

  if (proposedTrade.stopLoss < RISK_GUARDRAILS.minStopLoss) {
    return {
      allowed: false,
      reason: `Stop-loss ${proposedTrade.stopLoss} below minimum ${RISK_GUARDRAILS.minStopLoss}`,
    };
  }

  if (proposedTrade.positionSize > RISK_GUARDRAILS.maxPositionSize) {
    return {
      allowed: false,
      reason: `Position size ${proposedTrade.positionSize} exceeds max ${RISK_GUARDRAILS.maxPositionSize}`,
    };
  }

  if (proposedTrade.pairLiquidity < RISK_GUARDRAILS.minLiquidity) {
    return {
      allowed: false,
      reason: `Pair liquidity $${proposedTrade.pairLiquidity} below minimum $${RISK_GUARDRAILS.minLiquidity}`,
    };
  }

  if (proposedTrade.pairVolume24h < RISK_GUARDRAILS.minVolume) {
    return {
      allowed: false,
      reason: `24h volume $${proposedTrade.pairVolume24h} below minimum $${RISK_GUARDRAILS.minVolume}`,
    };
  }

  if (
    !RISK_GUARDRAILS.quoteTokenAllowlist.includes(
      proposedTrade.quoteToken as (typeof RISK_GUARDRAILS.quoteTokenAllowlist)[number]
    )
  ) {
    return {
      allowed: false,
      reason: `Quote token "${proposedTrade.quoteToken}" not in allowlist`,
    };
  }

  return { allowed: true };
}

export function isWithinCooldown(lastTradeAt: Date): boolean {
  const cooldownMs = RISK_GUARDRAILS.minTimeBetweenTrades * 60 * 1000;
  return Date.now() - lastTradeAt.getTime() < cooldownMs;
}

export function isDrawdownHalted(
  currentBankroll: number,
  highWaterMark: number
): boolean {
  if (highWaterMark <= 0) return false;
  const drawdown = (highWaterMark - currentBankroll) / highWaterMark;
  return drawdown >= RISK_GUARDRAILS.maxDrawdown;
}
