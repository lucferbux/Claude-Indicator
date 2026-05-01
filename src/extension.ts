import * as vscode from 'vscode';
import { ProviderType } from './types';
import { getMonthlyStats } from './statsReader';
import { getProviderMonthlyStats, initProviderTracker, disposeProviderTracker } from './providerTracker';
import { getVertexTemplate, getAnthropicTemplate } from './panel/template';

let statusBarItem: vscode.StatusBarItem;
let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const isVertex = process.env.CLAUDE_CODE_USE_VERTEX === '1';
  const provider: ProviderType = isVertex ? 'vertex' : 'anthropic';

  initProviderTracker(provider);

  const showDashboard = vscode.commands.registerCommand(
    'claude-vertex-indicator.showDashboard',
    () => {
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Active);
        refreshPanel(provider);
        return;
      }

      currentPanel = vscode.window.createWebviewPanel(
        'claudeUsageDashboard',
        provider === 'vertex' ? 'Vertex AI Usage' : 'Claude Pro Usage',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: false },
      );

      currentPanel.onDidDispose(() => { currentPanel = undefined; });

      currentPanel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'refresh') {
          refreshPanel(provider);
        }
      });

      refreshPanel(provider);
    },
  );
  context.subscriptions.push(showDashboard);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  statusBarItem.command = 'claude-vertex-indicator.showDashboard';

  if (isVertex) {
    statusBarItem.text = '$(cloud) Vertex';
    statusBarItem.tooltip = 'Claude Code via Vertex AI — Click for usage stats';
  } else {
    statusBarItem.text = '$(zap) Claude Pro';
    statusBarItem.tooltip = 'Claude Code via Anthropic API — Click for usage stats';
  }

  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

function refreshPanel(provider: ProviderType): void {
  if (!currentPanel) {
    return;
  }
  const nonce = getNonce();
  const providerStats = getProviderMonthlyStats(provider);
  const allStats = getMonthlyStats();
  const budget = vscode.workspace
    .getConfiguration('claudeVertexIndicator')
    .get<number>('monthlyBudget', 20);

  if (provider === 'vertex') {
    currentPanel.webview.html = getVertexTemplate(providerStats ?? allStats, nonce);
  } else {
    currentPanel.webview.html = getAnthropicTemplate(providerStats ?? allStats, budget, nonce);
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export function deactivate() {
  statusBarItem?.dispose();
  currentPanel?.dispose();
  disposeProviderTracker();
}
