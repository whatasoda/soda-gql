#!/usr/bin/env node
/**
 * MCP proxy binary: resolves project-local @soda-gql/lsp and starts its MCP server.
 * @module
 */

import { createRequire } from "node:module";

const cwd = process.cwd();
let localLsp: { startMcpServer: () => Promise<void> };

try {
  const req = createRequire(cwd + "/package.json");
  localLsp = req(req.resolve("@soda-gql/lsp"));
} catch {
  process.stderr.write(
    `[soda-gql-mcp-proxy] @soda-gql/lsp not found in ${cwd}\n` +
      "Install it: bun add -d @soda-gql/lsp\n",
  );
  process.exit(1);
}

localLsp.startMcpServer().catch((err: unknown) => {
  process.stderr.write(`[soda-gql-mcp-proxy] ${String(err)}\n`);
  process.exit(1);
});
