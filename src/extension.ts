import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { ProviderType } from './types';
import { initProviderTracker, disposeProviderTracker } from './providerTracker';
import { UsageViewProvider } from './panel/UsageViewProvider';

let statusBarItem: vscode.StatusBarItem;

function detectProvider(): ProviderType {
  const setting = vscode.workspace
    .getConfiguration('claude-vertex-indicator')
    .get<string>('provider', 'auto');

  if (setting === 'vertex') {
    return 'vertex';
  }
  if (setting === 'anthropic') {
    return 'anthropic';
  }

  if (
    process.env.CLAUDE_CODE_USE_VERTEX === '1' ||
    process.env.ANTHROPIC_VERTEX_PROJECT_ID
  ) {
    return 'vertex';
  }

  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const out = execSync(
      `${shell} -ilc 'echo "__CV__$CLAUDE_CODE_USE_VERTEX|$ANTHROPIC_VERTEX_PROJECT_ID"'`,
      { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).toString();
    const match = out.match(/__CV__(.+)\|(.+)?/);
    if (match) {
      const [, useVertex, projectId] = match;
      if (useVertex?.trim() === '1' || projectId?.trim()) {
        return 'vertex';
      }
    }
  } catch {
    // shell probe failed, fall through
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
