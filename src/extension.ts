import * as vscode from 'vscode';
import { StatsPanelProvider } from './panel/StatsPanelProvider';
import { ProviderType } from './types';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const isVertex = process.env.CLAUDE_CODE_USE_VERTEX === '1';
  const provider: ProviderType = isVertex ? 'vertex' : 'anthropic';

  const panelProvider = new StatsPanelProvider(context.extensionUri, provider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'claude-vertex-indicator.statsView',
      panelProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  const togglePanel = vscode.commands.registerCommand(
    'claude-vertex-indicator.showDashboard',
    () => {
      vscode.commands.executeCommand('claude-vertex-indicator.statsView.focus');
    },
  );
  context.subscriptions.push(togglePanel);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  statusBarItem.command = 'claude-vertex-indicator.showDashboard';

  if (isVertex) {
    statusBarItem.text = '$(cloud)';
    statusBarItem.tooltip = 'Claude Code via Vertex AI — Click for usage stats';
    statusBarItem.color = new vscode.ThemeColor(
      'statusBarItem.errorForeground',
    );
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground',
    );
  } else {
    statusBarItem.text = '$(zap)';
    statusBarItem.tooltip = 'Claude Code via Anthropic API — Click for usage stats';
  }

  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  statusBarItem?.dispose();
}
