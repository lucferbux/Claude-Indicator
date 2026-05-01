import { ModelPricing } from './types';

const PRICING: Record<string, ModelPricing> = {
  opus: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  haiku: { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};

const TOKENS_PER_MILLION = 1_000_000;

export function getModelFamily(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.includes('opus')) { return 'opus'; }
  if (id.includes('haiku')) { return 'haiku'; }
  if (id.includes('sonnet')) { return 'sonnet'; }
  return 'sonnet';
}

export function calculateModelCost(
  family: string,
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number },
): number {
  const pricing = PRICING[family] || PRICING.sonnet;
  return (
    (tokens.input / TOKENS_PER_MILLION) * pricing.input +
    (tokens.output / TOKENS_PER_MILLION) * pricing.output +
    (tokens.cacheRead / TOKENS_PER_MILLION) * pricing.cacheRead +
    (tokens.cacheWrite / TOKENS_PER_MILLION) * pricing.cacheWrite
  );
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}

export function getModelDisplayName(family: string): string {
  switch (family) {
    case 'opus': return 'Claude Opus';
    case 'sonnet': return 'Claude Sonnet';
    case 'haiku': return 'Claude Haiku';
    default: return family;
  }
}

export function getModelColor(family: string): string {
  switch (family) {
    case 'opus': return '#d4a574';
    case 'sonnet': return '#7eb8da';
    case 'haiku': return '#a8d5a2';
    default: return '#888888';
  }
}
