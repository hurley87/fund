import { NextResponse } from 'next/server';
import { mutants } from '@/lib/db/supabase';
import { randomGenome } from '@/lib/evolution/genome';
import { crossover } from '@/lib/evolution/crossover';
import { mutate } from '@/lib/evolution/mutation';
import {
  generatePersonality,
  generateImage,
  uploadImage,
} from '@/lib/personality/generate';
import { enqueue } from '@/lib/queue/tx-queue';
import type { Genome as EvolutionGenome } from '@/lib/evolution/genome';

// ---------------------------------------------------------------------------
// Minimum population before crossover kicks in
// ---------------------------------------------------------------------------
const CROSSOVER_THRESHOLD = 6;

// Minimum USDC deposit
const MIN_DEPOSIT = 10;

// ---------------------------------------------------------------------------
// Request body shape
// ---------------------------------------------------------------------------
interface InvestBody {
  payer_address: string;
  amount: number;
  /** If provided, attempt to revive a culled mutant instead of spawning new */
  agent_id?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the raw evolution genome from a DB genome object. */
function extractEvolutionGenome(dbGenome: unknown): EvolutionGenome {
  const g = dbGenome as Record<string, unknown>;
  // Prefer the _raw field if present (written by toDbGenome)
  if (g._raw && typeof g._raw === 'object') {
    return g._raw as EvolutionGenome;
  }
  // Fallback: generate a fresh random genome (shouldn't happen in practice)
  return randomGenome();
}

/** Pick two parents from the active pool, weighted toward higher fitness. */
function pickParents(active: { id: string; genome: unknown; fitness: number }[]): [EvolutionGenome, EvolutionGenome, string[]] {
  // Sort descending by fitness and pick top two distinct
  const sorted = [...active].sort((a, b) => b.fitness - a.fitness);
  const parent1 = sorted[0];
  const parent2 = sorted[1] ?? sorted[0]; // fallback if only one
  return [
    extractEvolutionGenome(parent1.genome),
    extractEvolutionGenome(parent2.genome),
    [parent1.id, parent2.id],
  ];
}

/**
 * Convert the compact evolution genome into the DB genome shape.
 * The DB Genome has more fields; we map what we can and default the rest.
 */
function toDbGenome(g: EvolutionGenome): Record<string, unknown> {
  return {
    risk_tolerance: g.signal_bias,
    time_horizon: `${g.timeframe_hours.toFixed(1)}h`,
    strategy_weights: { momentum: g.signal_bias, reversion: 1 - g.signal_bias },
    indicator_preferences: [],
    position_sizing: `${(g.position_size_pct * 100).toFixed(1)}%`,
    stop_loss_pct: g.stop_loss,
    take_profit_pct: g.take_profit,
    max_leverage: g.leverage,
    // Preserve raw evolution genes for crossover/mutation
    _raw: { ...g },
  };
}

// ---------------------------------------------------------------------------
// POST /api/invest
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  // 1. Parse body — MVP accepts JSON; real x402 payment header is a stretch goal
  let body: InvestBody;
  try {
    body = (await request.json()) as InvestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { payer_address, amount, agent_id: reviveAgentId } = body;

  // Basic validation
  if (!payer_address || typeof payer_address !== 'string') {
    return NextResponse.json(
      { error: 'payer_address is required' },
      { status: 400 },
    );
  }
  if (!amount || typeof amount !== 'number' || amount < MIN_DEPOSIT) {
    return NextResponse.json(
      { error: `amount must be at least ${MIN_DEPOSIT} USDC` },
      { status: 402, headers: { 'X-Payment-Required': `min_amount=${MIN_DEPOSIT}` } },
    );
  }

  try {
    // -----------------------------------------------------------------
    // REVIVAL PATH — reactivate a culled mutant
    // -----------------------------------------------------------------
    if (reviveAgentId != null) {
      const existing = await mutants.getByAgentId(reviveAgentId);

      if (!existing) {
        return NextResponse.json(
          { error: `No mutant found with agent_id ${reviveAgentId}` },
          { status: 404 },
        );
      }
      if (existing.lifecycle_status !== 'culled') {
        return NextResponse.json(
          { error: `Mutant ${reviveAgentId} is not culled (status: ${existing.lifecycle_status})` },
          { status: 409 },
        );
      }

      // Generate fresh genome for the revived mutant
      const genome = mutate(randomGenome());
      const dbGenome = toDbGenome(genome);

      // Generate new personality
      const personality = await generatePersonality(genome);

      // Update the existing row
      const revived = await mutants.update(existing.id, {
        owner_address: payer_address,
        genome: dbGenome as unknown as import('@/lib/db/types').Genome,
        name: personality.name,
        description: personality.description,
        image_prompt: personality.image_prompt,
        bankroll: amount,
        high_water_mark: amount,
        pnl: 0,
        fitness: 0,
        lifecycle_status: 'probation',
        revival_count: existing.revival_count + 1,
        last_revival_at: new Date().toISOString(),
        halt_reason: null,
        trades_today: 0,
        last_trade_at: null,
        last_evaluated_at: null,
        last_signal_status: null,
      });

      // Generate and upload new image
      let image_url = revived.image_url;
      try {
        const imageBuffer = await generateImage(personality.image_prompt);
        image_url = await uploadImage(revived.id, imageBuffer);
        await mutants.update(revived.id, { image_url });
      } catch (imgErr) {
        console.error('[invest/revive] Image generation failed, continuing:', imgErr);
      }

      // Queue onchain deposit recording
      await enqueue('record_deposit', {
        agentId: reviveAgentId,
        amount,
      });

      return NextResponse.json(
        {
          id: revived.id,
          agent_id: reviveAgentId,
          name: personality.name,
          description: personality.description,
          genome: dbGenome,
          owner: payer_address,
          bankroll: amount,
          image_url,
          status: 'probation',
          revival_count: existing.revival_count + 1,
        },
        { status: 201 },
      );
    }

    // -----------------------------------------------------------------
    // SPAWN PATH — create a brand-new mutant
    // -----------------------------------------------------------------

    // 3. Generate genome
    const active = await mutants.listActive();
    let genome: EvolutionGenome;
    let parentIds: string[] | null = null;

    if (active.length < CROSSOVER_THRESHOLD) {
      genome = randomGenome();
    } else {
      const [p1, p2, pids] = pickParents(active);
      genome = mutate(crossover(p1, p2));
      parentIds = pids;
    }

    const dbGenome = toDbGenome(genome);

    // 4. Generate personality
    const personality = await generatePersonality(genome);

    // 5. Insert mutant row with placeholder image
    const mutant = await mutants.insert({
      owner_address: payer_address,
      genome: dbGenome as unknown as import('@/lib/db/types').Genome,
      name: personality.name,
      description: personality.description,
      image_prompt: personality.image_prompt,
      image_url: null,
      bankroll: amount,
      high_water_mark: amount,
      reserved_margin: 0,
      pnl: 0,
      fitness: 0,
      capital_allocation: 1.0,
      generation: parentIds ? Math.max(...active.map((m) => m.generation), 0) + 1 : 1,
      parent_ids: parentIds,
      lifecycle_status: 'active',
      trades_today: 0,
      revival_count: 0,
      novelty_score: 0,
      correlation_score: 0,
    });

    // 6. Generate image, upload, update row
    let image_url: string | null = null;
    try {
      const imageBuffer = await generateImage(personality.image_prompt);
      image_url = await uploadImage(mutant.id, imageBuffer);
      await mutants.update(mutant.id, { image_url });
    } catch (imgErr) {
      console.error('[invest] Image generation failed, continuing without image:', imgErr);
    }

    // 7. Queue onchain transactions
    await enqueue('register', {
      agentURI: `/api/mutants/${mutant.id}/registration.json`,
    });
    await enqueue('record_deposit', {
      agentId: mutant.id,
      amount,
    });

    // 8. Return response
    return NextResponse.json(
      {
        id: mutant.id,
        agent_id: mutant.agent_id,
        name: personality.name,
        description: personality.description,
        genome: dbGenome,
        owner: payer_address,
        bankroll: amount,
        image_url,
        status: 'active',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[invest] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
