import { NextResponse } from "next/server";
import { getSupabase, mutants, trades, evolutionLogs } from "@/lib/db/supabase";
import type { Mutant } from "@/lib/db/types";
import { randomGenome, type Genome } from "@/lib/evolution/genome";
import { crossover } from "@/lib/evolution/crossover";
import { mutate } from "@/lib/evolution/mutation";
import { computeFitness } from "@/lib/evolution/fitness";
import { verifyCronSecret } from "@/lib/api/cron-auth";

const SMALL_POP_THRESHOLD = 6;
const ELITE_PCT = 0.15;
const SURVIVOR_PCT = 0.45;

function allocateTiers(total: number) {
  const eliteCount = Math.max(1, Math.floor(total * ELITE_PCT));
  const survivorCount = Math.max(0, Math.floor(total * SURVIVOR_PCT));
  const explorerCount = Math.max(1, Math.floor(total * 0.15));
  const offspringCount = Math.max(0, total - eliteCount - survivorCount - explorerCount);
  return { eliteCount, survivorCount, offspringCount, explorerCount };
}

function pickParents(pool: { mutant: Mutant; fitness: number }[]): [Mutant, Mutant] {
  const totalFitness = pool.reduce((s, p) => s + Math.max(p.fitness, 0.01), 0);
  const pick = (): Mutant => {
    let r = Math.random() * totalFitness;
    for (const p of pool) {
      r -= Math.max(p.fitness, 0.01);
      if (r <= 0) return p.mutant;
    }
    return pool[pool.length - 1].mutant;
  };
  const p1 = pick();
  let p2 = pick();
  let attempts = 0;
  while (p2.id === p1.id && attempts < 10 && pool.length > 1) {
    p2 = pick();
    attempts++;
  }
  return [p1, p2];
}

/** Extract a Genome compatible with evolution functions from a DB mutant */
function toEvolutionGenome(m: Mutant): Genome {
  const g = m.genome;
  if (g && typeof g.signal_bias === "number") {
    return g as unknown as Genome;
  }
  // Fallback if genome shape doesn't match
  return randomGenome();
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    population: 0,
    elites: 0,
    survivors: 0,
    offspring: 0,
    explorers: 0,
    axed: 0,
    benched: 0,
    small_population_mode: false,
    errors: [] as string[],
  };

  try {
    const sb = getSupabase();
    const { data: allMutants, error: loadError } = await sb
      .from("mutants")
      .select("*");

    if (loadError) throw loadError;
    if (!allMutants || allMutants.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No mutants in population",
        timestamp: new Date().toISOString(),
      });
    }

    const population = allMutants as Mutant[];
    summary.population = population.length;

    // ── Small population mode ──────────────────────────────────────
    if (population.length < SMALL_POP_THRESHOLD) {
      summary.small_population_mode = true;
      for (const m of population) {
        try {
          const mutated = mutate(toEvolutionGenome(m));
          await mutants.update(m.id, { genome: mutated as unknown as Mutant["genome"] });
        } catch (err) {
          summary.errors.push(
            `small-pop mutate ${m.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      await evolutionLogs.insert({
        generation: population[0]?.generation ?? 0,
        avg_fitness: null,
        tier_counts: { population_size: population.length },
      });

      return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...summary });
    }

    // ── Compute fitness ────────────────────────────────────────────
    const scored: { mutant: Mutant; fitness: number }[] = [];
    for (const m of population) {
      try {
        const recentTrades = await trades.list(m.id);
        const fitness = computeFitness(m.id, recentTrades);
        scored.push({ mutant: m, fitness });
      } catch {
        scored.push({ mutant: m, fitness: 0 });
      }
    }
    scored.sort((a, b) => b.fitness - a.fitness);

    // ── Tiered selection ───────────────────────────────────────────
    const { eliteCount, survivorCount, offspringCount, explorerCount } =
      allocateTiers(scored.length);

    const elites = scored.slice(0, eliteCount);
    const survivors = scored.slice(eliteCount, eliteCount + survivorCount);
    const weak = scored.slice(eliteCount + survivorCount);
    const parentPool = [...elites, ...survivors];

    // Update elites
    for (const { mutant } of elites) {
      await mutants.update(mutant.id, { capital_allocation: 1.0, lifecycle_status: "active" });
      summary.elites++;
    }

    // Update survivors
    for (const { mutant } of survivors) {
      const newAlloc = Math.max(0.3, (mutant.capital_allocation ?? 0.5) * 0.95);
      await mutants.update(mutant.id, { capital_allocation: newAlloc, lifecycle_status: "active" });
      summary.survivors++;
    }

    // Handle weak performers
    for (const { mutant } of weak) {
      const newAlloc = Math.max(0, (mutant.capital_allocation ?? 0.5) - 0.3);
      const status = newAlloc <= 0 ? "benched" : "active";
      await mutants.update(mutant.id, {
        capital_allocation: newAlloc,
        lifecycle_status: status as Mutant["lifecycle_status"],
      });
      if (status === "benched") summary.benched++;
    }

    // Produce offspring
    const offspringIds: string[] = [];
    for (let i = 0; i < offspringCount; i++) {
      if (parentPool.length < 2) break;
      try {
        const [p1, p2] = pickParents(parentPool);
        const childGenome = mutate(crossover(toEvolutionGenome(p1), toEvolutionGenome(p2)));
        const generation = Math.max(p1.generation ?? 0, p2.generation ?? 0) + 1;

        const { data: child } = await sb.from("mutants").insert({
          genome: childGenome,
          lifecycle_status: "awaiting_deposit",
          capital_allocation: 0,
          bankroll: 0,
          generation,
          parent_ids: [p1.id, p2.id],
          trades_today: 0,
        }).select('id').single();
        if (child) offspringIds.push(child.id);
        summary.offspring++;
      } catch (err) {
        summary.errors.push(`offspring ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Exploration: random immigrants
    for (let i = 0; i < explorerCount; i++) {
      try {
        const genome = randomGenome();
        const maxGen = scored.reduce((max, s) => Math.max(max, s.mutant.generation ?? 0), 0);
        await sb.from("mutants").insert({
          genome,
          lifecycle_status: "awaiting_deposit",
          capital_allocation: 0,
          bankroll: 0,
          generation: maxGen + 1,
          parent_ids: [],
          trades_today: 0,
        });
        summary.explorers++;
      } catch (err) {
        summary.errors.push(`explorer ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Write evolution log
    const maxGen = scored.reduce((max, s) => Math.max(max, s.mutant.generation ?? 0), 0);
    await evolutionLogs.insert({
      generation: maxGen,
      elite_ids: elites.map((e) => e.mutant.id),
      survivor_ids: survivors.map((s) => s.mutant.id),
      offspring_ids: offspringIds,
      axed_ids: [],
      tier_counts: {
        elites: summary.elites,
        survivors: summary.survivors,
        offspring: summary.offspring,
        explorers: summary.explorers,
      },
      avg_fitness: scored.reduce((s, x) => s + x.fitness, 0) / scored.length,
    });
  } catch (err) {
    summary.errors.push(`evolution: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...summary });
}
