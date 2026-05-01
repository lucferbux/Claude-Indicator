import * as vscode from 'vscode';
import { ProviderType } from '../types';
import { getMonthlyStats } from '../statsReader';
import { getProviderMonthlyStats } from '../providerTracker';
import { getVertexTemplate, getAnthropicTemplate } from './template';

export class UsageViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claude-vertex-indicator.usageView';

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly provider: ProviderType,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'refresh') {
        this.refresh();
      }
    });

    this.refresh();
  }

  refresh(): void {
    if (!this.view) {
      return;
    }

    const nonce = getNonce();
    const providerStats = getProviderMonthlyStats(this.provider);

    if (this.provider === 'vertex') {
      const allStats = getMonthlyStats();
      const stats = providerStats ?? allStats;
      this.view.webview.html = getVertexTemplate(stats, nonce);
    } else {
      this.view.webview.html = getAnthropicTemplate(providerStats, nonce);
    }
  }

  reveal(): void {
    if (this.view) {
      this.view.show(true);
      this.refresh();
    }
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
