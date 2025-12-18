#!/usr/bin/env bun
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateFixtures } from "./generate-fixtures";
import { parseDiagnostics, formatMetrics, type BenchmarkResult } from "./process-results";

const BENCH_DIR = path.join(import.meta.dirname, "..");
const GENERATED_DIR = path.join(BENCH_DIR, "generated");

interface RunOptions {
  generate: boolean;
  json: boolean;
  trace: boolean;
  objectTypes: number;
  models: number;
  slices: number;
  operations: number;
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    generate: false,
    json: false,
    trace: false,
    objectTypes: 10,
    models: 10,
    slices: 8,
    operations: 5,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--generate":
        options.generate = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--trace":
        options.trace = true;
        break;
      case "--objectTypes":
      case "--models":
      case "--slices":
      case "--operations": {
        const key = arg.replace("--", "") as keyof RunOptions;
        const value = parseInt(args[++i] ?? "", 10);
        if (!isNaN(value)) {
          (options as Record<string, number | boolean>)[key] = value;
        }
        break;
      }
    }
  }

  return options;
}

async function checkGeneratedExists(): Promise<boolean> {
  try {
    await fs.access(path.join(GENERATED_DIR, "schema.ts"));
    return true;
  } catch {
    return false;
  }
}

async function runTsc(trace: boolean): Promise<{ stdout: string; stderr: string; traceDir?: string }> {
  const tsconfigPath = path.join(BENCH_DIR, "tsconfig.json");
  const args = ["tsc", "--project", tsconfigPath, "--diagnostics"];

  let traceDir: string | undefined;
  if (trace) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    traceDir = path.join(BENCH_DIR, ".traces", `trace-${timestamp}`);
    await fs.mkdir(traceDir, { recursive: true });
    args.push("--generateTrace", traceDir);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn("npx", args, {
      cwd: BENCH_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      // tsc returns non-zero for type errors, but we still get diagnostics
      resolve({ stdout, stderr, traceDir });
    });

    proc.on("error", reject);
  });
}

async function countFixtures(): Promise<{ types: number; models: number; slices: number; operations: number }> {
  const result = { types: 0, models: 0, slices: 0, operations: 0 };

  try {
    const schemaContent = await fs.readFile(path.join(GENERATED_DIR, "schema.ts"), "utf-8");
    const modelsContent = await fs.readFile(path.join(GENERATED_DIR, "models.ts"), "utf-8");
    const slicesContent = await fs.readFile(path.join(GENERATED_DIR, "slices.ts"), "utf-8");
    const operationsContent = await fs.readFile(path.join(GENERATED_DIR, "operations.ts"), "utf-8");

    // Count Entity types in schema
    result.types = (schemaContent.match(/Entity\d+:/g) || []).length / 2; // Divided by 2 because each type appears in Query and as definition

    // Count exports
    result.models = (modelsContent.match(/export const model\d+/g) || []).length;
    result.slices = (slicesContent.match(/export const slice\d+/g) || []).length;
    result.operations = (operationsContent.match(/export const operation\d+/g) || []).length;
  } catch {
    // Ignore errors if files do not exist
  }

  return result;
}

async function main() {
  const options = parseArgs();

  // Check if fixtures exist or need generation
  const fixturesExist = await checkGeneratedExists();

  if (options.generate || !fixturesExist) {
    if (!options.json) {
      console.log("Generating fixtures...\n");
    }
    await generateFixtures({
      objectTypes: options.objectTypes,
      models: options.models,
      slices: options.slices,
      operations: options.operations,
    });
    if (!options.json) {
      console.log("");
    }
  }

  if (!options.json) {
    console.log("Running type check benchmark...\n");
  }

  const { stdout, stderr, traceDir } = await runTsc(options.trace);
  const output = stdout + stderr;

  // Check for compilation errors (not type errors, actual failures)
  if (output.includes("error TS") && !output.includes("Check time:")) {
    console.error("TypeScript compilation failed:");
    console.error(output);
    process.exit(1);
  }

  const metrics = parseDiagnostics(output);
  const fixtures = await countFixtures();

  if (options.json) {
    const result: BenchmarkResult = {
      timestamp: new Date().toISOString(),
      fixtures,
      metrics,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("@soda-gql/core Type Check Benchmark");
    console.log("===================================");
    console.log(`Fixtures: ${fixtures.types} types, ${fixtures.models} models, ${fixtures.slices} slices, ${fixtures.operations} operations\n`);
    console.log(formatMetrics(metrics));

    if (traceDir) {
      console.log(`\nTrace files saved to: ${traceDir}`);
      console.log("Analyze with: npx @typescript/analyze-trace " + traceDir);
    }
  }
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
