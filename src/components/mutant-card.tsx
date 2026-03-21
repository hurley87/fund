import Link from "next/link";
import type { Mutant } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  benched: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  culled: "bg-red-500/20 text-red-400 border-red-500/30",
  probation: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  awaiting_deposit: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MutantCard({ mutant }: { mutant: Mutant }) {
  const pnlPositive = (mutant.pnl ?? 0) >= 0;
  const fitnessPercent = Math.min(100, Math.round((mutant.fitness ?? 0) * 100));

  return (
    <Link
      href={`/mutants/${mutant.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/30 hover:bg-card/80"
    >
      {/* Header: image + name + status */}
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">
          {mutant.image_url ? (
            <img
              src={mutant.image_url}
              alt={mutant.name ?? "Mutant"}
              className="size-12 rounded-lg object-cover"
            />
          ) : (
            (mutant.name ?? "?")[0]
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-foreground group-hover:text-foreground/90">
            {mutant.name ?? `Agent #${mutant.agent_id}`}
          </span>
          <span
            className={cn(
              "inline-flex w-fit rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              STATUS_COLORS[mutant.lifecycle_status] ?? STATUS_COLORS.active,
            )}
          >
            {statusLabel(mutant.lifecycle_status)}
          </span>
        </div>
      </div>

      {/* Fitness bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Fitness</span>
          <span>{fitnessPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
            style={{ width: `${fitnessPercent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground">PnL</span>
          <span
            className={cn(
              "font-mono font-semibold",
              pnlPositive ? "text-green-400" : "text-red-400",
            )}
          >
            {pnlPositive ? "+" : ""}
            ${(mutant.pnl ?? 0).toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Bankroll</span>
          <span className="font-mono font-semibold text-foreground">
            ${(mutant.bankroll ?? 0).toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Generation</span>
          <span className="font-mono text-foreground">Gen {mutant.generation}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Asset</span>
          <span className="font-mono text-foreground">{mutant.genome?.asset ?? "—"}</span>
        </div>
      </div>
    </Link>
  );
}
