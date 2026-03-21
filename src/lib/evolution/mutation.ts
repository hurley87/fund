import { Genome, GENE_RANGES, ASSET_ALLOWLIST, clamp } from './genome';

/**
 * Mutate a genome by applying +/-10% random adjustment to each gene.
 * Asset gene mutates by +/-1 index with wrapping.
 */
export function mutate(genome: Genome): Genome {
  const mutated = { ...genome };

  for (const key of Object.keys(GENE_RANGES) as (keyof Genome)[]) {
    if (key === 'asset') continue;
    const range = GENE_RANGES[key];
    const span = range.max - range.min;
    const delta = (Math.random() * 2 - 1) * 0.10 * span;
    mutated[key] = clamp(mutated[key] + delta, range.min, range.max);
  }

  // Asset: shift by -1, 0, or +1 with wrapping
  const assetShift = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
  const len = ASSET_ALLOWLIST.length;
  mutated.asset = ((mutated.asset + assetShift) % len + len) % len;

  return mutated;
}
