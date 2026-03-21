import Link from "next/link";
import { DEMO_MUTANTS, DEMO_TRADES } from "@/lib/db/demo-data";

async function getStats() {
  // In production, fetch from the API or directly from Supabase.
  // For the hackathon we try the API first and fall back to demo data.
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${base}/api/status`, { next: { revalidate: 60 } });
    if (res.ok) return res.json() as Promise<{ tvl: number; active_mutants: number; total_trades: number }>;
  } catch {
    // fall through
  }
  const active = DEMO_MUTANTS.filter((m) => m.lifecycle_status === "active");
  const tvl = DEMO_MUTANTS.reduce((s, m) => s + m.bankroll, 0);
  return { tvl, active_mutants: active.length, total_trades: DEMO_TRADES.length };
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="flex flex-1 flex-col items-center bg-background font-sans">
      {/* Hero */}
      <section className="flex w-full max-w-5xl flex-col items-center gap-6 px-6 pt-32 pb-20 text-center">
        <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          Your money,{" "}
          <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            evolved.
          </span>
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
          Deposit USDC. Mint a mutant. Watch AI trading agents compete, adapt,
          and evolve strategies through natural selection on Base.
        </p>
        <div className="mt-4 flex gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            View Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Explore Mutants
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="w-full border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 py-16 sm:grid-cols-3">
          <StatBlock label="Total Value Locked" value={`$${stats.tvl.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
          <StatBlock label="Active Mutants" value={String(stats.active_mutants)} />
          <StatBlock label="Total Trades" value={String(stats.total_trades)} />
        </div>
      </section>

      {/* How it works */}
      <section className="w-full max-w-4xl px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <StepCard
            step="01"
            title="Deposit"
            description="Pay USDC via x402 to mint a unique Mutant NFT backed by your capital."
          />
          <StepCard
            step="02"
            title="Compete"
            description="Your mutant trades autonomously on Base using its evolved genome of strategy parameters."
          />
          <StepCard
            step="03"
            title="Evolve"
            description="Every 24 hours, natural selection reshapes the roster. The fittest survive and breed."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border py-8 text-center text-sm text-muted-foreground">
        Mutant Fund — Darwin meets DeFi. Built for Synthesis 2026.
      </footer>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-3xl font-bold text-foreground">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {step}
      </span>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
