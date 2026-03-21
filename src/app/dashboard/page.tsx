import Link from "next/link";
import type { Mutant } from "@/lib/db/types";
import { MutantCard } from "@/components/mutant-card";
import { DEMO_MUTANTS } from "@/lib/db/demo-data";

async function getMutants(): Promise<Mutant[]> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
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

const STATUSES = ["all", "active", "benched", "culled", "awaiting_deposit"] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;
  const allMutants = await getMutants();

  const filtered =
    filterStatus && filterStatus !== "all"
      ? allMutants.filter((m) => m.lifecycle_status === filterStatus)
      : allMutants;

  return (
    <div className="flex flex-1 flex-col bg-background font-sans">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-foreground">
            Mutant Fund
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/dashboard" className="text-foreground">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mutant Population</h1>
            <p className="text-sm text-muted-foreground">
              {allMutants.length} mutants &middot; {allMutants.filter((m) => m.lifecycle_status === "active").length} active
            </p>
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const isActive = (filterStatus ?? "all") === s;
              return (
                <Link
                  key={s}
                  href={s === "all" ? "/dashboard" : `/dashboard?status=${s}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    isActive
                      ? "border-foreground/20 bg-foreground/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`}
                >
                  {s.replace(/_/g, " ")}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
            <p className="text-lg">No mutants found.</p>
            <p className="text-sm">Try a different filter or wait for the next evolution cycle.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((mutant) => (
              <MutantCard key={mutant.id} mutant={mutant} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
