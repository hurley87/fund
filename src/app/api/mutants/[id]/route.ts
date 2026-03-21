import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { mutants, trades } from '@/lib/db/supabase';

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/mutants/[id]'>
) {
  try {
    const { id } = await ctx.params;

    let mutant;
    try {
      mutant = await mutants.getById(id);
    } catch {
      return NextResponse.json(
        { error: 'Mutant not found' },
        { status: 404 }
      );
    }

    const tradeHistory = await trades.list(id);

    return NextResponse.json({ mutant, trades: tradeHistory });
  } catch (err) {
    console.error('[api/mutants/[id]] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch mutant' },
      { status: 500 }
    );
  }
}
