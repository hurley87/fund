import { NextResponse } from 'next/server';
import { mutants, deposits } from '@/lib/db/supabase';
import { randomGenome } from '@/lib/evolution/genome';
import { crossover } from '@/lib/evolution/crossover';
import { mutate } from '@/lib/evolution/mutation';
import {
  generatePersonality,
  generateImage,
  uploadImage,
} from '@/lib/personality/generate';
import { enqueue } from '@/lib/queue/tx-queue';
import { verifyUsdcTransfer } from '@/lib/verify/usdc-transfer';
import type { Genome as EvolutionGenome } from '@/lib/evolution/genome';

const CROSSOVER_THRESHOLD = 6;
const MIN_DEPOSIT = 10;

interface InvestBody {
  payer_address: string;
  tx_hash: string;
  /** If provided, attempt to revive a culled mutant instead of spawning new */
  agent_id?: number;
}

function extractEvolutionGenome(dbGenome: unknown): EvolutionGenome {
  const g = dbGenome as Record<string, unknown>;
  if (g._raw && typeof g._raw === 'object') {
    return g._raw as EvolutionGenome;
  }
  return randomGenome();
}

function pickParents(active: { id: string; genome: unknown; fitness: number }[]): [EvolutionGenome, EvolutionGenome, string[]] {
  const sorted = [...active].sort((a, b) => b.fitness - a.fitness);
  const parent1 = sorted[0];
  const parent2 = sorted[1] ?? sorted[0];
  return [
    extractEvolutionGenome(parent1.genome),
    extractEvolutionGenome(parent2.genome),
    [parent1.id, parent2.id],
  ];
}

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
    _raw: { ...g },
  };
}

export async function POST(request: Request) {
  let body: InvestBody;
  try {
    body = (await request.json()) as InvestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { payer_address, tx_hash, agent_id: reviveAgentId } = body;

  if (!payer_address || typeof payer_address !== 'string') {
    return NextResponse.json({ error: 'payer_address is required' }, { status: 400 });
  }
  if (!tx_hash || typeof tx_hash !== 'string') {
    return NextResponse.json({ error: 'tx_hash is required' }, { status: 400 });
  }

  const payer = payer_address.toLowerCase();

  try {
    // 1. Check replay — has this tx_hash been used before?
    const existingDeposit = await deposits.getByTxHash(tx_hash);
    if (existingDeposit) {
      return NextResponse.json(
        { error: 'This transaction has already been used for a deposit' },
        { status: 409 },
      );
    }

    // 2. Verify USDC transfer on-chain
    let amount: number;
    try {
      const transfer = await verifyUsdcTransfer(tx_hash, payer_address);
      amount = transfer.amount;
    } catch (err) {
      return NextResponse.json(
        { error: `Payment verification failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 400 },
      );
    }

    if (amount < MIN_DEPOSIT) {
      return NextResponse.json(
        { error: `Minimum deposit is ${MIN_DEPOSIT} USDC. Transfer was ${amount} USDC.` },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------
    // REVIVAL PATH
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
      if (existing.owner_address !== payer) {
        return NextResponse.json(
          { error: 'You can only revive your own mutant' },
          { status: 403 },
        );
      }

      const genome = mutate(randomGenome());
      const dbGenome = toDbGenome(genome);
      const personality = await generatePersonality(genome);

      const revived = await mutants.update(existing.id, {
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

      // Parallel: record deposit + generate image (independent)
      let image_url = revived.image_url;
      const [, imgResult] = await Promise.allSettled([
        deposits.insert({
          mutant_id: revived.id,
          tx_hash,
          from_address: payer,
          amount,
          type: 'revival',
        }),
        generateImage(personality.image_prompt)
          .then((buf) => uploadImage(revived.id, buf)),
      ]);

      if (imgResult.status === 'fulfilled') {
        image_url = imgResult.value;
        await mutants.update(revived.id, { image_url });
      } else {
        console.error('[invest/revive] Image generation failed, continuing:', imgResult.reason);
      }

      await enqueue('record_deposit', { agentId: reviveAgentId, amount });

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
    // SPAWN PATH
    // -----------------------------------------------------------------

    // One mutant per wallet
    const existingMutant = await mutants.getByOwner(payer_address);
    if (existingMutant) {
      return NextResponse.json(
        {
          error: 'You already have a mutant. Use POST /api/fund to add more USDC, or POST /api/invest with agent_id to revive a culled mutant.',
          mutant_id: existingMutant.id,
          agent_id: existingMutant.agent_id,
        },
        { status: 409 },
      );
    }

    // Generate genome
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
    const personality = await generatePersonality(genome);

    const mutant = await mutants.insert({
      owner_address: payer,
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

    // Parallel: record deposit + generate image (independent)
    let image_url: string | null = null;
    const [, imageResult] = await Promise.allSettled([
      deposits.insert({
        mutant_id: mutant.id,
        tx_hash,
        from_address: payer,
        amount,
        type: 'spawn',
      }),
      generateImage(personality.image_prompt)
        .then((buf) => uploadImage(mutant.id, buf)),
    ]);

    if (imageResult.status === 'fulfilled') {
      image_url = imageResult.value;
      await mutants.update(mutant.id, { image_url });
    } else {
      console.error('[invest] Image generation failed, continuing without image:', imageResult.reason);
    }

    await Promise.all([
      enqueue('register', { agentURI: `/api/mutants/${mutant.id}/registration.json` }),
      enqueue('record_deposit', { agentId: mutant.id, amount }),
    ]);

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
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
