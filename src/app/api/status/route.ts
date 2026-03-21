import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

export async function GET() {
  try {
    const supabase = getSupabase();

    // Fetch all mutants to aggregate TVL and count active
    const { data: allMutants, error: mutantsErr } = await supabase
      .from('mutants')
      .select('bankroll, lifecycle_status');
    if (mutantsErr) throw mutantsErr;

    const tvl = (allMutants ?? []).reduce(
      (sum, m) => sum + (m.bankroll ?? 0),
      0
    );
    const activeMutants = (allMutants ?? []).filter(
      (m) => m.lifecycle_status === 'active'
    ).length;

    // Total trades count
    const { count: totalTrades, error: tradesErr } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true });
    if (tradesErr) throw tradesErr;

    // Last evolution timestamp
    const { data: lastEvo, error: evoErr } = await supabase
      .from('evolution_logs')
      .select('created_at')
      .order('generation', { ascending: false })
      .limit(1)
      .single();
    if (evoErr && evoErr.code !== 'PGRST116') throw evoErr;

    return NextResponse.json({
      tvl,
      active_mutants: activeMutants,
      total_trades: totalTrades ?? 0,
      last_evolution_at: lastEvo?.created_at ?? null,
    });
  } catch (err) {
    console.error('[api/status] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch fund status' },
      { status: 500 }
    );
  }
}
