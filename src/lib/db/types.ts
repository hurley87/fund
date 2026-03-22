export type LifecycleStatus = 'active' | 'benched' | 'culled' | 'probation' | 'awaiting_deposit';

export interface Genome {
  signal_bias: number;
  leverage: number;
  stop_loss: number;
  take_profit: number;
  asset: number | string;
  timeframe_hours: number;
  position_size_pct: number;
  entry_threshold: number;
  [key: string]: unknown;
}

export interface Mutant {
  id: string;
  agent_id: number | null;
  owner_address: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  image_prompt: string | null;
  genome: Genome;
  bankroll: number;
  reserved_margin: number;
  high_water_mark: number;
  pnl: number;
  fitness: number;
  capital_allocation: number;
  generation: number;
  parent_ids: string[] | null;
  lifecycle_status: LifecycleStatus;
  trades_today: number;
  last_trade_at: string | null;
  last_evaluated_at: string | null;
  last_signal_status: string | null;
  halt_reason: string | null;
  revival_count: number;
  last_revival_at: string | null;
  novelty_score: number;
  correlation_score: number;
  created_at: string;
}

export interface Trade {
  id: string;
  mutant_id: string;
  tx_hash: string | null;
  bankr_job_id: string | null;
  action: string | null;
  asset: string | null;
  amount: number | null;
  leverage: number | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  pnl: number | null;
  reasoning: string | null;
  created_at: string;
}

export interface EvolutionLog {
  id: string;
  generation: number;
  elite_ids: string[] | null;
  survivor_ids: string[] | null;
  offspring_ids: string[] | null;
  culled_ids: string[] | null;
  tier_counts: Record<string, number> | null;
  mutations: Record<string, unknown> | null;
  avg_fitness: number | null;
  created_at: string;
}

export type DepositType = 'spawn' | 'topup' | 'revival';

export interface Deposit {
  id: string;
  mutant_id: string;
  tx_hash: string;
  from_address: string;
  amount: number;
  type: DepositType;
  created_at: string;
}

export interface TxQueueItem {
  id: string;
  type: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  tx_hash: string | null;
  nonce: number | null;
  created_at: string;
  processed_at: string | null;
}
