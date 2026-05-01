import * as vscode from 'vscode';
import { ProviderType } from './types';
import { initProviderTracker, disposeProviderTracker } from './providerTracker';
import { UsageViewProvider } from './panel/UsageViewProvider';

let statusBarItem: vscode.StatusBarItem;

function detectProvider(): ProviderType {
  if (
    process.env.CLAUDE_CODE_USE_VERTEX === '1' ||
    process.env.ANTHROPIC_VERTEX_PROJECT_ID
  ) {
    return 'vertex';
  }
  return 'anthropic';
}

export function activate(context: vscode.ExtensionContext) {
  const provider = detectProvider();

  initProviderTracker(provider);

  const viewProvider = new UsageViewProvider(context.extensionUri, provider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(UsageViewProvider.viewType, viewProvider),
  );

  const showDashboard = vscode.commands.registerCommand(
    'claude-vertex-indicator.showDashboard',
    () => {
      vscode.commands.executeCommand('claude-vertex-indicator.usageView.focus');
      viewProvider.refresh();
    },
  );
  context.subscriptions.push(showDashboard);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  statusBarItem.command = 'claude-vertex-indicator.showDashboard';

  if (provider === 'vertex') {
    statusBarItem.text = '$(cloud) Vertex';
    statusBarItem.tooltip = 'Claude Code via Vertex AI — Click for usage stats';
  } else {
    statusBarItem.text = '$(zap) Claude Pro';
    statusBarItem.tooltip = 'Claude Code via Anthropic API — Click for usage stats';
  }

  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  statusBarItem?.dispose();
  disposeProviderTracker();
}
