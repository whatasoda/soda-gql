#!/usr/bin/env bun
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfigFrom, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createBuilderSession, type BuilderArtifact } from "@soda-gql/builder";
import { createTransformer as createSwcTransformer } from "@soda-gql/swc-transformer";
import { createBabelTransformer } from "@soda-gql/babel-transformer";
import { FIXTURE_PRESETS, type FixtureConfig } from "../../runtime-builder/scripts/generate-fixtures";
import {
  computeStatistics,
  createEmptyTransformerMetrics,
  formatBenchmarkResult,
  type BenchmarkResult,
  type FixtureScale,
  type MemoryMetrics,
  type TransformerComparisonResult,
  type TransformerIterationResult,
  type TransformerMetrics,
  type TransformerType,
  type TransformMode,
} from "./process-results";

const PERF_DIR = path.join(import.meta.dirname, "..");
const RUNTIME_BUILDER_FIXTURES_DIR = path.join(PERF_DIR, "..", "runtime-builder", "fixtures");
const PROJECT_ROOT = path.resolve(PERF_DIR, "../..");

interface RunOptions {
  fixture: string;
  iterations: number;
  warmup: number;
  json: boolean;
  gc: boolean;
  swcOnly: boolean;
  babelOnly: boolean;
  coldOnly: boolean;
  warmOnly: boolean;
  sourceMap: boolean;
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    fixture: "small",
    iterations: 5,
    warmup: 2,
    json: false,
    gc: false,
    swcOnly: false,
    babelOnly: false,
    coldOnly: false,
    warmOnly: false,
    sourceMap: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--fixture":
        options.fixture = args[++i] ?? "small";
        break;
      case "--iterations":
        options.iterations = parseInt(args[++i] ?? "5", 10);
        break;
      case "--warmup":
        options.warmup = parseInt(args[++i] ?? "2", 10);
        break;
      case "--json":
        options.json = true;
        break;
      case "--gc":
        options.gc = true;
        break;
      case "--swc-only":
        options.swcOnly = true;
        break;
      case "--babel-only":
        options.babelOnly = true;
        break;
      case "--cold-only":
        options.coldOnly = true;
        break;
      case "--warm-only":
        options.warmOnly = true;
        break;
      case "--source-map":
        options.sourceMap = true;
        break;
    }
  }

  return options;
}

interface SourceFile {
  path: string;
  content: string;
  size: number;
}

async function fixtureExists(fixtureName: string): Promise<boolean> {
  try {
    await fs.access(path.join(RUNTIME_BUILDER_FIXTURES_DIR, fixtureName, "soda-gql.config.ts"));
    return true;
  } catch {
    return false;
  }
}

