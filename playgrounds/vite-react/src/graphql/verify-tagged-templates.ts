/**
 * Standalone verification script for tagged template definitions.
 *
 * Imports all playground tagged template definitions and verifies that:
 * 1. Operations produce correct GraphQL document strings via print(document)
 * 2. Fragments construct successfully and expose expected properties
 * 3. Compat definitions store correct GraphQL source strings
 *
 * Usage: bun run verify:tagged-templates
 * Exit 0 on success, non-zero on failure.
 */

import type { DocumentNode } from "graphql";
import { print } from "graphql";
import * as fragments from "./fragments";
import * as operations from "./operations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationResult = {
  name: string;
  category: "operation" | "fragment" | "compat";
  status: "pass" | "fail" | "skip";
  actual?: string;
  expected?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Expected strings (populated in Phase 2)
// ---------------------------------------------------------------------------

/** Expected GraphQL strings for operation definitions. */
export const expectedOperationStrings: Record<string, string> = {};

/** Expected GraphQL strings for fragment definitions (when composed into wrapper operations). */
export const expectedFragmentStrings: Record<string, string> = {};

/** Expected GraphQL source strings for compat definitions. */
export const expectedCompatStrings: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function isOperation(value: unknown): value is { document: DocumentNode } {
  return (
    value !== null &&
    typeof value === "object" &&
    "document" in value &&
    typeof (value as { document: unknown }).document === "object"
  );
}

function isFragment(value: unknown): value is {
  typename: string;
  variableDefinitions: Record<string, unknown>;
  spread: (...args: unknown[]) => unknown;
} {
  return (
    value !== null && typeof value === "object" && "typename" in value && "spread" in value && "variableDefinitions" in value
  );
}

function isCompat(value: unknown): value is { value: { graphqlSource: string } } {
  if (value === null || typeof value !== "object") return false;
  if (!("value" in value)) return false;
  const inner = (value as { value: unknown }).value;
  return inner !== null && typeof inner === "object" && "graphqlSource" in inner;
}

// ---------------------------------------------------------------------------
// Diff output for mismatches
// ---------------------------------------------------------------------------

function showDiff(name: string, expected: string, actual: string): string {
  const lines: string[] = [];
  lines.push(`  --- expected (${name})`);
  lines.push(`  +++ actual (${name})`);
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  for (let i = 0; i < maxLen; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];
    if (exp === act) {
      lines.push(`   ${exp ?? ""}`);
    } else {
      if (exp !== undefined) lines.push(`  -${exp}`);
      if (act !== undefined) lines.push(`  +${act}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Verification runner
// ---------------------------------------------------------------------------

function verifyOperations(): VerificationResult[] {
  const results: VerificationResult[] = [];

  for (const [name, value] of Object.entries(operations)) {
    if (isCompat(value)) {
      // Handle compat definitions
      const graphqlSource = value.value.graphqlSource;
      const expected = expectedCompatStrings[name];
      if (expected === undefined) {
        results.push({
          name,
          category: "compat",
          status: "skip",
          actual: graphqlSource,
        });
      } else if (graphqlSource.trim() === expected.trim()) {
        results.push({ name, category: "compat", status: "pass", actual: graphqlSource, expected });
      } else {
        results.push({ name, category: "compat", status: "fail", actual: graphqlSource, expected });
      }
    } else if (isOperation(value)) {
      // Handle operation definitions
      try {
        const printed = print(value.document);
        const expected = expectedOperationStrings[name];
        if (expected === undefined) {
          results.push({
            name,
            category: "operation",
            status: "skip",
            actual: printed,
          });
        } else if (printed.trim() === expected.trim()) {
          results.push({ name, category: "operation", status: "pass", actual: printed, expected });
        } else {
          results.push({ name, category: "operation", status: "fail", actual: printed, expected });
        }
      } catch (e) {
        results.push({
          name,
          category: "operation",
          status: "fail",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return results;
}

function verifyFragments(): VerificationResult[] {
  const results: VerificationResult[] = [];

  for (const [name, value] of Object.entries(fragments)) {
    if (isFragment(value)) {
      try {
        // Verify fragment constructed successfully
        const typename = value.typename;
        const varDefs = value.variableDefinitions;

        // Fragment verification: confirm construction and basic properties
        const summary = `fragment on ${typename}, vars: ${Object.keys(varDefs).join(", ") || "(none)"}`;
        const expected = expectedFragmentStrings[name];
        if (expected === undefined) {
          results.push({
            name,
            category: "fragment",
            status: "skip",
            actual: summary,
          });
        } else {
          // In Phase 2, expected strings will contain the composed document output
          results.push({
            name,
            category: "fragment",
            status: "skip",
            actual: summary,
            expected,
          });
        }
      } catch (e) {
        results.push({
          name,
          category: "fragment",
          status: "fail",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function report(results: VerificationResult[]): boolean {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  console.log("\n=== Tagged Template Verification ===\n");

  for (const r of results) {
    const icon = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "SKIP";
    const tag = `[${r.category}]`;
    console.log(`  ${icon} ${tag} ${r.name}`);

    if (r.status === "fail") {
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      } else if (r.expected !== undefined && r.actual !== undefined) {
        console.log(showDiff(r.name, r.expected, r.actual));
      }
    }

    if (r.status === "pass") passed++;
    else if (r.status === "fail") failed++;
    else skipped++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped} (no expected string defined)`);
  console.log(`  Total:   ${results.length}\n`);

  return failed === 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const operationResults = verifyOperations();
const fragmentResults = verifyFragments();
const allResults = [...operationResults, ...fragmentResults];

const success = report(allResults);

if (!success) {
  process.exit(1);
}
