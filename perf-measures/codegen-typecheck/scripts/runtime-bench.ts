#!/usr/bin/env bun
// Runtime parse benchmark - measures V8 module loading time and JSON.parse comparison
import { performance } from "perf_hooks";
import * as fs from "fs";
import * as path from "path";

const BENCH_DIR = path.join(import.meta.dirname, "..");
const iterations = 5;

async function benchmarkImport(modulePath: string, label: string) {
  const absolutePath = path.resolve(BENCH_DIR, modulePath);
  const fileSize = fs.statSync(absolutePath).size;

  console.log(`\n${label}`);
  console.log(`  File: ${modulePath}`);
  console.log(`  Size: ${(fileSize / 1024).toFixed(1)} KB`);

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Clear module cache by adding query param
    const importPath = `${absolutePath}?t=${Date.now()}-${i}`;

    const start = performance.now();
    await import(importPath);
    const end = performance.now();
    times.push(end - start);

    // Small delay between iterations
    await new Promise(r => setTimeout(r, 100));
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`  Import times: ${times.map(t => t.toFixed(1) + "ms").join(", ")}`);
  console.log(`  Avg: ${avg.toFixed(1)}ms, Min: ${min.toFixed(1)}ms, Max: ${max.toFixed(1)}ms`);

  return { avg, min, max, times };
}

function benchmarkJsonParse(jsonString: string, label: string) {
  console.log(`\n${label}`);
  console.log(`  JSON size: ${(jsonString.length / 1024).toFixed(1)} KB`);

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    JSON.parse(jsonString);
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`  Parse times: ${times.map(t => t.toFixed(2) + "ms").join(", ")}`);
  console.log(`  Avg: ${avg.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);

  return { avg, min, max, times };
}

async function main() {
  console.log("=== V8 Runtime Benchmark ===");
  console.log(`Iterations: ${iterations}`);

  // Check if generated files exist
  const baselineExists = fs.existsSync(path.join(BENCH_DIR, "baseline/generated/index.ts"));

  if (baselineExists) {
    await benchmarkImport("baseline/generated/index.ts", "Module Import (codegen output)");

    // Create equivalent JSON data for comparison
    // Extract object literals from the generated code and convert to JSON
    const generatedCode = fs.readFileSync(
      path.join(BENCH_DIR, "baseline/generated/index.ts"),
      "utf-8"
    );

    // Create a large JSON object similar in size to test JSON.parse performance
    const sampleData: Record<string, unknown> = {};
    for (let i = 0; i < 500; i++) {
      sampleData[`object_${i}`] = {
        name: `Type${i}`,
        fields: {
          id: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
          name: { kind: "scalar", name: "String", modifier: "!", arguments: {} },
          createdAt: { kind: "scalar", name: "DateTime", modifier: "?", arguments: {} },
          items: { kind: "object", name: "Item", modifier: "![]!", arguments: { limit: { kind: "scalar", name: "Int", modifier: "?" } } },
        },
      };
    }
    const jsonString = JSON.stringify(sampleData);

    benchmarkJsonParse(jsonString, "JSON.parse (equivalent size object)");

    // Also test with actual code size
    const largeJson = JSON.stringify({ data: "x".repeat(generatedCode.length) });
    benchmarkJsonParse(largeJson, "JSON.parse (same byte size as generated code)");

  } else {
    console.log("\nBaseline not found. Run `bun run generate:baseline` first.");
  }
}

main().catch(console.error);