async function graphqlSystemExists(fixtureName: string): Promise<boolean> {
  try {
    await fs.access(path.join(RUNTIME_BUILDER_FIXTURES_DIR, fixtureName, "graphql-system", "index.ts"));
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
 * Collect memory metrics during transform.
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
 * Collect all GQL source files from fixture.
 */
async function collectGqlSourceFiles(fixtureDir: string): Promise<SourceFile[]> {
  const glob = new Bun.Glob("**/*.ts");
  const files: SourceFile[] = [];

  for await (const filePath of glob.scan({ cwd: fixtureDir, absolute: true })) {
    // Skip graphql-system directory
    if (filePath.includes("/graphql-system/")) continue;
    // Skip config files
    if (filePath.endsWith(".config.ts")) continue;

    const content = await Bun.file(filePath).text();

    // Check if file contains gql.default() calls
    if (content.includes("gql.default(")) {
      files.push({
        path: filePath,
        content,
        size: Buffer.byteLength(content, "utf8"),
      });
    }
  }

  return files;
}

interface FixtureSetup {
  config: ResolvedSodaGqlConfig;
  artifact: BuilderArtifact;
  sourceFiles: SourceFile[];
  scale: FixtureScale;
}

/**
 * Setup fixture: load config, build artifact, collect source files.
 */
async function setupFixture(fixtureDir: string, fixtureName: string): Promise<FixtureSetup> {
  const configResult = loadConfigFrom(fixtureDir);
  if (configResult.isErr()) {
    throw new Error(`Failed to load config: ${configResult.error.code}`);
  }
  const config = configResult.value;

  const session = createBuilderSession({
    evaluatorId: `perf-transformer-${Date.now()}`,
    config,
  });

  const buildResult = session.build({ force: true });
  session.dispose();

  if (buildResult.isErr()) {
    throw new Error(`Build failed: ${buildResult.error.code}`);
  }

  const artifact = buildResult.value;
  const sourceFiles = await collectGqlSourceFiles(fixtureDir);

  const preset = FIXTURE_PRESETS[fixtureName] ?? FIXTURE_PRESETS.small;
  const scale: FixtureScale = {
    totalFiles: preset?.totalFiles ?? 50,
    gqlRatio: preset?.gqlRatio ?? 0.2,
    objectTypes: preset?.objectTypes ?? 10,
    models: preset?.models ?? 5,
    slices: preset?.slices ?? 5,
    operations: preset?.operations ?? 5,
  };

  return { config, artifact, sourceFiles, scale };
}

/**
 * Measure cold transformation (new transformer per file).
 */
async function measureColdTransform(
  transformerType: TransformerType,
  setup: FixtureSetup,
  options: { gc: boolean; sourceMap: boolean },
): Promise<TransformerMetrics> {
  if (options.gc && typeof global.gc === "function") {
    global.gc();
  }

  const { config, artifact, sourceFiles } = setup;
  const memoryCollector = new MemoryCollector();
  memoryCollector.start();

  const startTime = performance.now();
  const startCpu = process.cpuUsage();

  let totalInitMs = 0;
  let totalOutputBytes = 0;

  for (const file of sourceFiles) {
    const initStart = performance.now();

    if (transformerType === "swc") {
      const transformer = await createSwcTransformer({
        config,
        artifact,
        sourceMap: options.sourceMap,
      });
      totalInitMs += performance.now() - initStart;

      const result = transformer.transform({
        sourceCode: file.content,
        sourcePath: file.path,
      });
      totalOutputBytes += Buffer.byteLength(result.sourceCode, "utf8");
    } else {
      const transformer = createBabelTransformer({
        config,
        artifact,
        sourceMap: options.sourceMap,
      });
      totalInitMs += performance.now() - initStart;

      const result = transformer.transform({
        sourceCode: file.content,
        sourcePath: file.path,
      });
      totalOutputBytes += Buffer.byteLength(result.sourceCode, "utf8");
    }
  }

  const endTime = performance.now();
  const endCpu = process.cpuUsage(startCpu);
  const memory = memoryCollector.stop();

  const wallTimeMs = endTime - startTime;
  const totalSourceBytes = sourceFiles.reduce((sum, f) => sum + f.size, 0);

  return {
    wallTimeMs,
    cpuTimeMs: (endCpu.user + endCpu.system) / 1000,
    transformerInitMs: totalInitMs,
    memory,
    filesTransformed: sourceFiles.length,
    totalSourceBytes,
    totalOutputBytes,
    bytesPerMs: totalSourceBytes / wallTimeMs,
    filesPerSecond: (sourceFiles.length / wallTimeMs) * 1000,
  };
}

/**
 * Measure warm transformation (reuse transformer).
 */
async function measureWarmTransform(
  transformerType: TransformerType,
  setup: FixtureSetup,
  options: { gc: boolean; sourceMap: boolean },
): Promise<TransformerMetrics> {
  if (options.gc && typeof global.gc === "function") {
    global.gc();
  }

  const { config, artifact, sourceFiles } = setup;

  // Create transformer once
  const initStart = performance.now();
  let transformer: { transform: (input: { sourceCode: string; sourcePath: string }) => { sourceCode: string } };

  if (transformerType === "swc") {
    transformer = await createSwcTransformer({
      config,
      artifact,
      sourceMap: options.sourceMap,
    });
  } else {
    transformer = createBabelTransformer({
      config,
      artifact,
      sourceMap: options.sourceMap,
    });
  }
  const initMs = performance.now() - initStart;

  const memoryCollector = new MemoryCollector();
  memoryCollector.start();

  const startTime = performance.now();
  const startCpu = process.cpuUsage();

  let totalOutputBytes = 0;

  for (const file of sourceFiles) {
    const result = transformer.transform({
      sourceCode: file.content,
      sourcePath: file.path,
    });
    totalOutputBytes += Buffer.byteLength(result.sourceCode, "utf8");
  }

  const endTime = performance.now();
  const endCpu = process.cpuUsage(startCpu);
  const memory = memoryCollector.stop();

  const wallTimeMs = endTime - startTime;
  const totalSourceBytes = sourceFiles.reduce((sum, f) => sum + f.size, 0);

  return {
    wallTimeMs,
    cpuTimeMs: (endCpu.user + endCpu.system) / 1000,
    transformerInitMs: initMs,
    memory,
    filesTransformed: sourceFiles.length,
    totalSourceBytes,
    totalOutputBytes,
    bytesPerMs: totalSourceBytes / wallTimeMs,
    filesPerSecond: (sourceFiles.length / wallTimeMs) * 1000,
  };
}

/**
 * Run warmup iterations to ensure JIT compilation is complete.
 */
async function runWarmup(
  transformerType: TransformerType,
  setup: FixtureSetup,
  iterations: number,
  options: { sourceMap: boolean },
): Promise<void> {
  const { config, artifact, sourceFiles } = setup;

  for (let i = 0; i < iterations; i++) {
    if (transformerType === "swc") {
      const transformer = await createSwcTransformer({
        config,
        artifact,
        sourceMap: options.sourceMap,
      });
      for (const file of sourceFiles) {
        transformer.transform({
          sourceCode: file.content,
          sourcePath: file.path,
        });
      }
    } else {
      const transformer = createBabelTransformer({
        config,
        artifact,
        sourceMap: options.sourceMap,
      });
      for (const file of sourceFiles) {
        transformer.transform({
          sourceCode: file.content,
          sourcePath: file.path,
        });
      }
    }
  }
}

/**
 * Run benchmark for a single transformer.
 */
async function runTransformerBenchmark(
  transformerType: TransformerType,
  setup: FixtureSetup,
  fixtureName: string,
  options: RunOptions,
): Promise<{ cold: TransformerComparisonResult; warm: TransformerComparisonResult }> {
  const timestamp = new Date().toISOString();

  // Run warmup
  if (!options.json) {
    process.stdout.write(`  Warming up ${transformerType.toUpperCase()}...`);
  }
  await runWarmup(transformerType, setup, options.warmup, { sourceMap: options.sourceMap });
  if (!options.json) {
    console.log(" done");
  }

  // Cold iterations
  const coldIterations: TransformerIterationResult[] = [];
  if (!options.warmOnly) {
    for (let i = 0; i < options.iterations; i++) {
      if (!options.json) {
        process.stdout.write(`  ${transformerType.toUpperCase()} cold ${i + 1}/${options.iterations}...`);
      }
      const metrics = await measureColdTransform(transformerType, setup, {
        gc: options.gc,
        sourceMap: options.sourceMap,
      });
      coldIterations.push({ iteration: i + 1, metrics });
      if (!options.json) {
        console.log(` ${metrics.wallTimeMs.toFixed(1)}ms`);
      }
    }
  }

  // Warm iterations
  const warmIterations: TransformerIterationResult[] = [];
  if (!options.coldOnly) {
    for (let i = 0; i < options.iterations; i++) {
      if (!options.json) {
        process.stdout.write(`  ${transformerType.toUpperCase()} warm ${i + 1}/${options.iterations}...`);
      }
      const metrics = await measureWarmTransform(transformerType, setup, {
        gc: options.gc,
        sourceMap: options.sourceMap,
      });
      warmIterations.push({ iteration: i + 1, metrics });
      if (!options.json) {
        console.log(` ${metrics.wallTimeMs.toFixed(1)}ms`);
      }
    }
  }

  const coldStats = computeStatistics(coldIterations);
  const warmStats = computeStatistics(warmIterations);

  const createResult = (
    mode: TransformMode,
    iterations: TransformerIterationResult[],
    stats: ReturnType<typeof computeStatistics>,
  ): TransformerComparisonResult => ({
    transformerType,
    mode,
    fixture: fixtureName,
    timestamp,
    scale: setup.scale,
    iterations,
    average: stats.average,
    min: stats.min,
    max: stats.max,
  });

  return {
    cold: createResult("cold", coldIterations, coldStats),
    warm: createResult("warm", warmIterations, warmStats),
  };
}

async function main() {
  const options = parseArgs();
  const fixtureName = options.fixture;
  const fixtureDir = path.join(RUNTIME_BUILDER_FIXTURES_DIR, fixtureName);

  // Check if fixtures exist
  const exists = await fixtureExists(fixtureName);
  if (!exists) {
    console.error(`Fixture "${fixtureName}" does not exist.`);
    console.error(`Run 'bun run perf:builder --fixture ${fixtureName} --generate' first.`);
    process.exit(1);
  }

  // Check if graphql-system exists, run codegen if not
  const gqlSystemExists = await graphqlSystemExists(fixtureName);
  if (!gqlSystemExists) {
    if (!options.json) {
      console.log("Running codegen to generate graphql-system...\n");
    }
    await runCodegen(fixtureDir);
    if (!options.json) {
      console.log("Codegen completed.\n");
    }
  }

  // Setup fixture
  if (!options.json) {
    console.log(`Setting up fixture "${fixtureName}"...`);
  }
  const setup = await setupFixture(fixtureDir, fixtureName);

  if (!options.json) {
    console.log(`Found ${setup.sourceFiles.length} GQL files\n`);
    console.log(`Running transformer benchmark (${options.iterations} iterations, ${options.warmup} warmup)...\n`);
  }

  // Run benchmarks
  let swcResult: { cold: TransformerComparisonResult; warm: TransformerComparisonResult } | null = null;
  let babelResult: { cold: TransformerComparisonResult; warm: TransformerComparisonResult } | null = null;

  if (!options.babelOnly) {
    swcResult = await runTransformerBenchmark("swc", setup, fixtureName, options);
  }

  if (!options.swcOnly) {
    babelResult = await runTransformerBenchmark("babel", setup, fixtureName, options);
  }

  // Create empty result if one transformer was skipped
  const emptyStats = computeStatistics([]);
  const createEmptyResult = (type: TransformerType, mode: TransformMode): TransformerComparisonResult => ({
    transformerType: type,
    mode,
    fixture: fixtureName,
    timestamp: new Date().toISOString(),
    scale: setup.scale,
    iterations: [],
    average: emptyStats.average,
    min: emptyStats.min,
    max: emptyStats.max,
  });

  const swc = swcResult ?? { cold: createEmptyResult("swc", "cold"), warm: createEmptyResult("swc", "warm") };
  const babel = babelResult ?? { cold: createEmptyResult("babel", "cold"), warm: createEmptyResult("babel", "warm") };

  // Compute comparison ratios
  const warmSpeedRatio =
    swc.warm.average.wallTimeMs > 0 && babel.warm.average.wallTimeMs > 0
      ? babel.warm.average.wallTimeMs / swc.warm.average.wallTimeMs
      : 0;
  const coldSpeedRatio =
    swc.cold.average.wallTimeMs > 0 && babel.cold.average.wallTimeMs > 0
      ? babel.cold.average.wallTimeMs / swc.cold.average.wallTimeMs
      : 0;
  const warmMemoryRatio =
    swc.warm.average.memory.heapUsed.peak > 0 && babel.warm.average.memory.heapUsed.peak > 0
      ? swc.warm.average.memory.heapUsed.peak / babel.warm.average.memory.heapUsed.peak
      : 0;
  const coldMemoryRatio =
    swc.cold.average.memory.heapUsed.peak > 0 && babel.cold.average.memory.heapUsed.peak > 0
      ? swc.cold.average.memory.heapUsed.peak / babel.cold.average.memory.heapUsed.peak
      : 0;

  const totalSourceBytes = setup.sourceFiles.reduce((sum, f) => sum + f.size, 0);

  const result: BenchmarkResult = {
    fixture: fixtureName,
    timestamp: new Date().toISOString(),
    scale: setup.scale,
    gqlFileCount: setup.sourceFiles.length,
    totalSourceBytes,
    swc,
    babel,
    comparison: {
      warmSpeedRatio,
      coldSpeedRatio,
      warmMemoryRatio,
      coldMemoryRatio,
    },
  };

  // Output results
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    console.log(formatBenchmarkResult(result));
  }

  // Save results to cache
  const cacheDir = path.join(
    PROJECT_ROOT,
    ".cache",
    "perf",
    new Date().toISOString().replace(/[:.]/g, "-"),
    "transformer",
    fixtureName,
  );
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, "metrics.json"), JSON.stringify(result, null, 2));

  if (!options.json) {
    console.log(`\nResults saved to: ${cacheDir}/metrics.json`);
  }
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
