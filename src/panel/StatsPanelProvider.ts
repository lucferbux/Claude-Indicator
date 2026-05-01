import * as vscode from 'vscode';
import { getMonthlyStats } from '../statsReader';
import { getCompactTemplate } from './template';
import { ProviderType } from '../types';

export class StatsPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly provider: ProviderType,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'refresh') {
        this.update();
      }
    });

    this.update();
  }

  private update(): void {
    if (!this.view) {
      return;
    }
    const stats = getMonthlyStats();
    const budget = vscode.workspace
      .getConfiguration('claudeVertexIndicator')
      .get<number>('monthlyBudget', 20);
    const nonce = getNonce();
    this.view.webview.html = getCompactTemplate(stats, this.provider, budget, nonce);
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
