import { NextResponse } from "next/server";
import { getSupabase, mutants, trades } from "@/lib/db/supabase";
import type { Mutant } from "@/lib/db/types";
import { fetchMarketData } from "@/lib/trading/market-data";
import { computeSignal } from "@/lib/trading/signal";
import { executeTrade, pollJob } from "@/lib/trading/bankr";
import {
  checkRiskLimits,
  isWithinCooldown,
  isDrawdownHalted,
  RISK_GUARDRAILS,
} from "@/lib/config/risk";
import { processQueue, enqueue } from "@/lib/queue/tx-queue";
import { ASSET_ALLOWLIST } from "@/lib/evolution/genome";
import { verifyCronSecret } from "@/lib/api/cron-auth";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    settled: 0,
    traded: 0,
    no_signal: 0,
    blocked_by_risk: 0,
    blocked_by_limits: 0,
    errors: [] as string[],
  };

  // ── Phase 1: Settlement ────────────────────────────────────────────
  try {
    const sb = getSupabase();
    const { data: openTrades } = await sb
      .from("trades")
      .select("*")
      .not("bankr_job_id", "is", null)
      .is("exit_price", null);

    if (openTrades && openTrades.length > 0) {
      const results = await Promise.allSettled(
        openTrades.map(async (trade) => {
          const job = await pollJob(trade.bankr_job_id);
          if (!job || job.status !== "completed") return;

          await sb
            .from("trades")
            .update({ exit_price: 0, pnl: 0 })
            .eq("id", trade.id);

          await enqueue("record_settlement", {
            agentId: trade.mutant_id,
            pnl: 0,
          });

          summary.settled++;
        })
      );
      for (const r of results) {
        if (r.status === "rejected") {
          summary.errors.push(
            `settle: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
          );
        }
      }
    }
  } catch (err) {
    summary.errors.push(
      `settlement phase: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Phase 2: Load eligible mutants ─────────────────────────────────
  let eligible: Mutant[] = [];
  try {
    const activeMutants = await mutants.listActive();

    eligible = activeMutants.filter((m: Mutant) => {
      if (m.lifecycle_status !== "active") return false;
      if (!m.capital_allocation || m.capital_allocation <= 0) return false;
      if (m.last_trade_at && isWithinCooldown(new Date(m.last_trade_at))) return false;
      if (isDrawdownHalted(m.bankroll, m.high_water_mark)) return false;
      if ((m.trades_today ?? 0) >= RISK_GUARDRAILS.maxDailyTrades) {
        summary.blocked_by_limits++;
        return false;
      }
      return true;
    });
  } catch (err) {
    summary.errors.push(
      `load mutants: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Phase 3: Trading loop ──────────────────────────────────────────
  // Pre-fetch market data for unique assets to avoid redundant API calls
  const marketDataCache = new Map<string, Awaited<ReturnType<typeof fetchMarketData>>>();
  const resolveAssetName = (m: Mutant) =>
    typeof m.genome.asset === "number"
      ? ASSET_ALLOWLIST[m.genome.asset] ?? "ETH"
      : String(m.genome.asset);
  const uniqueAssets = new Set(eligible.map(resolveAssetName));
  await Promise.all([...uniqueAssets].map(async (asset) => {
    marketDataCache.set(asset, await fetchMarketData(asset));
  }));

  for (const m of eligible) {
    try {
      const assetName = resolveAssetName(m);

      const marketData = marketDataCache.get(assetName) ?? null;
      if (!marketData) {
        summary.no_signal++;
        continue;
      }

      const signal = computeSignal(
        m.genome as Parameters<typeof computeSignal>[0],
        marketData,
        m.bankroll,
        m.capital_allocation
      );

      if (signal.action === "no_trade") {
        summary.no_signal++;
        continue;
      }

      // Risk checks
      const riskCheck = checkRiskLimits(
        {
          bankroll: m.bankroll,
          highWaterMark: m.high_water_mark,
          dailyTradeCount: m.trades_today ?? 0,
          lastTradeAt: m.last_trade_at ? new Date(m.last_trade_at) : null,
        },
        {
          leverage: signal.leverage,
          stopLoss: Math.abs(signal.entryPrice - signal.stopPrice) / signal.entryPrice,
          positionSize: signal.size / (m.bankroll * m.capital_allocation || 1),
          pairLiquidity: marketData.liquidity_usd,
          pairVolume24h: marketData.volume_h24,
          quoteToken: "USDC",
        }
      );
      if (!riskCheck.allowed) {
        summary.blocked_by_risk++;
        continue;
      }

      // Execute trade
      const jobId = await executeTrade({
        direction: signal.direction,
        asset: signal.asset,
        leverage: signal.leverage,
        size: signal.size,
        stopPrice: signal.stopPrice,
        tpPrice: signal.tpPrice,
      });

      // Insert trade row
      await trades.insert({
        mutant_id: m.id,
        asset: signal.asset,
        action: signal.direction,
        amount: signal.size,
        entry_price: signal.entryPrice,
        leverage: signal.leverage,
        stop_loss_price: signal.stopPrice,
        take_profit_price: signal.tpPrice,
        bankr_job_id: jobId,
      });

      // Update mutant state
      await mutants.update(m.id, {
        last_trade_at: new Date().toISOString(),
        trades_today: (m.trades_today ?? 0) + 1,
        last_signal_status: "trade_executed",
      });

      summary.traded++;
    } catch (err) {
      summary.errors.push(
        `trade mutant ${m.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ── Phase 4: Process tx queue ──────────────────────────────────────
  try {
    await processQueue();
  } catch (err) {
    summary.errors.push(
      `process queue: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...summary,
  });
}
