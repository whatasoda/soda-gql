/**
 * VS Code extension entry point for soda-gql LSP.
 * Launches the LSP server as a language client.
 */

import * as path from "node:path";
import * as vscode from "vscode";
import { type LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export const activate = (context: vscode.ExtensionContext): void => {
  outputChannel = vscode.window.createOutputChannel("soda-gql GraphQL LSP");
  context.subscriptions.push(outputChannel);

  const startClient = () => {
    if (client) return;

    // The LSP server is bundled into dist/server.js by build.mjs
    const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

    // Server debug options
    const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    // Server options: run the LSP server as a Node module
    // No NODE_PATH manipulation needed — the LSP server resolves @swc/core
    // from each soda-gql.config.ts location via createRequire(configPath).
    const serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: debugOptions,
      },
    };

    // Client options: configure which documents the LSP should handle
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ language: "typescript" }, { language: "typescriptreact" }],
      synchronize: {
        fileEvents: [],
      },
      outputChannel,
    };

    // Create and start the language client
    const { LanguageClient: LC } = require("vscode-languageclient/node");
    const lc = new LC("soda-gql", "soda-gql GraphQL LSP", serverOptions, clientOptions) as LanguageClient;
    client = lc;

    lc.start().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel?.appendLine(`[error] LSP server failed to start: ${message}`);
      if (error instanceof Error && error.stack) {
        outputChannel?.appendLine(error.stack);
      }
      client = undefined;
    });
  };

  // Gate LSP client on workspace trust — the server loads native code (@swc/core)
  // from workspace node_modules, so it must not run in untrusted workspaces.
  if (vscode.workspace.isTrusted) {
    startClient();
  } else {
    vscode.window.showInformationMessage(
      "soda-gql: Workspace trust is required for LSP features. Syntax highlighting is still available.",
    );
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => startClient()));
  }
};

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) {
    return undefined;
  }
  return client.stop();
};
