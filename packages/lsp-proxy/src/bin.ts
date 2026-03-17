#!/usr/bin/env node
/**
 * Thin proxy binary for Claude Code LSP plugin integration.
 *
 * Resolves the project-local `@soda-gql/lsp` package at runtime to ensure
 * version consistency between the LSP and the project's soda-gql dependencies.
 * Similar to how `typescript-language-server` delegates to project-local TypeScript.
 *
 * The proxy handles only the LSP connection and `initialize` handshake.
 * All other handlers are registered by the project-local `createLspServer`.
 * @module
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { LspServerOptions } from "@soda-gql/lsp";
import {
  createConnection,
  type InitializeParams,
  type InitializeResult,
  ProposedFeatures,
} from "vscode-languageserver/node";

type CreateLspServer = (options: Required<LspServerOptions>) => {
  start: () => void;
  initializeResult?: InitializeResult;
};

const connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params) => {
  const roots = resolveWorkspaceRoots(params);
  if (roots.length === 0) {
    connection.window.showErrorMessage("soda-gql LSP proxy: no workspace root provided");
    return { capabilities: {} };
  }

  // Try each workspace root to find project-local @soda-gql/lsp
  let localLsp: { createLspServer: CreateLspServer } | undefined;
  for (const root of roots) {
    try {
      const req = createRequire(root + "/package.json");
      localLsp = req(req.resolve("@soda-gql/lsp"));
      break;
    } catch {
      continue;
    }
  }

  if (!localLsp) {
    connection.window.showErrorMessage(
      "soda-gql LSP proxy: @soda-gql/lsp not found in any workspace root. Install it as a project dependency.",
    );
    return { capabilities: {} };
  }

  // Delegate to project-local createLspServer with the intercepted initializeParams
  const server = localLsp.createLspServer({ connection, initializeParams: params });
  return server.initializeResult ?? { capabilities: {} };
});

connection.listen();

/**
 * Extract workspace root paths from LSP initialize params.
 * Inlined from server.ts to avoid runtime dependency on @soda-gql/lsp.
 */
function resolveWorkspaceRoots(params: InitializeParams): string[] {
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    return params.workspaceFolders.map((f) => (f.uri.startsWith("file://") ? fileURLToPath(f.uri) : f.uri));
  }
  const rootUri = params.rootUri ?? params.rootPath;
  if (rootUri) {
    return [rootUri.startsWith("file://") ? fileURLToPath(rootUri) : rootUri];
  }
  return [];
}
