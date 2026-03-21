import { NextResponse } from 'next/server';
import { evolutionLogs } from '@/lib/db/supabase';
import { getSupabase } from '@/lib/db/supabase';

export async function GET() {
  try {
    // Get latest evolution log (list is ordered by generation DESC)
    const logs = await evolutionLogs.list();
    const latest = logs[0] ?? null;

    if (!latest) {
      return NextResponse.json({
        generation: 0,
        tier_counts: {},
        offspring_available: 0,
        avg_fitness: 0,
        created_at: null,
      });
    }

    // Count offspring awaiting deposit
    const { count, error } = await getSupabase()
      .from('mutants')
      .select('*', { count: 'exact', head: true })
      .eq('lifecycle_status', 'active')
      .in('id', latest.offspring_ids ?? []);
    if (error) throw error;

    return NextResponse.json({
      generation: latest.generation,
      tier_counts: latest.tier_counts ?? {},
      offspring_available: count ?? 0,
      avg_fitness: latest.avg_fitness ?? 0,
      created_at: latest.created_at,
    });
  } catch (err) {
    console.error('[api/evolution] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch evolution data' },
      { status: 500 }
    );
  }
}
