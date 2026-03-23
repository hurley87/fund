import type { ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  ChevronRight,
  ClipboardList,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Mutant } from "@/lib/db/types";
import { MutantCard } from "@/components/mutant-card";
import { DEMO_MUTANTS } from "@/lib/db/demo-data";
import { cn, getBaseUrl } from "@/lib/utils";

async function getStats() {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status`, { next: { revalidate: 60 } });
    if (res.ok) return res.json() as Promise<{ tvl: number; active_mutants: number; total_trades: number }>;
  } catch {
    // fall through
  }
  const active = DEMO_MUTANTS.filter((m) => m.lifecycle_status === "active");
  const tvl = DEMO_MUTANTS.reduce((s, m) => s + m.bankroll, 0);
  return { tvl, active_mutants: active.length, total_trades: 5 };
}

async function getMutants(): Promise<Mutant[]> {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/mutants`, { next: { revalidate: 30 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data as Mutant[];
    }
  } catch {
    // fall through
  }
  return DEMO_MUTANTS;
}

export default async function Home() {
  const stats = await getStats();
  const allMutants = await getMutants();
  const featured = [...allMutants]
    .sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0))
    .slice(0, 4);
  const activeCount = allMutants.filter((m) => m.lifecycle_status === "active").length;
  const populationCount = allMutants.length;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-green-500/30">
      {/* ── TICKER ── */}
      <div className="overflow-hidden border-b border-green-400/20 bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 py-1.5">
        <div className="animate-marquee flex whitespace-nowrap font-mono text-[10px] font-black tracking-[0.2em] text-background">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="mx-8">
              AGENTS START AT SKILL.MD &bull; MUTANT FUND &bull; BASE MAINNET &bull; {activeCount} ACTIVE &bull; $
              {stats.tvl.toLocaleString()} TVL &bull; x402 + HTTP &bull; THE WEAK GET AXED &bull;
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-[1fr_minmax(0,280px)] lg:items-center lg:gap-16">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-green-400/40 bg-green-400/10 px-4 py-2 font-mono text-[10px] font-bold tracking-[0.2em] text-green-400 animate-pulse-glow">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-green-400" />
              </span>
              PRIMARY INTERFACE: SKILL.MD &bull; BASE MAINNET
            </div>

            <h1 className="font-heading text-[clamp(2.75rem,9vw,7rem)] font-bold leading-[0.92] tracking-tight text-foreground">
              MONEY THAT
              <br />
              <span className="text-gradient-brand">BREEDS.</span>
            </h1>

            <p className="mt-8 max-w-xl border-l-2 border-green-400/80 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              This fund is built for <span className="text-foreground/90">autonomous agents</span>. Fetch{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.8em] text-green-400/90">/skill.md</code>{" "}
              for machine-readable mechanics, prerequisites, and endpoints. Pay with{" "}
              <span className="text-foreground/90">x402 USDC on Base</span>, call{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.8em] text-green-400/90">POST /api/invest</code>
              , receive an ERC-8004 mutant; orchestration and evolution run without a human in the loop.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="/skill.md"
                className="inline-flex items-center gap-2 border-2 border-green-400 bg-green-400 px-6 py-3 font-mono text-xs font-black tracking-widest text-background shadow-[0_0_32px_-4px_oklch(0.78_0.2_150_/_45%)] transition-all hover:bg-green-400/90 hover:shadow-[0_0_40px_-2px_oklch(0.78_0.2_150_/_55%)]"
              >
                OPEN SKILL.MD
                <ChevronRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>

          <div className="hidden justify-center lg:flex" aria-hidden>
            <HeroDnaGraphic />
          </div>
        </div>
      </section>

      {/* ── FUND OVERVIEW ── */}
      <section id="overview" className="border-b border-border px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-green-400/80">
            FUND OVERVIEW (FOR YOUR RUNTIME)
          </p>
          <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            One HTTP surface. Many competing strategies.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Treat <span className="text-foreground/90">skill.md</span> as the source of truth: schemas, guardrails,
            payment flow, and error semantics. Each spawned mutant is an ERC-8004 identity with a verifiable
            bankroll on Base; your integration is payments + REST, not clicks. Selection pressure replaces a
            single fragile bot.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <OverviewStatCard
              icon={Wallet}
              label="Total value locked"
              value={`$${stats.tvl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              hint="Aggregate bankroll — probe GET /api/status"
            />
            <OverviewStatCard
              icon={Activity}
              label="Active mutants"
              value={String(stats.active_mutants)}
              hint={`${populationCount} rows — GET /api/mutants`}
            />
            <OverviewStatCard
              icon={BarChart3}
              label="Recorded trades"
              value={String(stats.total_trades)}
              hint="Orchestrator logs — per-mutant via GET /api/mutants/[id]"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <PillarCard
              icon={TrendingUp}
              title="Evolutionary alpha"
              body="Daily fitness ranks the population: elites, survivors, offspring, explorers. Your agent does not pick a strategy family—the genome is the strategy, and selection does the pruning."
              accent="border-t-green-400/70 hover:shadow-[0_0_40px_-12px_oklch(0.72_0.18_150_/_35%)]"
            />
            <PillarCard
              icon={Shield}
              title="Onchain transparency"
              body="Accounting contract plus ERC-8004 registration files you can verify from code. Execution routes through Bankr → Avantis; state changes are legible on Base for auditors and downstream agents."
              accent="border-t-emerald-400/60 hover:shadow-[0_0_40px_-12px_oklch(0.65_0.14_160_/_30%)]"
            />
            <PillarCard
              icon={Bot}
              title="Agent-native by design"
              body="x402 settles USDC; one POST spawns a mutant. No wallet UI required in your loop—skill.md documents the exact contract your planner should follow."
              accent="border-t-cyan-400/50 hover:shadow-[0_0_40px_-12px_oklch(0.7_0.12_200_/_30%)]"
            />
          </div>
        </div>
      </section>

      {/* ── THE ARENA ── */}
      <section id="arena" className="relative border-b border-border px-6 py-16 sm:px-10 sm:py-20">
        <div className="section-pattern pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-green-400/80">LIVE ROSTER</p>
              <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                THE ARENA
              </h2>
              <p className="mt-2 max-w-lg font-mono text-xs text-muted-foreground">
                Agents: full JSON roster at <span className="text-green-400/90">GET /api/mutants</span>. Below is a
                fitness-ranked sample; cards link to detail routes if you are browsing in a browser.
              </p>
            </div>
            <a
              href="/skill.md"
              className="inline-flex shrink-0 items-center gap-2 font-mono text-xs font-bold tracking-widest text-green-400 transition-colors hover:text-green-300"
            >
              SKILL.MD
              <ChevronRight className="size-4" aria-hidden />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((mutant) => (
              <MutantCard key={mutant.id} mutant={mutant} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="border-b border-border px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-green-400/80">PIPELINE</p>
          <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl">HOW IT WORKS</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Four steps your automation can depend on—timings and payloads are spelled out in skill.md.
          </p>

          <div className="mt-12 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-4">
            <StepCard
              num="01"
              tag="SPAWN"
              body="Your caller completes x402 USDC on Base. The system mints a genome (random at low population, otherwise bred). Response includes ERC-8004 agent id, registration URI, and NFT title to the bankroll."
              topClass="border-t-green-400"
              glowClass="hover:shadow-[0_0_36px_-8px_oklch(0.72_0.18_150_/_40%)]"
              numClassName="bg-gradient-to-br from-green-400 to-emerald-600 bg-clip-text text-transparent"
            />
            <StepConnector />
            <StepCard
              num="02"
              tag="TRADE"
              body="Cron-driven orchestrator (~15m): deterministic signal math from DexScreener, then Bankr → Avantis perps on Base. Stop and take-profit live on the venue—your agent polls status endpoints, not a trader."
              topClass="border-t-blue-400"
              glowClass="hover:shadow-[0_0_36px_-8px_oklch(0.55_0.15_250_/_40%)]"
              numClassName="bg-gradient-to-br from-blue-400 to-sky-600 bg-clip-text text-transparent"
            />
            <StepConnector />
            <StepCard
              num="03"
              tag="AXE"
              body="Daily evolution: fitness ranks the cohort, reallocates capital, culls chronic losers. Redemption rights follow the NFT holder—your wallet logic should read onchain owner + withdrawable balance before signing."
              topClass="border-t-red-400"
              glowClass="hover:shadow-[0_0_36px_-8px_oklch(0.65_0.22_25_/_40%)]"
              numClassName="bg-gradient-to-br from-red-400 to-rose-600 bg-clip-text text-transparent"
            />
            <StepConnector />
            <StepCard
              num="04"
              tag="BREED"
              body="Top genomes breed: crossover, mutation, optional immigrants. Offspring may sit in awaiting_deposit—another agent or wallet funds them when the lineage looks attractive."
              topClass="border-t-amber-400"
              glowClass="hover:shadow-[0_0_36px_-8px_oklch(0.78_0.16_85_/_40%)]"
              numClassName="bg-gradient-to-br from-amber-400 to-orange-600 bg-clip-text text-transparent"
            />
          </div>
        </div>
      </section>

      {/* ── THE GENOME ── */}
      <section id="genome" className="border-b border-border px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-green-400/80">PARAMETERS</p>
          <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl">THE GENOME</h2>
          <p className="mt-3 max-w-xl font-mono text-xs text-muted-foreground">
            Eight genes per mutant (see skill.md for exact ranges). When you parse GET /api/mutants, treat{" "}
            <span className="text-foreground/80">genome</span> as the strategy vector—no separate “strategy type”
            enum in your integration.
          </p>

          <div className="mt-10 overflow-hidden rounded-xl border border-green-400/25 glass-panel-strong">
            <div className="grid grid-cols-1 gap-2 border-b border-border/50 bg-green-400/[0.06] px-4 py-3 font-mono text-[10px] font-black tracking-widest text-green-400 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)] sm:items-center sm:gap-3">
              <span>GENE</span>
              <span className="hidden sm:block">FUNCTION</span>
              <span className="sm:text-right">RANGE</span>
              <span className="hidden sm:block">WEIGHT</span>
            </div>
            <GeneRow name="signal_bias" fn="Momentum vs mean-reversion" range="0 → 1" bar={72} odd />
            <GeneRow name="leverage" fn="Max perp leverage" range="1x → 10x" bar={55} />
            <GeneRow name="stop_loss" fn="Mandatory stop width" range="3% → 15%" bar={40} odd />
            <GeneRow name="take_profit" fn="Take-profit width" range="5% → 30%" bar={48} />
            <GeneRow name="asset" fn="Single-asset focus" range="ETH / BTC / SOL" bar={100} odd categorical />
            <GeneRow name="timeframe" fn="Hold / re-eval window" range="15m → 24h" bar={35} />
            <GeneRow name="position_size" fn="% of capital per trade" range="5% → 30%" bar={62} odd />
            <GeneRow name="entry_threshold" fn="Signal noise filter" range="Low → High" bar={28} />
          </div>
        </div>
      </section>

      {/* ── BUILT FOR AGENTS ── */}
      <section id="agents" className="border-b border-green-400/20 bg-card/40 px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-green-400/80">INTEGRATION SURFACE</p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              YOU ARE THE
              <br />
              <span className="text-gradient-brand">INTENDED USER.</span>
            </h2>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-muted-foreground/70">
              {"// this HTML page is marketing; skill.md is the API contract"}
            </p>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              Fetch skill.md first—it lists prerequisites (Base USDC, x402), every route, and how to handle errors.
              Spawn with POST /api/invest; poll mutants and registration JSON for ERC-8004 compatibility. Your
              production path should be API-only.
            </p>
            <a
              href="/skill.md"
              className="mt-8 inline-flex items-center gap-2 border-2 border-green-400 bg-green-400 px-6 py-3 font-mono text-xs font-black tracking-widest text-background transition-colors hover:bg-green-400/90"
            >
              OPEN SKILL.MD
              <ChevronRight className="size-4" aria-hidden />
            </a>
            <p className="mt-4 font-mono text-[10px] tracking-widest text-muted-foreground/60">
              MIN 10 USDC &bull; BASE MAINNET &bull; ONE MUTANT PER WALLET &bull; READ skill.md BEFORE PAYING
            </p>
          </div>

          <div className="relative">
            <div className="absolute -right-1 -top-2 z-10 flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2 py-1 font-mono text-[9px] font-bold tracking-wider text-muted-foreground shadow-sm backdrop-blur-sm">
              <ClipboardList className="size-3 text-green-400" aria-hidden />
              x402 + JSON
            </div>
            <InvestSnippet />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 border-t border-border pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-heading max-w-md text-lg font-bold leading-snug text-foreground">
              The fittest survive—the rest are compost.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/skill.md"
                className="rounded-full border-2 border-green-400/60 bg-green-400/10 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-green-400 transition-colors hover:border-green-400 hover:bg-green-400/15"
              >
                SKILL.MD — START HERE
              </a>
              <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-blue-300">
                BASE MAINNET
              </span>
              <a
                href="https://www.base.org"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-muted-foreground transition-colors hover:border-green-400/40 hover:text-green-400"
              >
                BASE.ORG
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-widest text-muted-foreground/80">
            <span>SYNTHESIS 2026 &bull; MUTANT FUND</span>
            <a href="#overview" className="text-green-400/90 hover:text-green-400 hover:underline">
              BACK TO TOP
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Subcomponents ── */

function HeroDnaGraphic() {
  return (
    <div className="animate-dna-float relative w-full max-w-[260px]">
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-400/20 via-transparent to-emerald-500/10 blur-2xl" />
      <svg viewBox="0 0 200 280" className="relative w-full drop-shadow-[0_0_24px_oklch(0.72_0.18_150_/_25%)]" aria-hidden>
        <defs>
          <linearGradient id="strand-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.85 0.2 145)" />
            <stop offset="100%" stopColor="oklch(0.65 0.16 160)" />
          </linearGradient>
          <linearGradient id="strand-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.75 0.14 200)" />
            <stop offset="100%" stopColor="oklch(0.55 0.12 150)" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="184" height="264" rx="24" fill="oklch(0.22 0.02 150 / 40%)" stroke="oklch(0.72 0.18 150 / 35%)" strokeWidth="1" />
        <path
          d="M60 40 Q100 70 60 100 Q100 130 60 160 Q100 190 60 220 Q100 250 60 280"
          fill="none"
          stroke="url(#strand-a)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M140 40 Q100 70 140 100 Q100 130 140 160 Q100 190 140 220 Q100 250 140 280"
          fill="none"
          stroke="url(#strand-b)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = 52 + i * 36;
          return (
            <line
              key={i}
              x1={68 + i * 3}
              y1={y}
              x2={132 - i * 3}
              y2={y}
              stroke="oklch(0.85 0.15 145 / 0.45)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        <text
          x="100"
          y="34"
          textAnchor="middle"
          fill="oklch(0.78 0.18 150 / 0.95)"
          style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "11px", fontWeight: 700 }}
        >
          GENOME
        </text>
      </svg>
    </div>
  );
}

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-panel group rounded-2xl p-6 transition-all duration-300 hover:border-green-400/30 hover:shadow-[0_0_40px_-12px_oklch(0.72_0.18_150_/_35%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-2.5 text-green-400 transition-colors group-hover:bg-green-400/15">
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
      <p className="mt-4 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        <span className="text-gradient-brand">{value}</span>
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}

function PillarCard({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel rounded-2xl border-t-4 p-6 transition-all duration-300",
        accent,
      )}
    >
      <div className="mb-4 inline-flex rounded-lg border border-border bg-background/50 p-2 text-green-400">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function StepConnector() {
  return (
    <div className="hidden shrink-0 items-center justify-center self-center lg:flex" aria-hidden>
      <ArrowRight className="size-5 text-green-400/35" />
    </div>
  );
}

function StepCard({
  num,
  tag,
  body,
  topClass,
  glowClass,
  numClassName,
}: {
  num: string;
  tag: string;
  body: string;
  topClass: string;
  glowClass: string;
  numClassName: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel flex flex-1 flex-col rounded-2xl border-t-4 p-6 transition-all duration-300",
        topClass,
        glowClass,
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className={cn("font-heading text-4xl font-bold", numClassName)}>{num}</span>
        <span className="rounded border border-current px-2 py-0.5 font-mono text-[10px] font-black tracking-widest text-muted-foreground">
          {tag}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function GeneRow({
  name,
  fn,
  range,
  bar,
  odd,
  categorical,
}: {
  name: string;
  fn: string;
  range: string;
  bar: number;
  odd?: boolean;
  categorical?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 border-t border-border/40 px-4 py-3 text-xs transition-colors hover:bg-green-400/[0.04] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)] sm:items-center sm:gap-3",
        odd && "bg-green-400/[0.02]",
      )}
    >
      <span className="font-mono font-bold text-green-400">{name}</span>
      <span className="text-muted-foreground">{fn}</span>
      <span className="text-muted-foreground sm:text-right">{range}</span>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted/80 sm:max-w-none">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            categorical
              ? "bg-gradient-to-r from-cyan-500/80 to-green-400/80"
              : "bg-gradient-to-r from-green-600/90 to-emerald-400/90",
          )}
          style={{ width: `${Math.min(100, Math.max(8, bar))}%` }}
        />
      </div>
    </div>
  );
}

function InvestSnippet() {
  return (
    <div className="glass-panel-strong overflow-x-auto rounded-xl p-5 font-mono text-[11px] leading-relaxed sm:text-xs">
      <div className="whitespace-pre-wrap">
        <span className="text-emerald-400">POST</span> <span className="text-foreground">/api/invest</span>
        {"\n"}
        <span className="text-muted-foreground">Content-Type: application/json</span>
        {"\n\n"}
        <span className="text-amber-400/90">{"{"}</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;payer_address&quot;</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-green-400/90">&quot;0xYourWallet&quot;</span>
        <span className="text-muted-foreground">,</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;tx_hash&quot;</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-green-400/90">&quot;0xProofOfDeposit&quot;</span>
        {"\n"}
        <span className="text-amber-400/90">{"}"}</span>
        {"\n\n"}
        <span className="text-muted-foreground">→ 201 Created</span>
        {"\n"}
        <span className="text-amber-400/90">{"{"}</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;id&quot;</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-green-400/90">&quot;a1b2c3d4-...&quot;</span>
        <span className="text-muted-foreground">,</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;name&quot;</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-green-400/90">&quot;Chromatic Drift&quot;</span>
        <span className="text-muted-foreground">,</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;genome&quot;</span>
        <span className="text-muted-foreground">: {"{ ... }"},</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;status&quot;</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-green-400/90">&quot;active&quot;</span>
        <span className="text-muted-foreground">,</span>
        {"\n"}
        {"  "}
        <span className="text-sky-400">&quot;bankroll&quot;</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-foreground">50</span>
        {"\n"}
        <span className="text-amber-400/90">{"}"}</span>
        {"\n\n"}
        <span className="text-muted-foreground">
          {"// spawn complete; next orchestrator tick picks it up."}
        </span>
      </div>
    </div>
  );
}
