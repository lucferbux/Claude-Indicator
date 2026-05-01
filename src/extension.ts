import * as vscode from 'vscode';
import { StatsPanel } from './panel/StatsPanel';
import { ProviderType } from './types';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const isVertex = process.env.CLAUDE_CODE_USE_VERTEX === '1';
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  const provider: ProviderType = isVertex ? 'vertex' : 'anthropic';

  const showDashboard = vscode.commands.registerCommand(
    'claude-vertex-indicator.showDashboard',
    () => {
      StatsPanel.createOrShow(context.extensionUri, provider);
    },
  );
  context.subscriptions.push(showDashboard);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  statusBarItem.command = 'claude-vertex-indicator.showDashboard';

  if (isVertex) {
    statusBarItem.text = '$(cloud) Vertex AI';
    statusBarItem.tooltip = projectId
      ? `Claude Code via Vertex AI\nProject: ${projectId}\nClick for usage dashboard`
      : 'Claude Code via Vertex AI\nClick for usage dashboard';
    statusBarItem.color = new vscode.ThemeColor(
      'statusBarItem.warningForeground',
    );
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground',
    );
  } else {
    statusBarItem.text = '$(zap) Anthropic API';
    statusBarItem.tooltip = 'Claude Code via direct Anthropic API\nClick for usage dashboard';
  }

  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  statusBarItem?.dispose();
}
