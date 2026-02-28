/**
 * VS Code extension entry point for soda-gql LSP.
 * Launches the LSP server as a language client.
 */

import * as path from "node:path";
import type * as vscode from "vscode";
import { type LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export const activate = (context: vscode.ExtensionContext): void => {
  const vsc = require("vscode") as typeof vscode;

  const startClient = () => {
    // The LSP server is bundled into dist/server.js by build.js
    const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

    // Resolve all workspace folders for NODE_PATH so @swc/core can be found at runtime
    const workspaceFolders = vsc.workspace.workspaceFolders ?? [];
    const workspaceNodePaths = workspaceFolders.map((f) => path.join(f.uri.fsPath, "node_modules"));
    const existingNodePath = process.env.NODE_PATH;
    const allPaths = [...workspaceNodePaths, ...(existingNodePath ? [existingNodePath] : [])];
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (allPaths.length > 0) {
      env.NODE_PATH = allPaths.join(path.delimiter);
    }

    // Server debug options
    const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    // Server options: run the LSP server as a Node module
    const serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc, options: { env } },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: { ...debugOptions, env },
      },
    };

    // Client options: configure which documents the LSP should handle
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "typescriptreact" },
      ],
      synchronize: {
        // Watch .graphql files for schema changes
        fileEvents: [],
      },
    };

    // Create and start the language client
    const { LanguageClient: LC } = require("vscode-languageclient/node");
    const lc = new LC("soda-gql", "soda-gql GraphQL LSP", serverOptions, clientOptions) as LanguageClient;
    client = lc;

    lc.start();
  };

  // Gate LSP client on workspace trust — the server loads native code (@swc/core)
  // from workspace node_modules, so it must not run in untrusted workspaces.
  if (vsc.workspace.isTrusted) {
    startClient();
  } else {
    context.subscriptions.push(vsc.workspace.onDidGrantWorkspaceTrust(() => startClient()));
  }
};

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) {
    return undefined;
  }
  return client.stop();
};
