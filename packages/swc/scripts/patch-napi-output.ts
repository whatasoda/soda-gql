/**
 * Post-build patch for napi-rs generated index.js
 *
 * Applies .slice(0) workaround to dynamic require statements to prevent
 * tsdown from statically analyzing and incorrectly bundling the native bindings.
 *
 * Transforms:
 * - require('@soda-gql/swc-xxx')
 *   → require('@soda-gql/swc-'.slice(0) + 'xxx')
 * - require('./swc.xxx.node')
 *   → require('./swc.'.slice(0) + 'xxx.node')
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dirname, "..");
const INDEX_JS_PATH = join(PACKAGE_ROOT, "src/native/index.js");

const main = () => {
  console.log("[patch-napi-output] Patching src/native/index.js...");

  let content = readFileSync(INDEX_JS_PATH, "utf-8");
  const originalContent = content;

  // Patch package requires: require('@soda-gql/swc-xxx')
  // → require('@soda-gql/swc-'.slice(0) + 'xxx')
  content = content.replace(/require\('@soda-gql\/swc-([^']+)'\)/g, "require('@soda-gql/swc-'.slice(0) + '$1')");

  // Patch local requires: require('./swc.xxx.node')
  // → require('./swc.'.slice(0) + 'xxx.node')
  content = content.replace(/require\('\.\/swc\.([^']+)'\)/g, "require('./swc.'.slice(0) + '$1')");

  if (content === originalContent) {
    console.log("[patch-napi-output] No changes needed");
    return;
  }

  writeFileSync(INDEX_JS_PATH, content);
  console.log("[patch-napi-output] Patched successfully");
};

main();
