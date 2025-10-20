#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Simple recursive file finder
function findFiles(dir, pattern = /\.ts$/, exclude = [/node_modules/, /\.typecheck/]) {
  const results = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (exclude.some((ex) => ex.test(fullPath))) {
      continue;
    }

    if (stat.isDirectory()) {
      results.push(...findFiles(fullPath, pattern, exclude));
    } else if (stat.isFile() && pattern.test(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

const files = [
  ...findFiles(join(rootDir, "tests/fixtures")),
  ...findFiles(join(rootDir, "examples")),
];

console.log(`Found ${files.length} files to process`);

let totalChanges = 0;

for (const filePath of files) {
  try {
    let content = readFileSync(filePath, "utf8");
    let changed = false;

    // Pattern 1: { slice } → { query/mutation/subscription }
    // First check if it's using slice.query, slice.mutation, or slice.subscription
    const sliceQueryMatch = content.match(/\(\s*\{\s*slice\s*\}[^)]*\)\s*=>\s*slice\.(query|mutation|subscription)/);
    if (sliceQueryMatch) {
      const operationType = sliceQueryMatch[1];
      // Replace { slice } with { <operationType> }
      content = content.replace(/\(\s*\{\s*slice\s*\}/, `({ ${operationType} }`);
      // Replace slice.<operationType> with <operationType>.slice
      content = content.replace(new RegExp(`\\bslice\\.${operationType}\\b`, "g"), `${operationType}.slice`);
      changed = true;
    }

    // Pattern 1b: Handle cases where { slice } is used but operationType.slice is referenced (edge case)
    // e.g., ({ slice }) => query.slice(...) should become ({ query }) => query.slice(...)
    const sliceButWithOperationType = content.match(/\(\s*\{\s*slice\s*\}[^)]*\)\s*=>\s*\n?\s*(query|mutation|subscription)\.slice/);
    if (sliceButWithOperationType) {
      const operationType = sliceButWithOperationType[1];
      // Replace { slice } with { <operationType> }
      content = content.replace(/\(\s*\{\s*slice\s*\}/, `({ ${operationType} }`);
      changed = true;
    }

    // Pattern 2: { operation } → { query/mutation/subscription }
    // First check if it's using operation.query, operation.mutation, or operation.subscription
    const operationMatch = content.match(/\(\s*\{\s*operation\s*\}[^)]*\)\s*=>\s*operation\.(query|mutation|subscription)/);
    if (operationMatch) {
      const operationType = operationMatch[1];
      // Replace { operation } with { <operationType> }
      content = content.replace(/\(\s*\{\s*operation\s*\}/, `({ ${operationType} }`);
      // Replace operation.<operationType> with <operationType>.composed
      content = content.replace(
        new RegExp(`\\boperation\\.${operationType}\\b`, "g"),
        `${operationType}.composed`,
      );
      changed = true;
    }

    // Pattern 3: slice.build → slice.embed (reverted)
    if (content.includes(".build(")) {
      content = content.replace(/\.build\(/g, ".embed(");
      changed = true;
    }

    if (changed) {
      writeFileSync(filePath, content, "utf8");
      totalChanges++;
      console.log(`✓ Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`✗ Failed to process ${filePath}:`, error.message);
  }
}

console.log(`\nTotal files updated: ${totalChanges}`);
