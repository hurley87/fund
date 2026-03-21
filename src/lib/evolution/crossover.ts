import { Genome, GENE_RANGES, clamp } from './genome';

/**
 * Uniform crossover: randomly pick each gene from one parent.
 * All values clamped to valid ranges (risk guardrails).
 */
export function crossover(parent1: Genome, parent2: Genome): Genome {
  const child = {} as Genome;

  for (const key of Object.keys(GENE_RANGES) as (keyof Genome)[]) {
    const source = Math.random() < 0.5 ? parent1 : parent2;
    const range = GENE_RANGES[key];
    child[key] = clamp(source[key], range.min, range.max);
  }

  return child;
}
