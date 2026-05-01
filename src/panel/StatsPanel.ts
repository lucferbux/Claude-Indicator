import * as vscode from 'vscode';
import { getMonthlyStats } from '../statsReader';
import { getTemplate } from './template';
import { ProviderType } from '../types';

export class StatsPanel {
  private static instance: StatsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly provider: ProviderType;

  private constructor(extensionUri: vscode.Uri, provider: ProviderType) {
    this.provider = provider;
    this.panel = vscode.window.createWebviewPanel(
      'claudeUsageDashboard',
      'Claude Code Usage',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      },
    );

    this.panel.iconPath = new vscode.ThemeIcon('dashboard');

    this.panel.onDidDispose(() => {
      StatsPanel.instance = undefined;
    });

    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'refresh') {
        this.update();
      }
    });

    this.update();
  }

  static createOrShow(extensionUri: vscode.Uri, provider: ProviderType): void {
    if (StatsPanel.instance) {
      StatsPanel.instance.panel.reveal(vscode.ViewColumn.One);
      StatsPanel.instance.update();
      return;
    }
    StatsPanel.instance = new StatsPanel(extensionUri, provider);
  }

  private update(): void {
    const stats = getMonthlyStats();
    const budget = vscode.workspace.getConfiguration('claudeVertexIndicator').get<number>('monthlyBudget', 20);
    const nonce = getNonce();
    this.panel.webview.html = getTemplate(stats, this.provider, budget, nonce);
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
