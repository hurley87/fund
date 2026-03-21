import { NextResponse } from 'next/server';
import { mutants } from '@/lib/db/supabase';
import { getSupabase } from '@/lib/db/supabase';
import type { LifecycleStatus } from '@/lib/db/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as LifecycleStatus | null;

    if (status) {
      const { data, error } = await getSupabase()
        .from('mutants')
        .select('*')
        .eq('lifecycle_status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json({ mutants: data });
    }

    const data = await mutants.list();
    return NextResponse.json({ mutants: data });
  } catch (err) {
    console.error('[api/mutants] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch mutants' },
      { status: 500 }
    );
  }
}
