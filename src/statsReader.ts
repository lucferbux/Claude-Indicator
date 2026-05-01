import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StatsCache, MonthlyStats, MonthlyModelUsage } from './types';
import { calculateModelCost, getModelFamily } from './costCalculator';

function getStatsCachePath(): string {
  return path.join(os.homedir(), '.claude', 'stats-cache.json');
}

function readStatsCache(): StatsCache | null {
  const filePath = getStatsCachePath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as StatsCache;
  } catch {
    return null;
  }
}

function getCurrentMonthPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function estimateTokenSplit(
  modelId: string,
  totalTokens: number,
  allTimeUsage: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>,
): { input: number; output: number; cacheRead: number; cacheWrite: number } {
  const usage = allTimeUsage[modelId];
  if (!usage) {
    return { input: totalTokens * 0.7, output: totalTokens * 0.3, cacheRead: 0, cacheWrite: 0 };
  }

  const allTimeTotal = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
  if (allTimeTotal === 0) {
    return { input: totalTokens * 0.7, output: totalTokens * 0.3, cacheRead: 0, cacheWrite: 0 };
  }

  return {
    input: totalTokens * (usage.inputTokens / allTimeTotal),
    output: totalTokens * (usage.outputTokens / allTimeTotal),
    cacheRead: totalTokens * (usage.cacheReadInputTokens / allTimeTotal),
    cacheWrite: totalTokens * (usage.cacheCreationInputTokens / allTimeTotal),
  };
}

export function getMonthlyStats(): MonthlyStats | null {
  const cache = readStatsCache();
  if (!cache) {
    return null;
  }

  const monthPrefix = getCurrentMonthPrefix();

  const monthlyTokenDays = cache.dailyModelTokens.filter((d) => d.date.startsWith(monthPrefix));
  const monthlyActivityDays = cache.dailyActivity.filter((d) => d.date.startsWith(monthPrefix));

  const modelTotals: Record<string, number> = {};
  for (const day of monthlyTokenDays) {
    for (const [model, tokens] of Object.entries(day.tokensByModel)) {
      modelTotals[model] = (modelTotals[model] || 0) + tokens;
    }
  }

  const models: MonthlyModelUsage[] = Object.entries(modelTotals).map(([modelId, totalTokens]) => {
    const split = estimateTokenSplit(modelId, totalTokens, cache.modelUsage);
    const family = getModelFamily(modelId);
    const cost = calculateModelCost(family, split);

    return {
      modelId,
      modelFamily: family,
      totalTokens,
      estimatedInput: Math.round(split.input),
      estimatedOutput: Math.round(split.output),
      estimatedCacheRead: Math.round(split.cacheRead),
      estimatedCacheWrite: Math.round(split.cacheWrite),
      estimatedCost: cost,
    };
  });

  models.sort((a, b) => b.estimatedCost - a.estimatedCost);

  const totalTokens = models.reduce((sum, m) => sum + m.totalTokens, 0);
  const totalCost = models.reduce((sum, m) => sum + m.estimatedCost, 0);

  const sessions = monthlyActivityDays.reduce((sum, d) => sum + d.sessionCount, 0);
  const messages = monthlyActivityDays.reduce((sum, d) => sum + d.messageCount, 0);
  const toolCalls = monthlyActivityDays.reduce((sum, d) => sum + d.toolCallCount, 0);

  return {
    month: monthPrefix,
    totalTokens,
    totalCost,
    sessions,
    messages,
    toolCalls,
    models,
    dailyTokens: monthlyTokenDays,
  };
}
