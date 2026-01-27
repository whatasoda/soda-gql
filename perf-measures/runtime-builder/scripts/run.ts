#!/usr/bin/env bun
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfigFrom } from "@soda-gql/config";
import { createBuilderSession } from "@soda-gql/builder";
import { generateFixtures, FIXTURE_PRESETS, type FixtureConfig } from "./generate-fixtures";
import {
  computeStatistics,
  createEmptyBuilderMetrics,
  createEmptyMemoryMetrics,
  formatBenchmarkResult,
  createComparisonResult,
  formatComparisonResult,
  type AnalyzerType,
  type AnalyzerComparisonResult,
  type BenchmarkResult,
  type BuilderMetrics,
  type IterationResult,
  type MemoryBreakdown,
  type MemoryMetrics,
  type PhaseMemoryMetrics,
  type PhaseMemorySnapshot,
} from "./process-results";

const PERF_DIR = path.join(import.meta.dirname, "..");
const FIXTURES_DIR = path.join(PERF_DIR, "fixtures");
const PROJECT_ROOT = path.resolve(PERF_DIR, "../..");

interface RunOptions {
  fixture: string;
  totalFiles?: number;
  gqlRatio?: number;
  objectTypes?: number;
  models?: number;
  slices?: number;
  operations?: number;
  iterations: number;
  json: boolean;
  generate: boolean;
  warm: boolean;
  gc: boolean;
  analyzer: AnalyzerType | "both";
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    fixture: "small",
    iterations: 1,
    json: false,
    generate: false,
    warm: false,
    gc: false,
    analyzer: "ts",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--fixture":
        options.fixture = args[++i] ?? "small";
        break;
      case "--total-files":
        options.totalFiles = parseInt(args[++i] ?? "", 10);
        break;
      case "--gql-ratio":
        options.gqlRatio = parseFloat(args[++i] ?? "");
        break;
      case "--object-types":
        options.objectTypes = parseInt(args[++i] ?? "", 10);
        break;
      case "--models":
        options.models = parseInt(args[++i] ?? "", 10);
        break;
      case "--slices":
        options.slices = parseInt(args[++i] ?? "", 10);
        break;
      case "--operations":
        options.operations = parseInt(args[++i] ?? "", 10);
        break;
      case "--iterations":
        options.iterations = parseInt(args[++i] ?? "1", 10);
        break;
      case "--json":
        options.json = true;
        break;
      case "--generate":
        options.generate = true;
        break;
      case "--warm":
        options.warm = true;
        break;
      case "--gc":
        options.gc = true;
        break;
      case "--analyzer": {
        const val = args[++i];
        if (val === "ts" || val === "swc" || val === "both") {
          options.analyzer = val;
        } else {
          console.error("Invalid analyzer value. Use: ts, swc, or both");
          process.exit(1);
        }
        break;
      }
    }
  }

  return options;
}

function buildFixtureConfig(options: RunOptions): FixtureConfig {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const preset: FixtureConfig = FIXTURE_PRESETS[options.fixture] ?? FIXTURE_PRESETS.small!;
  return {
    name: options.fixture,
    totalFiles: options.totalFiles ?? preset.totalFiles,
    gqlRatio: options.gqlRatio ?? preset.gqlRatio,
    objectTypes: options.objectTypes ?? preset.objectTypes,
    models: options.models ?? preset.models,
    slices: options.slices ?? preset.slices,
    operations: options.operations ?? preset.operations,
  };
}

async function fixtureExists(fixtureName: string): Promise<boolean> {
  try {
    await fs.access(path.join(FIXTURES_DIR, fixtureName, "soda-gql.config.ts"));
    return true;
  } catch {
    return false;
  }
}

async function graphqlSystemExists(fixtureName: string): Promise<boolean> {
  try {
    await fs.access(path.join(FIXTURES_DIR, fixtureName, "graphql-system", "index.ts"));
    return true;
  } catch {
    return false;
  }
}

