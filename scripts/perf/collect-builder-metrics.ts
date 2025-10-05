#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { PerformanceObserver, performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { builderCommand } from "../../packages/cli/src/commands/builder";
import { codegenCommand } from "../../packages/cli/src/commands/codegen";

type FixtureType = "small-app" | "medium-app" | "large-app";

interface MetricsResult {
  fixture: FixtureType;
  timestamp: string;
  wallTime: number;
  cpuTime: number;
  peakMemoryMB: number;
  gcCount: number;
  gcDurationMs: number;
  iterations: number;
  averageWallTime?: number;
}

const FIXTURES: Record<
  FixtureType,
  { schema: string; entry: string; out: string; runtimeAdapter: string; codegenOut: string; dir: string }
> = {
  "small-app": {
    schema: "./benchmarks/runtime-builder/small-app/schema.graphql",
    entry: "./benchmarks/runtime-builder/small-app/src/**/*.ts",
    out: "./.cache/soda-gql/benchmarks/small-app-runtime.json",
    runtimeAdapter: "./benchmarks/runtime-builder/small-app/runtime-adapter.ts",
    codegenOut: "./benchmarks/runtime-builder/small-app/graphql-system/index.ts",
    dir: "./benchmarks/runtime-builder/small-app",
  },
  "medium-app": {
    schema: "./benchmarks/runtime-builder/medium-app/schema.graphql",
    entry: "./benchmarks/runtime-builder/medium-app/src/**/*.ts",
    out: "./.cache/soda-gql/benchmarks/medium-app-runtime.json",
    runtimeAdapter: "./benchmarks/runtime-builder/medium-app/runtime-adapter.ts",
    codegenOut: "./benchmarks/runtime-builder/medium-app/graphql-system/index.ts",
    dir: "./benchmarks/runtime-builder/medium-app",
  },
  "large-app": {
    schema: "./benchmarks/runtime-builder/large-app/schema.graphql",
    entry: "./benchmarks/runtime-builder/large-app/src/**/*.ts",
    out: "./.cache/soda-gql/benchmarks/large-app-runtime.json",
    runtimeAdapter: "./benchmarks/runtime-builder/large-app/runtime-adapter.ts",
    codegenOut: "./benchmarks/runtime-builder/large-app/graphql-system/index.ts",
    dir: "./benchmarks/runtime-builder/large-app",
  },
};

const parseCliArgs = (): { fixture: FixtureType; iterations: number } => {
  const { values } = parseArgs({
    options: {
      fixture: { type: "string" },
      iterations: { type: "string", default: "1" },
    },
  });

  const fixture = values.fixture as FixtureType | undefined;
  if (!fixture || !FIXTURES[fixture]) {
    console.error(`Error: Invalid or missing --fixture. Valid options: ${Object.keys(FIXTURES).join(", ")}`);
    process.exit(1);
  }

  const iterations = Number.parseInt(values.iterations as string, 10);
  if (Number.isNaN(iterations) || iterations < 1) {
    console.error("Error: --iterations must be a positive integer");
    process.exit(1);
  }

  return { fixture, iterations };
};

const collectMetrics = async (fixture: FixtureType): Promise<Omit<MetricsResult, "iterations" | "averageWallTime">> => {
  const fixtureConfig = FIXTURES[fixture];
  let peakMemory = 0;
  let gcCount = 0;
  let gcDuration = 0;

  const obs = new PerformanceObserver((items) => {
    for (const entry of items.getEntries()) {
      if (entry.entryType === "gc") {
        gcCount++;
        gcDuration += entry.duration;
      }
    }
  });
  obs.observe({ entryTypes: ["gc"] });

  const startTime = performance.now();
  const startCpuUsage = process.cpuUsage();
  const memInterval = setInterval(() => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > peakMemory) {
      peakMemory = usage.heapUsed;
    }
  }, 10);

  try {
    // Change cwd to fixture directory for config discovery
    const originalCwd = process.cwd();
    process.chdir(fixtureConfig.dir);

    try {
      // Run builder command
      const exitCode = await builderCommand([
        "--mode",
        "runtime",
        "--entry",
        "./src/**/*.ts",
        "--out",
        "../../.cache/soda-gql/benchmarks/" + fixture + "-runtime.json",
      ]);

      if (exitCode !== 0) {
        throw new Error(`Builder command failed with exit code ${exitCode}`);
      }
    } finally {
      process.chdir(originalCwd);
    }
  } finally {
    clearInterval(memInterval);
    obs.disconnect();
  }

  const endTime = performance.now();
  const endCpuUsage = process.cpuUsage(startCpuUsage);
  const cpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000; // Convert to ms

  return {
    fixture,
    timestamp: new Date().toISOString(),
    wallTime: endTime - startTime,
    cpuTime,
    peakMemoryMB: peakMemory / (1024 * 1024),
    gcCount,
    gcDurationMs: gcDuration,
  };
};

const ensureCodegenOutput = async (fixture: FixtureType): Promise<void> => {
  const fixtureConfig = FIXTURES[fixture];

  console.log(`Generating GraphQL runtime for ${fixture}...`);
  const exitCode = await codegenCommand([
    "--schema:default",
    fixtureConfig.schema,
    "--out",
    fixtureConfig.codegenOut,
    "--runtime-adapter:default",
    fixtureConfig.runtimeAdapter,
    "--scalar:default",
    fixtureConfig.runtimeAdapter,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Codegen failed for ${fixture} with exit code ${exitCode}`);
  }
};

const runBenchmark = async (fixture: FixtureType, iterations: number): Promise<MetricsResult> => {
  const results: Array<Omit<MetricsResult, "iterations" | "averageWallTime">> = [];

  // Ensure codegen output exists before running benchmark (outside timing)
  await ensureCodegenOutput(fixture);

  console.log(`Running ${iterations} iteration(s) for fixture: ${fixture}...`);

  for (let i = 0; i < iterations; i++) {
    console.log(`  Iteration ${i + 1}/${iterations}...`);
    const metrics = await collectMetrics(fixture);
    results.push(metrics);
  }

  const lastResult = results[results.length - 1];
  const averageWallTime = results.reduce((sum, r) => sum + r.wallTime, 0) / results.length;

  return {
    ...lastResult,
    iterations,
    averageWallTime,
  };
};

const saveMetrics = async (metrics: MetricsResult): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = join(".cache", "perf", timestamp, metrics.fixture);
  const outputPath = join(outputDir, "metrics.json");

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(metrics, null, 2));

  return outputPath;
};

const main = async (): Promise<void> => {
  const { fixture, iterations } = parseCliArgs();

  console.log("=== Builder Performance Metrics Collection ===");
  console.log(`Fixture: ${fixture}`);
  console.log(`Iterations: ${iterations}`);
  console.log("");

  const metrics = await runBenchmark(fixture, iterations);
  const outputPath = await saveMetrics(metrics);

  console.log("\n=== Results ===");
  console.log(`Wall time: ${metrics.wallTime.toFixed(2)}ms`);
  if (iterations > 1) {
    console.log(`Average wall time: ${metrics.averageWallTime?.toFixed(2)}ms`);
  }
  console.log(`CPU time: ${metrics.cpuTime.toFixed(2)}ms`);
  console.log(`Peak memory: ${metrics.peakMemoryMB.toFixed(2)}MB`);
  console.log(`GC count: ${metrics.gcCount}`);
  console.log(`GC duration: ${metrics.gcDurationMs.toFixed(2)}ms`);
  console.log(`\nMetrics saved to: ${outputPath}`);
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
