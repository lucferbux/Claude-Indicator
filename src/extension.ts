import * as vscode from 'vscode';
import { execSync } from 'child_process';

let statusBarItem: vscode.StatusBarItem;

function detectVertex(): { isVertex: boolean; projectId?: string } {
  if (process.env.CLAUDE_CODE_USE_VERTEX === '1') {
    return { isVertex: true, projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID };
  }
  if (process.env.ANTHROPIC_VERTEX_PROJECT_ID) {
    return { isVertex: true, projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID };
  }

  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const raw = execSync(
      `${shell} -lc 'printf "__CV__%s|%s" "$CLAUDE_CODE_USE_VERTEX" "$ANTHROPIC_VERTEX_PROJECT_ID"'`,
      { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).toString('utf-8');
    const m = raw.match(/__CV__([^|]*)\|(.*)/);
    if (m) {
      const useVertex = m[1].trim();
      const projId = m[2].trim();
      if (useVertex === '1' || projId) {
        return { isVertex: true, projectId: projId || undefined };
      }
    }
  } catch {
    // shell probe failed
  }

  return { isVertex: false };
}

export function activate(context: vscode.ExtensionContext) {
  const { isVertex, projectId } = detectVertex();

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );

  if (isVertex) {
    statusBarItem.text = '$(cloud) Vertex AI';
    statusBarItem.tooltip = projectId
      ? `Claude Code via Vertex AI\nProject: ${projectId}`
      : 'Claude Code via Vertex AI';
    statusBarItem.color = new vscode.ThemeColor(
      'statusBarItem.warningForeground',
    );
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground',
    );
  } else {
    statusBarItem.text = '$(zap) Anthropic API';
    statusBarItem.tooltip = 'Claude Code via direct Anthropic API';
  }

  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate() {
  statusBarItem?.dispose();
}