async function runCodegen(fixtureDir: string): Promise<void> {
  const configPath = path.join(fixtureDir, "soda-gql.config.ts");
  const cliPath = path.join(PROJECT_ROOT, "packages/cli/src/index.ts");

  return new Promise((resolve, reject) => {
    const proc = spawn("bun", ["--conditions=@soda-gql", cliPath, "codegen", "--config", configPath], {
      cwd: fixtureDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, "--conditions=@soda-gql"].filter(Boolean).join(" "),
      },
    });

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Codegen failed with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Collect memory metrics during build.
 */
class MemoryCollector {
  private startMemory: NodeJS.MemoryUsage | null = null;
  private peakMemory: NodeJS.MemoryUsage | null = null;
  private intervalId: Timer | null = null;

  start(): void {
    this.startMemory = process.memoryUsage();
    this.peakMemory = { ...this.startMemory };

    this.intervalId = setInterval(() => {
      const current = process.memoryUsage();
      if (this.peakMemory) {
        this.peakMemory.heapUsed = Math.max(this.peakMemory.heapUsed, current.heapUsed);
        this.peakMemory.heapTotal = Math.max(this.peakMemory.heapTotal, current.heapTotal);
        this.peakMemory.rss = Math.max(this.peakMemory.rss, current.rss);
        this.peakMemory.external = Math.max(this.peakMemory.external, current.external);
      }
    }, 10);
  }

  stop(): MemoryMetrics {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const endMemory = process.memoryUsage();
    const start = this.startMemory ?? endMemory;
    const peak = this.peakMemory ?? endMemory;

    return {
      heapUsed: {
        start: start.heapUsed,
        peak: peak.heapUsed,
        end: endMemory.heapUsed,
        delta: endMemory.heapUsed - start.heapUsed,
      },
      heapTotal: {
        start: start.heapTotal,
        peak: peak.heapTotal,
        end: endMemory.heapTotal,
        delta: endMemory.heapTotal - start.heapTotal,
      },
      rss: {
        start: start.rss,
        peak: peak.rss,
        end: endMemory.rss,
        delta: endMemory.rss - start.rss,
      },
      external: {
        start: start.external,
        peak: peak.external,
        end: endMemory.external,
        delta: endMemory.external - start.external,
      },
    };
  }
}

/**
 * Estimate memory size of an object using JSON serialization.
 * This is an approximation but provides consistent relative measurements.
 */
function estimateObjectSize(obj: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(obj), "utf8");
  } catch {
    return 0;
  }
}

/**
 * Collect detailed memory breakdown from session state.
 * Must be called while session data structures are still in memory.
 */
function collectMemoryBreakdown(
  snapshots: Map<string, unknown>,
  intermediateModules: Map<string, unknown>,
  analyses: Map<string, unknown>,
): MemoryBreakdown {
  let snapshotsBytes = 0;
  let intermediateModulesBytes = 0;
  let analysesBytes = 0;

  for (const snapshot of snapshots.values()) {
    snapshotsBytes += estimateObjectSize(snapshot);
  }

  for (const module of intermediateModules.values()) {
    intermediateModulesBytes += estimateObjectSize(module);
  }

  for (const analysis of analyses.values()) {
    analysesBytes += estimateObjectSize(analysis);
  }

  const totalEstimated = snapshotsBytes + intermediateModulesBytes + analysesBytes;
  const currentHeap = process.memoryUsage().heapUsed;
  const overheadBytes = Math.max(0, currentHeap - totalEstimated);

  return {
    snapshotsBytes,
    snapshotsCount: snapshots.size,
    intermediateModulesBytes,
    intermediateModulesCount: intermediateModules.size,
    analysesBytes,
    analysesCount: analyses.size,
    overheadBytes,
  };
}

/**
 * Run a single build and collect metrics.
 */
async function measureBuild(
  fixtureDir: string,
  options: { force: boolean; gc: boolean; analyzer: AnalyzerType }
): Promise<BuilderMetrics> {
  // Force GC if requested (Bun supports global.gc when run with --smol or similar)
  if (options.gc && typeof global.gc === "function") {
    global.gc();
  }

  // Load config
  const configResult = loadConfigFrom(fixtureDir);
  if (configResult.isErr()) {
    throw new Error(`Failed to load config: ${configResult.error.code}`);
  }

  // Override analyzer from loaded config
  const config = { ...configResult.value, analyzer: options.analyzer };

  // Create session
  const session = createBuilderSession({
    evaluatorId: `perf-${Date.now()}`,
    config,
  });

  // Start measurements
  const memoryCollector = new MemoryCollector();
  memoryCollector.start();

  const startTime = performance.now();
  const startCpu = process.cpuUsage();

  // Run build
  const buildResult = session.build({ force: options.force });

  // Stop measurements
  const endTime = performance.now();
  const endCpu = process.cpuUsage(startCpu);
  const memory = memoryCollector.stop();

  // Dispose session
  session.dispose();

  if (buildResult.isErr()) {
    throw new Error(`Build failed: ${buildResult.error.code}`);
  }

  const artifact = buildResult.value;

  // Count files scanned (this is approximate based on entry paths)
  const entryGlobs = config.include;
  let totalFilesScanned = 0;
  for (const glob of entryGlobs) {
    const files = await Array.fromAsync(new Bun.Glob(glob).scan({ cwd: fixtureDir }));
    totalFilesScanned += files.length;
  }

  return {
    wallTimeMs: endTime - startTime,
    cpuTimeMs: (endCpu.user + endCpu.system) / 1000,
    builderDurationMs: artifact.report.durationMs,
    memory,
    discoveryHits: artifact.report.stats.hits,
    discoveryMisses: artifact.report.stats.misses,
    discoverySkips: artifact.report.stats.skips,
    totalFilesScanned,
    gqlFilesFound: artifact.report.stats.hits + artifact.report.stats.misses,
    elementCount: Object.keys(artifact.elements).length,
  };
}

