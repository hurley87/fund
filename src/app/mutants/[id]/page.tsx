import Link from "next/link";
import { notFound } from "next/navigation";
import type { Mutant, Trade } from "@/lib/db/types";
import { DEMO_MUTANTS, DEMO_TRADES } from "@/lib/db/demo-data";
import { cn, getBaseUrl } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/ui/constants";

interface MutantWithTrades extends Mutant {
  trades: Trade[];
}

async function getMutant(id: string): Promise<MutantWithTrades | null> {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/mutants/${id}`, { next: { revalidate: 30 } });
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) return data as MutantWithTrades;
    }
  } catch {
    // fall through
  }
  // Demo fallback
  const mutant = DEMO_MUTANTS.find((m) => m.id === id);
  if (!mutant) return null;
  const trades = DEMO_TRADES.filter((t) => t.mutant_id === id);
  return { ...mutant, trades };
}

const GENE_LABELS: Record<string, { label: string; format: (v: number) => string; max: number }> = {
  signal_bias: { label: "Signal Bias", format: (v) => v < 0.4 ? "Reversion" : v > 0.6 ? "Momentum" : "Balanced", max: 1 },
  leverage: { label: "Leverage", format: (v) => `${v.toFixed(1)}x`, max: 10 },
  stop_loss: { label: "Stop Loss", format: (v) => `${(v * 100).toFixed(1)}%`, max: 0.15 },
  take_profit: { label: "Take Profit", format: (v) => `${(v * 100).toFixed(1)}%`, max: 0.5 },
  timeframe_hours: { label: "Timeframe", format: (v) => `${v}h`, max: 24 },
  position_size_pct: { label: "Position Size", format: (v) => `${(v * 100).toFixed(0)}%`, max: 0.3 },
  entry_threshold: { label: "Entry Threshold", format: (v) => v.toFixed(2), max: 1 },
};

export default async function MutantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMutant(id);
  if (!data) notFound();

  const pnlPositive = (data.pnl ?? 0) >= 0;

  return (
    <div className="flex flex-1 flex-col bg-background font-sans">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-foreground">
            Mutant Fund
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <a href="/skill.md" className="hover:text-foreground">
              skill.md
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to home
        </Link>

        {/* Hero */}
        <section className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-muted text-3xl font-bold text-muted-foreground">
            {data.image_url ? (
              <img
                src={data.image_url}
                alt={data.name ?? "Mutant"}
                className="size-20 rounded-2xl object-cover"
              />
            ) : (
              (data.name ?? "?")[0]
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">
                {data.name ?? `Agent #${data.agent_id}`}
              </h1>
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wider",
                  STATUS_COLORS[data.lifecycle_status] ?? STATUS_COLORS.active,
                )}
              >
                {data.lifecycle_status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {data.description ?? "No description available."}
            </p>
          </div>
        </section>

        {/* Stats grid */}
        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Fitness" value={`${Math.round((data.fitness ?? 0) * 100)}%`} />
          <StatCard
            label="PnL"
            value={`${pnlPositive ? "+" : ""}$${(data.pnl ?? 0).toFixed(2)}`}
            className={pnlPositive ? "text-green-400" : "text-red-400"}
          />
          <StatCard label="Bankroll" value={`$${(data.bankroll ?? 0).toFixed(2)}`} />
          <StatCard label="Generation" value={`Gen ${data.generation}`} />
        </section>

        {/* Genome */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Genome</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Asset gene displayed as text */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 text-xs text-muted-foreground">Asset</div>
              <div className="text-sm font-semibold text-foreground">{data.genome?.asset ?? "—"}</div>
            </div>
            {/* Numeric genes as bars */}
            {Object.entries(GENE_LABELS).map(([key, meta]) => {
              const val = (data.genome as unknown as Record<string, number>)?.[key] ?? 0;
              const pct = Math.min(100, (val / meta.max) * 100);
              return (
                <div key={key} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{meta.label}</span>
                    <span className="font-mono text-foreground">{meta.format(val)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Lineage */}
        {data.parent_ids && data.parent_ids.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Lineage</h2>
            <div className="flex flex-wrap gap-2">
              {data.parent_ids.map((pid) => (
                <Link
                  key={pid}
                  href={`/mutants/${pid}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-mono text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                >
                  Parent: {pid.slice(0, 8)}...
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Trade history */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Trade History</h2>
          {data.trades.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No trades recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 font-medium text-right">Entry</th>
                    <th className="px-4 py-3 font-medium text-right">Exit</th>
                    <th className="px-4 py-3 font-medium text-right">PnL</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.trades.map((trade) => {
                    const tradePnlPos = (trade.pnl ?? 0) >= 0;
                    return (
                      <tr key={trade.id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                          {new Date(trade.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium uppercase",
                              trade.action === "long"
                                ? "bg-green-500/20 text-green-400"
                                : trade.action === "short"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {trade.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">{trade.asset}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {trade.entry_price != null ? `$${trade.entry_price.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {trade.exit_price != null ? `$${trade.exit_price.toLocaleString()}` : (
                            <span className="text-yellow-400">Open</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right font-mono font-semibold",
                            trade.pnl == null
                              ? "text-muted-foreground"
                              : tradePnlPos
                                ? "text-green-400"
                                : "text-red-400",
                          )}
                        >
                          {trade.pnl != null
                            ? `${tradePnlPos ? "+" : ""}$${trade.pnl.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                          {trade.reasoning ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-bold text-foreground", className)}>{value}</div>
    </div>
  );
}
