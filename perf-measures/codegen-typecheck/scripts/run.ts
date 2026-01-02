#!/usr/bin/env bun
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  compareResults,
  formatPercent,
  getLatestResult,
  getPreviousResult,
  isRegression,
} from "./process-results.ts";

const BENCH_DIR = path.join(import.meta.dirname, "..");
const PROJECT_ROOT = path.resolve(BENCH_DIR, "../..");

const ALL_MODES = [
  "baseline",
  "optimized",
  "granular",
  "precomputed",
  "shallowInput",
  "typedAssertion",
  "branded",
  "looseConstraint",
  "noSatisfies",
] as const;

type BenchMode = "baseline" | "optimized" | "granular" | "precomputed" | "shallowInput" | "typedAssertion" | "branded" | "looseConstraint" | "noSatisfies";

type CompareMode = "none" | "previous" | "baseline";

interface RunOptions {
  mode: BenchMode | "all";
  modes: BenchMode[] | null;
  generate: boolean;
  trace: boolean;
  iterations: number;
  json: boolean;
  compare: CompareMode;
  threshold: number;
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    mode: "all",
    modes: null,
    generate: false,
    trace: false,
    iterations: 1,
    json: false,
    compare: "none",
    threshold: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--baseline":
        options.mode = "baseline";
        break;
      case "--optimized":
        options.mode = "optimized";
        break;
      case "--granular":
        options.mode = "granular";
        break;
      case "--precomputed":
        options.mode = "precomputed";
        break;
      case "--shallowInput":
        options.mode = "shallowInput";
        break;
      case "--typedAssertion":
        options.mode = "typedAssertion";
        break;
      case "--branded":
        options.mode = "branded";
        break;
      case "--looseConstraint":
        options.mode = "looseConstraint";
        break;
      case "--noSatisfies":
        options.mode = "noSatisfies";
        break;
      case "--all":
        options.mode = "all";
        break;
      case "--generate":
        options.generate = true;
        break;
      case "--trace":
        options.trace = true;
        break;
      case "--iterations":
        options.iterations = parseInt(args[++i] ?? "1", 10);
        break;
      case "--json":
        options.json = true;
        break;
      case "--compare":
      case "--compare-previous":
        options.compare = "previous";
        break;
      case "--compare-baseline":
        options.compare = "baseline";
        break;
      case "--modes": {
        const modesArg = args[++i] ?? "";
        const parsed = modesArg.split(",").filter((m): m is BenchMode => ALL_MODES.includes(m as BenchMode));
        if (parsed.length > 0) {
          options.modes = parsed;
        }
        break;
      }
      case "--threshold":
        options.threshold = parseFloat(args[++i] ?? "10");
        break;
    }
  }

  return options;
}

interface DiagnosticMetrics {
  files: number;
  lines: number;
  identifiers: number;
  symbols: number;
  types: number;
  instantiations: number;
  memoryUsed: number;
  ioReadTime: number;
  ioWriteTime: number;
  parseTime: number;
  bindTime: number;
  checkTime: number;
  emitTime: number;
  totalTime: number;
}

interface BenchmarkResult {
  timestamp: string;
  mode: BenchMode;
  generatedStats: { lines: number; sizeKB: number };
  metrics: DiagnosticMetrics;
}

function parseDiagnostics(output: string): DiagnosticMetrics {
  const getNumber = (pattern: RegExp): number => {
    const match = output.match(pattern);
    if (!match) return 0;
    return parseFloat(match[1]?.replace(/,/g, "") ?? "0");
  };

  return {
    files: getNumber(/Files:\s+([\d,]+)/),
    lines: getNumber(/Lines of Library .* d\.ts:\s+([\d,]+)/),
    identifiers: getNumber(/Identifiers:\s+([\d,]+)/),
    symbols: getNumber(/Symbols:\s+([\d,]+)/),
    types: getNumber(/Types:\s+([\d,]+)/),
    instantiations: getNumber(/Instantiations:\s+([\d,]+)/),
    memoryUsed: getNumber(/Memory used:\s+([\d,]+)/),
    ioReadTime: getNumber(/I\/O Read time:\s+([\d.]+)/),
    ioWriteTime: getNumber(/I\/O Write time:\s+([\d.]+)/),
    parseTime: getNumber(/Parse time:\s+([\d.]+)/),
    bindTime: getNumber(/Bind time:\s+([\d.]+)/),
    checkTime: getNumber(/Check time:\s+([\d.]+)/),
    emitTime: getNumber(/Emit time:\s+([\d.]+)/),
    totalTime: getNumber(/Total time:\s+([\d.]+)/),
  };
}

