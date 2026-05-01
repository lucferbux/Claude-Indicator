import { MonthlyStats } from '../types';
import { formatCurrency, formatTokens, getModelDisplayName, getModelColor } from '../costCalculator';

function getMonthLabel(monthPrefix: string): string {
  const [year, month] = monthPrefix.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getMonthLabelFromStats(stats: MonthlyStats | null): string {
  return stats
    ? getMonthLabel(stats.month)
    : getMonthLabel(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
}

function getModelRows(stats: MonthlyStats): string {
  const maxCost = Math.max(...stats.models.map((x) => x.estimatedCost), 0.01);
  return stats.models
    .map((m) => {
      const color = getModelColor(m.modelFamily);
      const pct = (m.estimatedCost / maxCost) * 100;
      return `
        <div class="model-row">
          <div class="model-header">
            <span class="dot" style="background:${color}"></span>
            <span class="model-name">${escapeHtml(getModelDisplayName(m.modelFamily))}</span>
            <span class="model-cost">${formatCurrency(m.estimatedCost)}</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
          <div class="model-tokens">${formatTokens(m.totalTokens)} tokens</div>
        </div>`;
    })
    .join('');
}

export function getVertexTemplate(stats: MonthlyStats | null, nonce: string): string {
  const monthLabel = getMonthLabelFromStats(stats);

  let body: string;
  if (!stats || (stats.totalTokens === 0 && stats.sessions === 0)) {
    body = '<div class="empty">No usage data for this period.</div>';
  } else {
    body = `
      <div class="cost-hero">${formatCurrency(stats.totalCost)}</div>
      <div class="stats-row">
        <div class="stat"><span class="stat-val">${stats.sessions.toLocaleString()}</span><span class="stat-lbl">Sessions</span></div>
        <div class="stat"><span class="stat-val">${stats.messages.toLocaleString()}</span><span class="stat-lbl">Messages</span></div>
        <div class="stat"><span class="stat-val">${formatTokens(stats.totalTokens)}</span><span class="stat-lbl">Tokens</span></div>
      </div>
      <div class="section">
        <div class="section-title">By Model</div>
        ${getModelRows(stats)}
      </div>`;
  }

  return wrapHtml('Vertex AI', 'badge-vertex', monthLabel, body, nonce);
}

export function getAnthropicTemplate(stats: MonthlyStats | null, budget: number, nonce: string): string {
  const monthLabel = getMonthLabelFromStats(stats);

  let body: string;
  if (!stats || (stats.totalTokens === 0 && stats.sessions === 0)) {
    body = '<div class="empty">No usage data for this period.</div>';
  } else {
    const pct = Math.min((stats.totalCost / budget) * 100, 100);
    const remaining = Math.max(budget - stats.totalCost, 0);
    const barClass = pct > 90 ? 'bar-danger' : pct > 70 ? 'bar-warning' : 'bar-ok';

    body = `
      <div class="cost-hero">${formatCurrency(stats.totalCost)}</div>
      <div class="stats-row">
        <div class="stat"><span class="stat-val">${stats.sessions.toLocaleString()}</span><span class="stat-lbl">Sessions</span></div>
        <div class="stat"><span class="stat-val">${stats.messages.toLocaleString()}</span><span class="stat-lbl">Messages</span></div>
        <div class="stat"><span class="stat-val">${formatTokens(stats.totalTokens)}</span><span class="stat-lbl">Tokens</span></div>
      </div>
      <div class="section">
        <div class="section-title">Pro Plan Budget</div>
        <div class="budget-row">
          <span>${formatCurrency(stats.totalCost)} / ${formatCurrency(budget)}</span>
          <span>${formatCurrency(remaining)} left</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${barClass}" style="width:${pct.toFixed(1)}%"></div></div>
      </div>
      <div class="section">
        <div class="section-title">By Model</div>
        ${getModelRows(stats)}
      </div>`;
  }

  return wrapHtml('Anthropic API', 'badge-anthropic', monthLabel, body, nonce);
}

function wrapHtml(
  providerLabel: string,
  badgeClass: string,
  monthLabel: string,
  body: string,
  nonce: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px 20px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75em;
      font-weight: 600;
    }
    .badge-vertex {
      background: var(--vscode-statusBarItem-errorBackground, #c53030);
      color: var(--vscode-statusBarItem-errorForeground, #fff);
    }
    .badge-anthropic {
      background: var(--vscode-statusBarItem-prominentBackground, #388a34);
      color: var(--vscode-statusBarItem-prominentForeground, #fff);
    }
    .month {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }
    .refresh-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 3px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.8em;
    }
    .refresh-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .cost-hero {
      text-align: center;
      font-size: 2.4em;
      font-weight: 700;
      padding: 10px 0 6px;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      padding: 10px 0 14px;
      border-bottom: 1px solid var(--vscode-widget-border, #333);
      margin-bottom: 12px;
    }
    .stat { text-align: center; }
    .stat-val { display: block; font-size: 1.2em; font-weight: 700; }
    .stat-lbl { font-size: 0.75em; color: var(--vscode-descriptionForeground); }
    .section { margin-bottom: 12px; }
    .section-title {
      font-weight: 600;
      font-size: 0.85em;
      margin-bottom: 6px;
      color: var(--vscode-foreground);
    }
    .budget-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8em;
      margin-bottom: 4px;
    }
    .bar-track {
      height: 6px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 2px;
    }
    .bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .bar-ok { background: #4caf50; }
    .bar-warning { background: #ff9800; }
    .bar-danger { background: #f44336; }
    .model-row { margin-bottom: 8px; }
    .model-header {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 3px;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .model-name { font-size: 0.85em; flex: 1; }
    .model-cost { font-weight: 600; font-size: 0.85em; }
    .model-tokens {
      font-size: 0.7em;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }
    .empty {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 24px 8px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="badge ${badgeClass}">${providerLabel}</span>
      <span class="month">${escapeHtml(monthLabel)}</span>
    </div>
    <button class="refresh-btn" id="refreshBtn">Refresh</button>
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
