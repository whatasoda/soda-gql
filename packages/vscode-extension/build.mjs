#!/usr/bin/env node

/**
 * Build script for VS Code extension.
 * Bundles the extension client and LSP server into dist/.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildExtension() {
  await build({
    entryPoints: [join(__dirname, "src", "extension.ts")],
    bundle: true,
    outfile: join(__dirname, "dist", "extension.js"),
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: true,
    minify: false,
    conditions: ["@soda-gql"],
  });
  console.log("✓ Extension client built successfully");
}

async function buildServer() {
  await build({
    entryPoints: [join(__dirname, "..", "lsp", "src", "bin.ts")],
    bundle: true,
    outfile: join(__dirname, "dist", "server.js"),
    external: ["@swc/core"],
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: true,
    minify: false,
    conditions: ["@soda-gql"],
  });
  console.log("✓ LSP server built successfully");
}

Promise.all([buildExtension(), buildServer()]).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
