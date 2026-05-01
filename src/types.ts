export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface ModelTokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

export interface StatsCache {
  dailyModelTokens: DailyModelTokens[];
  dailyActivity: DailyActivity[];
  modelUsage: Record<string, ModelTokenBreakdown>;
  totalSessions: number;
  totalMessages: number;
  hourCounts: Record<string, number>;
}

export interface MonthlyModelUsage {
  modelId: string;
  modelFamily: string;
  totalTokens: number;
  estimatedInput: number;
  estimatedOutput: number;
  estimatedCacheRead: number;
  estimatedCacheWrite: number;
  estimatedCost: number;
}

export interface MonthlyStats {
  month: string;
  totalTokens: number;
  totalCost: number;
  sessions: number;
  messages: number;
  toolCalls: number;
  models: MonthlyModelUsage[];
  dailyTokens: { date: string; tokensByModel: Record<string, number> }[];
}

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type ProviderType = 'vertex' | 'anthropic';
