/**
 * VS Code extension entry point for soda-gql LSP.
 * Launches the LSP server as a language client.
 */

import * as path from "node:path";
import type * as vscode from "vscode";
import { type LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export const activate = (context: vscode.ExtensionContext): void => {
  // The LSP server is implemented in the @soda-gql/lsp package
  // We use the bin entry point (soda-gql-lsp) to launch the server
  const serverModule = context.asAbsolutePath(path.join("node_modules", "@soda-gql", "lsp", "dist", "bin.mjs"));

  // Server debug options
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // Server options: run the LSP server as a Node module
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

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) {
    return undefined;
  }
  return client.stop();
};
