import { RISK_GUARDRAILS } from "../config/risk";

export interface MarketSnapshot {
  asset: string;
  pairAddress: string;
  priceUsd: number;
  priceChange_m5: number;
  priceChange_h1: number;
  priceChange_h6: number;
  priceChange_h24: number;
  volume_h24: number;
  volume_h6: number;
  liquidity_usd: number;
  txns_h24_buys: number;
  txns_h24_sells: number;
}

interface DexScreenerPair {
  chainId: string;
  pairAddress: string;
  baseToken: { symbol: string };
  quoteToken: { symbol: string };
  priceUsd: string;
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  volume: { h24: number; h6: number };
  liquidity: { usd: number };
  txns: { h24: { buys: number; sells: number } };
}

export async function fetchMarketData(
  asset: string
): Promise<MarketSnapshot | null> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${asset}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as { pairs: DexScreenerPair[] | null };
  if (!data.pairs) return null;

  const validPairs = data.pairs.filter(
    (p) =>
      p.chainId === "base" &&
      RISK_GUARDRAILS.quoteTokenAllowlist.includes(
        p.quoteToken.symbol as (typeof RISK_GUARDRAILS.quoteTokenAllowlist)[number]
      ) &&
      p.liquidity.usd >= RISK_GUARDRAILS.minLiquidity &&
      p.volume.h24 >= RISK_GUARDRAILS.minVolume
  );

  if (validPairs.length === 0) return null;

  // Pick the pair with the highest liquidity
  const top = validPairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];

  return {
    asset,
    pairAddress: top.pairAddress,
    priceUsd: parseFloat(top.priceUsd),
    priceChange_m5: top.priceChange.m5,
    priceChange_h1: top.priceChange.h1,
    priceChange_h6: top.priceChange.h6,
    priceChange_h24: top.priceChange.h24,
    volume_h24: top.volume.h24,
    volume_h6: top.volume.h6,
    liquidity_usd: top.liquidity.usd,
    txns_h24_buys: top.txns.h24.buys,
    txns_h24_sells: top.txns.h24.sells,
  };
}
