export const ASSET_ALLOWLIST = ['ETH', 'BTC', 'SOL'] as const;
export type Asset = (typeof ASSET_ALLOWLIST)[number];

export interface Genome {
  signal_bias: number;       // 0.0–1.0
  leverage: number;          // 1–10
  stop_loss: number;         // 0.03–0.15
  take_profit: number;       // 0.05–0.30
  asset: number;             // 0–2 index into ASSET_ALLOWLIST
  timeframe_hours: number;   // 0.25–24
  position_size_pct: number; // 0.05–0.30
  entry_threshold: number;   // 0.01–0.10
}

export const GENE_RANGES: Record<keyof Genome, { min: number; max: number }> = {
  signal_bias:       { min: 0.0,  max: 1.0  },
  leverage:          { min: 1,    max: 10   },
  stop_loss:         { min: 0.03, max: 0.15 },
  take_profit:       { min: 0.05, max: 0.30 },
  asset:             { min: 0,    max: 2    },
  timeframe_hours:   { min: 0.25, max: 24   },
  position_size_pct: { min: 0.05, max: 0.30 },
  entry_threshold:   { min: 0.01, max: 0.10 },
};

function randInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomGenome(): Genome {
  return {
    signal_bias:       randInRange(0.0, 1.0),
    leverage:          randInRange(1, 10),
    stop_loss:         randInRange(0.03, 0.15),
    take_profit:       randInRange(0.05, 0.30),
    asset:             Math.floor(Math.random() * ASSET_ALLOWLIST.length),
    timeframe_hours:   randInRange(0.25, 24),
    position_size_pct: randInRange(0.05, 0.30),
    entry_threshold:   randInRange(0.01, 0.10),
  };
}
