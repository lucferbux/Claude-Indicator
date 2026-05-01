import { MonthlyStats, ProviderType } from '../types';
import { formatCurrency, formatTokens, getModelDisplayName, getModelColor } from '../costCalculator';

function getMonthLabel(monthPrefix: string): string {
  const [year, month] = monthPrefix.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderProviderBadge(provider: ProviderType): string {
  if (provider === 'vertex') {
    return '<span class="badge badge-vertex">Vertex AI</span>';
  }
  return '<span class="badge badge-anthropic">Anthropic API</span>';
}

function renderBudgetBar(totalCost: number, budget: number): string {
  const pct = Math.min((totalCost / budget) * 100, 100);
  const remaining = Math.max(budget - totalCost, 0);
  const barClass = pct > 90 ? 'bar-danger' : pct > 70 ? 'bar-warning' : 'bar-ok';

  return `
    <div class="card">
      <div class="card-title">Pro Plan Budget</div>
      <div class="budget-info">
        <span>${formatCurrency(totalCost)} of ${formatCurrency(budget)}</span>
        <span>${formatCurrency(remaining)} remaining</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${barClass}" style="width: ${pct.toFixed(1)}%"></div>
      </div>
      <div class="budget-note">Estimated from token usage. Actual billing may differ.</div>
    </div>`;
}

function renderModelBreakdown(models: MonthlyStats['models']): string {
  if (models.length === 0) {
    return '<div class="empty">No model usage this month</div>';
  }

  const maxCost = Math.max(...models.map((m) => m.estimatedCost), 0.01);

  const rows = models
    .map((m) => {
      const pct = (m.estimatedCost / maxCost) * 100;
      const color = getModelColor(m.modelFamily);
      return `
      <div class="model-row">
        <div class="model-info">
          <span class="model-dot" style="background:${color}"></span>
          <span class="model-name">${escapeHtml(getModelDisplayName(m.modelFamily))}</span>
          <span class="model-cost">${formatCurrency(m.estimatedCost)}</span>
        </div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="model-tokens">${formatTokens(m.totalTokens)} tokens</div>
      </div>`;
    })
    .join('');

  return `
    <div class="card">
      <div class="card-title">Cost by Model</div>
      ${rows}
    </div>`;
}

function renderUsageStats(stats: MonthlyStats): string {
  return `
    <div class="card">
      <div class="card-title">Usage This Month</div>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">${stats.sessions.toLocaleString()}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat">
          <div class="stat-value">${stats.messages.toLocaleString()}</div>
          <div class="stat-label">Messages</div>
        </div>
        <div class="stat">
          <div class="stat-value">${stats.toolCalls.toLocaleString()}</div>
          <div class="stat-label">Tool Calls</div>
        </div>
        <div class="stat">
          <div class="stat-value">${formatTokens(stats.totalTokens)}</div>
          <div class="stat-label">Tokens</div>
        </div>
      </div>
    </div>`;
}

function renderDailyChart(dailyTokens: MonthlyStats['dailyTokens'], models: MonthlyStats['models']): string {
  if (dailyTokens.length === 0) {
    return '';
  }

  const maxDaily = Math.max(...dailyTokens.map((d) => Object.values(d.tokensByModel).reduce((s, v) => s + v, 0)), 1);

  const familyColors: Record<string, string> = {};
  for (const m of models) {
    familyColors[m.modelFamily] = getModelColor(m.modelFamily);
  }

  const bars = dailyTokens
    .map((day) => {
      const dayNum = day.date.split('-')[2];
      const total = Object.values(day.tokensByModel).reduce((s, v) => s + v, 0);
      const pct = (total / maxDaily) * 100;

      const segments: { family: string; tokens: number }[] = [];
      for (const [modelId, tokens] of Object.entries(day.tokensByModel)) {
        const family = modelId.toLowerCase().includes('opus') ? 'opus' :
          modelId.toLowerCase().includes('haiku') ? 'haiku' : 'sonnet';
        const existing = segments.find((s) => s.family === family);
        if (existing) {
          existing.tokens += tokens;
        } else {
          segments.push({ family, tokens });
        }
      }

      const segmentDivs = segments
        .map((seg) => {
          const segPct = total > 0 ? (seg.tokens / total) * 100 : 0;
          return `<div class="bar-segment" style="width:${segPct.toFixed(1)}%;background:${familyColors[seg.family] || '#888'}"></div>`;
        })
        .join('');

      return `
        <div class="chart-row">
          <div class="chart-label">${dayNum}</div>
          <div class="chart-bar-track">
            <div class="chart-bar" style="width:${pct.toFixed(1)}%">${segmentDivs}</div>
          </div>
          <div class="chart-value">${formatTokens(total)}</div>
        </div>`;
    })
    .join('');

  const legendItems = Object.entries(familyColors)
    .map(([family, color]) => `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${getModelDisplayName(family)}</span>`)
    .join('');

  return `
    <div class="card">
      <div class="card-title">Daily Token Usage</div>
      <div class="legend">${legendItems}</div>
      <div class="chart">${bars}</div>
    </div>`;
}

function renderModelTable(models: MonthlyStats['models']): string {
  if (models.length === 0) {
    return '';
  }

  const rows = models
    .map((m) => `
      <tr>
        <td><span class="model-dot" style="background:${getModelColor(m.modelFamily)}"></span>${escapeHtml(getModelDisplayName(m.modelFamily))}</td>
        <td class="num">${formatTokens(m.estimatedInput)}</td>
        <td class="num">${formatTokens(m.estimatedOutput)}</td>
        <td class="num">${formatTokens(m.estimatedCacheRead)}</td>
        <td class="num">${formatTokens(m.estimatedCacheWrite)}</td>
        <td class="num cost">${formatCurrency(m.estimatedCost)}</td>
      </tr>`)
    .join('');

  return `
    <div class="card">
      <div class="card-title">Token Breakdown (Estimated)</div>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th class="num">Input</th>
            <th class="num">Output</th>
            <th class="num">Cache Read</th>
            <th class="num">Cache Write</th>
            <th class="num">Cost</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function getTemplate(
  stats: MonthlyStats | null,
  provider: ProviderType,
  budget: number,
  nonce: string,
): string {
  const monthLabel = stats ? getMonthLabel(stats.month) : getMonthLabel(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );

  const body = stats
    ? `
      <div class="cost-hero">
        <div class="cost-label">Estimated Cost</div>
        <div class="cost-value">${formatCurrency(stats.totalCost)}</div>
      </div>
      ${provider === 'anthropic' ? renderBudgetBar(stats.totalCost, budget) : ''}
      ${renderModelBreakdown(stats.models)}
      ${renderUsageStats(stats)}
      ${renderDailyChart(stats.dailyTokens, stats.models)}
      ${renderModelTable(stats.models)}
    `
    : `<div class="card"><div class="empty">No usage data found. Make sure Claude Code has been used at least once.</div></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Claude Code Usage</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    h1 {
      font-size: 1.4em;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .month-label {
      color: var(--vscode-descriptionForeground);
      font-size: 0.95em;
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
    }
    .badge-vertex {
      background: var(--vscode-statusBarItem-warningBackground, #856404);
      color: var(--vscode-statusBarItem-warningForeground, #fff);
    }
    .badge-anthropic {
      background: var(--vscode-statusBarItem-prominentBackground, #388a34);
      color: var(--vscode-statusBarItem-prominentForeground, #fff);
    }
    .refresh-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }
    .refresh-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .cost-hero {
      text-align: center;
      padding: 24px 0 16px;
    }
    .cost-label {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-bottom: 4px;
    }
    .cost-value {
      font-size: 2.8em;
      font-weight: 700;
      color: var(--vscode-foreground);
    }
    .card {
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border, transparent));
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .card-title {
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 0.95em;
      color: var(--vscode-foreground);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .stat { text-align: center; }
    .stat-value {
      font-size: 1.5em;
      font-weight: 700;
      color: var(--vscode-foreground);
    }
    .stat-label {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    .budget-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.85em;
      margin-bottom: 6px;
    }
    .progress-track {
      height: 10px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 5px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.3s;
    }
    .bar-ok { background: #4caf50; }
    .bar-warning { background: #ff9800; }
    .bar-danger { background: #f44336; }
    .budget-note {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
      font-style: italic;
    }
    .model-row { margin-bottom: 10px; }
    .model-info {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .model-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .model-name {
      font-size: 0.9em;
      flex: 1;
    }
    .model-cost {
      font-weight: 600;
      font-size: 0.9em;
    }
    .model-bar-track {
      height: 6px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 3px;
      overflow: hidden;
    }
    .model-bar-fill {
      height: 100%;
      border-radius: 3px;
    }
    .model-tokens {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    .chart { display: flex; flex-direction: column; gap: 3px; }
    .chart-row {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 18px;
    }
    .chart-label {
      width: 24px;
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      flex-shrink: 0;
    }
    .chart-bar-track {
      flex: 1;
      height: 12px;
      background: var(--vscode-progressBar-background, #222);
      border-radius: 3px;
      overflow: hidden;
    }
    .chart-bar {
      height: 100%;
      display: flex;
      border-radius: 3px;
      overflow: hidden;
    }
    .bar-segment { height: 100%; }
    .chart-value {
      width: 48px;
      font-size: 0.7em;
      color: var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }
    .legend {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85em;
    }
    th, td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border, #333));
    }
    th {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      font-size: 0.85em;
    }
    .num { text-align: right; }
    .cost { font-weight: 600; }
    .empty {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 32px 16px;
    }
    @media (max-width: 500px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Claude Code Usage</h1>
      ${renderProviderBadge(provider)}
    </div>
    <div>
      <span class="month-label">${escapeHtml(monthLabel)}</span>
      <button class="refresh-btn" id="refreshBtn">Refresh</button>
    </div>
  </div>
  ${body}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });
  </script>
</body>
</html>`;
}
