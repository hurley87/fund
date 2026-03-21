import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/config/env';
import type { Mutant, Trade, EvolutionLog, TxQueueItem } from './types';

let _client: SupabaseClient | null = null;

/** Server-side Supabase client using service role key. */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Typed query helpers
// ---------------------------------------------------------------------------

export const mutants = {
  async list() {
    const { data, error } = await getSupabase()
      .from('mutants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Mutant[];
  },

  async getById(id: string) {
    const { data, error } = await getSupabase()
      .from('mutants')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Mutant;
  },

  async getByAgentId(agentId: number) {
    const { data, error } = await getSupabase()
      .from('mutants')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    if (error) throw error;
    return data as Mutant;
  },

  async insert(mutant: Partial<Mutant>) {
    const { data, error } = await getSupabase()
      .from('mutants')
      .insert(mutant)
      .select()
      .single();
    if (error) throw error;
    return data as Mutant;
  },

  async update(id: string, fields: Partial<Mutant>) {
    const { data, error } = await getSupabase()
      .from('mutants')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Mutant;
  },

  async listActive() {
    const { data, error } = await getSupabase()
      .from('mutants')
      .select('*')
      .eq('lifecycle_status', 'active')
      .order('fitness', { ascending: false });
    if (error) throw error;
    return data as Mutant[];
  },
};

export const trades = {
  async list(mutantId?: string) {
    let query = getSupabase()
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false });
    if (mutantId) query = query.eq('mutant_id', mutantId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Trade[];
  },

  async insert(trade: Partial<Trade>) {
    const { data, error } = await getSupabase()
      .from('trades')
      .insert(trade)
      .select()
      .single();
    if (error) throw error;
    return data as Trade;
  },
};

export const evolutionLogs = {
  async list() {
    const { data, error } = await getSupabase()
      .from('evolution_logs')
      .select('*')
      .order('generation', { ascending: false });
    if (error) throw error;
    return data as EvolutionLog[];
  },

  async insert(log: Partial<EvolutionLog>) {
    const { data, error } = await getSupabase()
      .from('evolution_logs')
      .insert(log)
      .select()
      .single();
    if (error) throw error;
    return data as EvolutionLog;
  },
};

export const txQueue = {
  async listPending() {
    const { data, error } = await getSupabase()
      .from('tx_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as TxQueueItem[];
  },

  async insert(item: Partial<TxQueueItem>) {
    const { data, error } = await getSupabase()
      .from('tx_queue')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data as TxQueueItem;
  },

  async update(id: string, fields: Partial<TxQueueItem>) {
    const { data, error } = await getSupabase()
      .from('tx_queue')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TxQueueItem;
  },
};