/**
 * Run benchmark for a single analyzer.
 */
async function runSingleAnalyzer(
  fixtureDir: string,
  fixtureConfig: FixtureConfig,
  options: RunOptions,
  analyzer: AnalyzerType,
): Promise<BenchmarkResult> {
  if (!options.json) {
    console.log(`Running builder benchmark with ${analyzer.toUpperCase()} analyzer (${options.iterations} iteration${options.iterations > 1 ? "s" : ""})...\n`);
  }

  // Run cold builds
  const coldIterations: IterationResult[] = [];

  for (let i = 0; i < options.iterations; i++) {
    if (!options.json) {
      process.stdout.write(`  Cold build ${i + 1}/${options.iterations}...`);
    }

    const metrics = await measureBuild(fixtureDir, { force: true, gc: options.gc, analyzer });
    coldIterations.push({ iteration: i + 1, metrics });

    if (!options.json) {
      console.log(` ${metrics.wallTimeMs.toFixed(1)}ms`);
    }
  }

  // Compute statistics
  const coldStats = computeStatistics(coldIterations);

  // Build result
  return {
    fixture: fixtureConfig.name,
    analyzer,
    timestamp: new Date().toISOString(),
    scale: {
      totalFiles: fixtureConfig.totalFiles,
      gqlRatio: fixtureConfig.gqlRatio,
      objectTypes: fixtureConfig.objectTypes,
      models: fixtureConfig.models,
      slices: fixtureConfig.slices,
      operations: fixtureConfig.operations,
    },
    iterations: coldIterations,
    average: coldStats.average,
    min: coldStats.min,
    max: coldStats.max,
  };
}

/**
 * Run comparison benchmark for both analyzers.
 */
async function runComparisonMode(
  fixtureDir: string,
  fixtureConfig: FixtureConfig,
  options: RunOptions,
): Promise<void> {
  if (!options.json) {
    console.log(`Running comparison benchmark (${options.iterations} iteration(s))...\n`);
  }

  // TS analyzer
  if (!options.json) {
    console.log("=== TypeScript Analyzer ===");
  }
  const tsResult = await runSingleAnalyzer(fixtureDir, fixtureConfig, options, "ts");

  // SWC analyzer
  if (!options.json) {
    console.log("\n=== SWC Analyzer ===");
  }
  const swcResult = await runSingleAnalyzer(fixtureDir, fixtureConfig, options, "swc");

  // Create comparison result
  const comparison = createComparisonResult(tsResult, swcResult);

  // Output results
  if (options.json) {
    console.log(JSON.stringify(comparison, null, 2));
  } else {
    console.log("\n" + formatComparisonResult(comparison));
  }

  // Save results to cache
  const cacheDir = path.join(PROJECT_ROOT, ".cache", "perf", new Date().toISOString().replace(/[:.]/g, "-"), fixtureConfig.name);
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, "comparison.json"), JSON.stringify(comparison, null, 2));

  if (!options.json) {
    console.log(`\nResults saved to: ${cacheDir}/comparison.json`);
  }
}

async function main() {
  const options = parseArgs();
  const fixtureConfig = buildFixtureConfig(options);
  const fixtureDir = path.join(FIXTURES_DIR, fixtureConfig.name);

  // Check if fixtures exist or need generation
  const exists = await fixtureExists(fixtureConfig.name);

  if (options.generate || !exists) {
    if (!options.json) {
      console.log("Generating fixtures...\n");
    }
    await generateFixtures(fixtureConfig);
    if (!options.json) {
      console.log("");
    }
  }

  // Check if graphql-system exists, run codegen if not
  const gqlSystemExists = await graphqlSystemExists(fixtureConfig.name);
  if (!gqlSystemExists) {
    if (!options.json) {
      console.log("Running codegen to generate graphql-system...\n");
    }
    await runCodegen(fixtureDir);
    if (!options.json) {
      console.log("Codegen completed.\n");
    }
  }

  // Run benchmark based on analyzer option
  if (options.analyzer === "both") {
    await runComparisonMode(fixtureDir, fixtureConfig, options);
  } else {
    const result = await runSingleAnalyzer(fixtureDir, fixtureConfig, options, options.analyzer);

    // Output results
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("");
      console.log(formatBenchmarkResult(result));
    }

    // Save results to cache
    const cacheDir = path.join(PROJECT_ROOT, ".cache", "perf", new Date().toISOString().replace(/[:.]/g, "-"), fixtureConfig.name);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, "metrics.json"), JSON.stringify(result, null, 2));

    if (!options.json) {
      console.log(`\nResults saved to: ${cacheDir}/metrics.json`);
    }
  }
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
