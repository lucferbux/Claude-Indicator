import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProviderType, StatsCache, MonthlyStats, MonthlyModelUsage, DailyModelTokens, DailyActivity } from './types';
import { calculateModelCost, getModelFamily } from './costCalculator';

interface ProviderData {
  dailyModelTokens: DailyModelTokens[];
  dailyActivity: DailyActivity[];
  modelUsage: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>;
}

interface ProviderStore {
  version: number;
  lastSeenTotalSessions: number;
  lastSeenTotalMessages: number;
  lastSeenDailyTokensLength: number;
  providers: Record<string, ProviderData>;
}

let watcher: fs.FSWatcher | undefined;
let currentProvider: ProviderType = 'vertex';
let store: ProviderStore | null = null;

function getStorePath(): string {
  return path.join(os.homedir(), '.claude', 'vertex-indicator-provider-stats.json');
}

function getStatsCachePath(): string {
  return path.join(os.homedir(), '.claude', 'stats-cache.json');
}

function loadStore(): ProviderStore {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    return JSON.parse(raw) as ProviderStore;
  } catch {
    return {
      version: 1,
      lastSeenTotalSessions: 0,
      lastSeenTotalMessages: 0,
      lastSeenDailyTokensLength: 0,
      providers: {},
    };
  }
}

function saveStore(s: ProviderStore): void {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(s, null, 2), 'utf-8');
  } catch {
    // silently fail
  }
}

function ensureProvider(s: ProviderStore, provider: string): ProviderData {
  if (!s.providers[provider]) {
    s.providers[provider] = { dailyModelTokens: [], dailyActivity: [], modelUsage: {} };
  }
  return s.providers[provider];
}

function processUpdate(): void {
  let cache: StatsCache;
  try {
    const raw = fs.readFileSync(getStatsCachePath(), 'utf-8');
    cache = JSON.parse(raw) as StatsCache;
  } catch {
    return;
  }

  if (!store) {
    store = loadStore();
  }

  const prov = ensureProvider(store, currentProvider);
  const today = new Date().toISOString().slice(0, 10);

  const isFirstRun = store.lastSeenTotalSessions === 0 && store.lastSeenTotalMessages === 0 && store.lastSeenDailyTokensLength === 0;

  const sessionDelta = isFirstRun ? 0 : Math.max(0, (cache.totalSessions || 0) - store.lastSeenTotalSessions);
  const messageDelta = isFirstRun ? 0 : Math.max(0, (cache.totalMessages || 0) - store.lastSeenTotalMessages);

  if (!isFirstRun && cache.dailyModelTokens.length > store.lastSeenDailyTokensLength) {
    const newEntries = cache.dailyModelTokens.slice(store.lastSeenDailyTokensLength);
    for (const entry of newEntries) {
      const existing = prov.dailyModelTokens.find((d) => d.date === entry.date);
      if (existing) {
        for (const [model, tokens] of Object.entries(entry.tokensByModel)) {
          existing.tokensByModel[model] = (existing.tokensByModel[model] || 0) + tokens;
        }
      } else {
        prov.dailyModelTokens.push({
          date: entry.date,
          tokensByModel: { ...entry.tokensByModel },
        });
      }
    }
  }

  if (sessionDelta > 0 || messageDelta > 0) {
    const existingDay = prov.dailyActivity.find((d) => d.date === today);
    if (existingDay) {
      existingDay.sessionCount += sessionDelta;
      existingDay.messageCount += messageDelta;
    } else {
      prov.dailyActivity.push({
        date: today,
        sessionCount: sessionDelta,
        messageCount: messageDelta,
        toolCallCount: 0,
      });
    }
  }

  for (const [modelId, usage] of Object.entries(cache.modelUsage)) {
    if (!prov.modelUsage[modelId]) {
      prov.modelUsage[modelId] = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
    }
  }

  store.lastSeenTotalSessions = cache.totalSessions || 0;
  store.lastSeenTotalMessages = cache.totalMessages || 0;
  store.lastSeenDailyTokensLength = cache.dailyModelTokens.length;

  saveStore(store);
}

export function initProviderTracker(provider: ProviderType): void {
  currentProvider = provider;
  store = loadStore();

  processUpdate();

  const cachePath = getStatsCachePath();
  try {
    let debounceTimer: NodeJS.Timeout | undefined;
    watcher = fs.watch(cachePath, () => {
      if (debounceTimer) { clearTimeout(debounceTimer); }
      debounceTimer = setTimeout(processUpdate, 500);
    });
  } catch {
    // file may not exist yet
  }
}

function getCurrentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getBestMonthPrefix(prov: ProviderData): string {
  const current = getCurrentMonthPrefix();
  const hasCurrentData = prov.dailyModelTokens.some((d) => d.date.startsWith(current));
  if (hasCurrentData) {
    return current;
  }
  const dates = prov.dailyModelTokens.map((d) => d.date).sort();
  if (dates.length === 0) {
    return current;
  }
  return dates[dates.length - 1].substring(0, 7);
}

export function getProviderMonthlyStats(provider: ProviderType): MonthlyStats | null {
  if (!store) {
    store = loadStore();
  }

  const prov = store.providers[provider];
  if (!prov || prov.dailyModelTokens.length === 0) {
    return null;
  }

  const monthPrefix = getBestMonthPrefix(prov);
  const monthlyTokenDays = prov.dailyModelTokens.filter((d) => d.date.startsWith(monthPrefix));
  const monthlyActivityDays = prov.dailyActivity.filter((d) => d.date.startsWith(monthPrefix));

  if (monthlyTokenDays.length === 0 && monthlyActivityDays.length === 0) {
    return null;
  }

  const modelTotals: Record<string, number> = {};
  for (const day of monthlyTokenDays) {
    for (const [model, tokens] of Object.entries(day.tokensByModel)) {
      modelTotals[model] = (modelTotals[model] || 0) + tokens;
    }
  }

  const allTimeUsage = prov.modelUsage;

  const models: MonthlyModelUsage[] = Object.entries(modelTotals).map(([modelId, totalTokens]) => {
    const usage = allTimeUsage[modelId];
    let split: { input: number; output: number; cacheRead: number; cacheWrite: number };

    if (usage) {
      const total = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
      if (total > 0) {
        split = {
          input: totalTokens * (usage.inputTokens / total),
          output: totalTokens * (usage.outputTokens / total),
          cacheRead: totalTokens * (usage.cacheReadInputTokens / total),
          cacheWrite: totalTokens * (usage.cacheCreationInputTokens / total),
        };
      } else {
        split = { input: totalTokens * 0.7, output: totalTokens * 0.3, cacheRead: 0, cacheWrite: 0 };
      }
    } else {
      split = { input: totalTokens * 0.7, output: totalTokens * 0.3, cacheRead: 0, cacheWrite: 0 };
    }

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

export function disposeProviderTracker(): void {
  watcher?.close();
  watcher = undefined;
}
