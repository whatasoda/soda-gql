#!/usr/bin/env node
/**
 * MCP server binary entry point for soda-gql.
 * @module
 */

import { startMcpServer } from "./mcp-server";

startMcpServer().catch((err: unknown) => {
  process.stderr.write(`[soda-gql-mcp] ${String(err)}\n`);
  process.exit(1);
});
