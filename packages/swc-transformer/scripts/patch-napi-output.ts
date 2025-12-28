/**
 * Post-build patch for napi-rs generated index.js
 *
 * 1. Renames index.js to index.cjs for Node.js ESM compatibility
 *    (napi-rs generates CommonJS code which doesn't work in "type": "module" packages)
 *
 * 2. Applies .slice(0) workaround to dynamic require statements to prevent
 *    tsdown from statically analyzing and incorrectly bundling the native bindings.
 *
 * Transforms:
 * - require('@soda-gql/swc-transformer-xxx')
 *   → require('@soda-gql/swc-transformer-'.slice(0) + 'xxx')
 * - require('./swc-transformer.xxx.node')
 *   → require('./swc-transformer.'.slice(0) + 'xxx.node')
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dirname, "..");
const INDEX_JS_PATH = join(PACKAGE_ROOT, "src/native/index.js");
const INDEX_CJS_PATH = join(PACKAGE_ROOT, "src/native/index.cjs");

const main = () => {
  console.log("[patch-napi-output] Patching src/native/index.js...");

  // Read from .js (napi-rs output) or .cjs (already patched)
  const sourcePath = existsSync(INDEX_JS_PATH) ? INDEX_JS_PATH : INDEX_CJS_PATH;
  let content = readFileSync(sourcePath, "utf-8");
  const originalContent = content;

  // Patch package requires: require('@soda-gql/swc-transformer-xxx')
  // → require('@soda-gql/swc-transformer-'.slice(0) + 'xxx')
  content = content.replace(
    /require\('@soda-gql\/swc-transformer-([^']+)'\)/g,
    "require('@soda-gql/swc-transformer-'.slice(0) + '$1')",
  );

  // Patch local requires: require('./swc-transformer.xxx.node')
  // → require('./swc-transformer.'.slice(0) + 'xxx.node')
  content = content.replace(/require\('\.\/swc-transformer\.([^']+)'\)/g, "require('./swc-transformer.'.slice(0) + '$1')");

  if (content === originalContent && sourcePath === INDEX_CJS_PATH) {
    console.log("[patch-napi-output] No changes needed");
    return;
  }

  // Write to .cjs for Node.js ESM compatibility
  writeFileSync(INDEX_CJS_PATH, content);

  // Remove the original .js file if it exists
  if (existsSync(INDEX_JS_PATH)) {
    unlinkSync(INDEX_JS_PATH);
  }

  console.log("[patch-napi-output] Patched successfully (renamed to index.cjs)");
};

main();
