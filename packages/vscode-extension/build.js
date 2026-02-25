#!/usr/bin/env node

/**
 * Build script for VS Code extension.
 * Bundles the extension client, LSP server, and TS plugin into dist/.
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
  });
  console.log("✓ LSP server built successfully");
}

async function buildTsPlugin() {
  await build({
    entryPoints: [join(__dirname, "..", "ts-plugin", "src", "index.ts")],
    bundle: true,
    outfile: join(__dirname, "dist", "ts-plugin.cjs"),
    external: ["@swc/core"],
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: true,
    minify: false,
    // D-2: import.meta.url is undefined in CJS; provide __filename-based shim
    banner: { js: 'var import_meta_url = require("url").pathToFileURL(__filename).href;' },
    define: { "import.meta.url": "import_meta_url" },
    // D-1: tsserver expects module.exports = init (function), not module.exports.default
    footer: { js: "module.exports = module.exports.default || module.exports;" },
  });
  console.log("✓ TS plugin built successfully");
}

Promise.all([buildExtension(), buildServer(), buildTsPlugin()]).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
