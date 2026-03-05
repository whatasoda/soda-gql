#!/usr/bin/env node
/**
 * CLI entry point for the soda-gql LSP server.
 * Used by VS Code extension to launch the server.
 */

import { createLspServer } from "./server.js";

process.on("uncaughtException", (error) => {
  console.error("[soda-gql-lsp] Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[soda-gql-lsp] Unhandled rejection:", reason);
});

const server = createLspServer();
server.start();
