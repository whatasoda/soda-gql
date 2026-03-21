#!/usr/bin/env node
/**
 * CLI proxy binary: resolves project-local @soda-gql/lsp and runs its CLI.
 *
 * One-shot CLI — exposes GraphQL intelligence
 * (diagnostics, schema introspection, symbols) as CLI subcommands.
 * @module
 */

import { createRequire } from "node:module";

type RunLspCli = (args: readonly string[]) => Promise<void>;

const cwd = process.cwd();
let localLsp: { runLspCli: RunLspCli };

try {
  const req = createRequire(`${cwd}/package.json`);
  localLsp = req(req.resolve("@soda-gql/lsp"));
} catch (e) {
  const detail = e instanceof Error ? e.message : String(e);
  process.stderr.write(
    `[soda-gql-lsp-cli] Failed to load @soda-gql/lsp from ${cwd}\n` +
      `  ${detail}\n` +
      "  Install it: bun add -d @soda-gql/lsp\n",
  );
  process.exit(1);
}

localLsp.runLspCli(process.argv.slice(2)).catch((err: unknown) => {
  process.stderr.write(`[soda-gql-lsp-cli] ${String(err)}\n`);
  process.exit(1);
});