async function generateCode(mode: BenchMode): Promise<void> {
  const generateScript = path.join(BENCH_DIR, "scripts/generate.ts");
  return new Promise((resolve, reject) => {
    const proc = spawn("bun", [generateScript, mode], {
      cwd: BENCH_DIR,
      stdio: "inherit",
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Generation failed with code ${code}`));
    });
    proc.on("error", reject);
  });
}

async function runTsc(
  mode: BenchMode,
  trace: boolean,
): Promise<{ metrics: DiagnosticMetrics; traceDir?: string }> {
  const tsconfigPath = path.join(BENCH_DIR, mode, "tsconfig.json");

  // Build tsc args
  const tscArgs = ["--project", tsconfigPath, "--extendedDiagnostics", "--noEmit"];

  let traceDir: string | undefined;
  if (trace) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    traceDir = path.join(BENCH_DIR, ".traces", `${mode}-${timestamp}`);
    await fs.mkdir(traceDir, { recursive: true });
    tscArgs.push("--generateTrace", traceDir);
  }

  return new Promise((resolve, reject) => {
    // Use bun run to execute tsc through package.json script pattern
    // This ensures proper TypeScript binary resolution
    const proc = spawn("bun", ["run", `typecheck:${mode}`, ...(trace ? ["--", "--generateTrace", traceDir!] : [])], {
      cwd: BENCH_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      // Debug: print raw output
      if (process.env.DEBUG) {
        console.log("=== RAW TSC OUTPUT ===");
        console.log(output);
        console.log("=== END RAW OUTPUT ===");
      }
      const metrics = parseDiagnostics(output);
      resolve({ metrics, traceDir });
    });
    proc.on("error", reject);
  });
}

async function checkGeneratedExists(mode: BenchMode): Promise<boolean> {
  try {
    await fs.access(path.join(BENCH_DIR, mode, "generated/index.ts"));
    return true;
  } catch {
    return false;
  }
}

async function getGeneratedStats(mode: BenchMode): Promise<{ lines: number; size: number }> {
  try {
    const content = await fs.readFile(path.join(BENCH_DIR, mode, "generated/index.ts"), "utf-8");
    return {
      lines: content.split("\n").length,
      size: Buffer.byteLength(content, "utf-8"),
    };
  } catch {
    return { lines: 0, size: 0 };
  }
}

async function saveResults(result: BenchmarkResult): Promise<string> {
  const cacheDir = path.join(
    PROJECT_ROOT,
    ".cache",
    "perf",
    result.timestamp,
    "codegen-typecheck",
    result.mode,
  );
  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, "metrics.json");
  await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

function formatMetrics(metrics: DiagnosticMetrics): string {
  return [
    `  Check time:      ${metrics.checkTime.toFixed(2)}s`,
    `  Parse time:      ${metrics.parseTime.toFixed(2)}s`,
    `  Bind time:       ${metrics.bindTime.toFixed(2)}s`,
    `  Total time:      ${metrics.totalTime.toFixed(2)}s`,
    `  Types:           ${metrics.types.toLocaleString()}`,
    `  Instantiations:  ${metrics.instantiations.toLocaleString()}`,
    `  Memory:          ${(metrics.memoryUsed / 1024).toFixed(1)} MB`,
  ].join("\n");
}

async function runBenchmark(
  mode: BenchMode,
  options: RunOptions,
  timestamp: string,
): Promise<BenchmarkResult> {
  const exists = await checkGeneratedExists(mode);
  if (options.generate || !exists) {
    await generateCode(mode);
  }

  const stats = await getGeneratedStats(mode);
  if (!options.json) {
    console.log(`\n${mode.toUpperCase()} (${stats.lines} lines, ${(stats.size / 1024).toFixed(1)} KB)`);
    console.log("─".repeat(50));
  }

  let totalMetrics: DiagnosticMetrics | null = null;

  for (let i = 0; i < options.iterations; i++) {
    if (options.iterations > 1 && !options.json) {
      console.log(`  Iteration ${i + 1}/${options.iterations}...`);
    }

    const { metrics, traceDir } = await runTsc(mode, options.trace && i === 0);

    if (!totalMetrics) {
      totalMetrics = { ...metrics };
    } else {
      // Accumulate for averaging
      for (const key of Object.keys(metrics) as (keyof DiagnosticMetrics)[]) {
        totalMetrics[key] += metrics[key];
      }
    }

    if (traceDir && !options.json) {
      console.log(`  Trace saved to: ${traceDir}`);
    }
  }

  // Average the results
  if (totalMetrics && options.iterations > 1) {
    for (const key of Object.keys(totalMetrics) as (keyof DiagnosticMetrics)[]) {
      totalMetrics[key] /= options.iterations;
    }
  }

  if (!options.json) {
    console.log(formatMetrics(totalMetrics!));
  }

  return {
    timestamp,
    mode,
    generatedStats: { lines: stats.lines, sizeKB: stats.size / 1024 },
    metrics: totalMetrics!,
  };
}

async function main() {
  const options = parseArgs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (!options.json) {
    console.log("@soda-gql Codegen TypeCheck Benchmark");
    console.log("=====================================");
  }

  // Determine which modes to run
  let modes: BenchMode[];
  if (options.modes) {
    // --modes flag takes priority
    modes = options.modes;
  } else if (options.mode === "all") {
    // --all runs all 9 modes
    modes = [...ALL_MODES];
  } else {
    // Single mode
    modes = [options.mode as BenchMode];
  }

  const results: Record<string, BenchmarkResult> = {};
  let hasRegression = false;

  for (const mode of modes) {
    const result = await runBenchmark(mode, options, timestamp);
    results[mode] = result;

    // Save result to cache
    const savedPath = await saveResults(result);
    if (!options.json) {
      console.log(`  Result saved: ${savedPath}`);
    }

    // Show comparison if requested
    if (!options.json && options.compare !== "none") {
      const baselineResult = await getComparisonBaseline(mode, options);
      if (baselineResult) {
        const comparison = compareResults(result.metrics, baselineResult.metrics);
        const label = options.compare === "baseline" ? "vs baseline mode" : "vs previous";
        console.log(`  ${label}: ${formatPercent(comparison.checkTimePercent)} check time`);

        if (isRegression(comparison, options.threshold)) {
          console.log(`  ⚠️  Regression detected (>${options.threshold}% threshold)`);
          hasRegression = true;
        }
      }
    }
  }

  if (options.json) {
    // Output JSON to stdout
    console.log(JSON.stringify(Object.values(results), null, 2));
    return;
  }

  // Show comparison table for multiple modes run together
  if (modes.length > 1 && results.baseline) {
    const baseline = results.baseline.metrics;

    console.log("\nCOMPARISON (vs Baseline in this run)");
    console.log("─".repeat(50));

    for (const mode of modes.filter((m) => m !== "baseline")) {
      const current = results[mode]?.metrics;
      if (!current) continue;
      const improvement = ((baseline.checkTime - current.checkTime) / baseline.checkTime) * 100;
      console.log(`  ${mode}:`);
      console.log(`    Check time: ${current.checkTime.toFixed(2)}s (${improvement > 0 ? "-" : "+"}${Math.abs(improvement).toFixed(1)}%)`);
      console.log(`    Instantiations: ${current.instantiations.toLocaleString()}`);
    }

    console.log(`\n  Baseline reference: ${baseline.checkTime.toFixed(2)}s`);
  }

  if (hasRegression) {
    console.log("\n⚠️  Some modes showed regression above threshold");
  }
}

async function getComparisonBaseline(
  mode: BenchMode,
  options: RunOptions,
): Promise<BenchmarkResult | null> {
  if (options.compare === "baseline") {
    // Compare against baseline mode's latest result
    return getLatestResult("baseline");
  }
  // Compare against same mode's previous result
  return getPreviousResult(mode);
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
