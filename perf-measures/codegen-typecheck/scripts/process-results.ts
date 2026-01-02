import * as fs from "node:fs/promises";
import * as path from "node:path";

const BENCH_DIR = path.join(import.meta.dirname, "..");
const PROJECT_ROOT = path.resolve(BENCH_DIR, "../..");
const CACHE_DIR = path.join(PROJECT_ROOT, ".cache", "perf");

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
  mode: string;
  generatedStats: { lines: number; sizeKB: number };
  metrics: DiagnosticMetrics;
}

interface ComparisonResult {
  checkTimeDiff: number;
  checkTimePercent: number;
  instantiationsDiff: number;
  instantiationsPercent: number;
  typesDiff: number;
  typesPercent: number;
  memoryDiff: number;
  memoryPercent: number;
}

/**
 * Get all timestamps from cache directory, sorted newest first
 */
async function getTimestamps(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Get the latest result for a specific mode
 */
export async function getLatestResult(mode: string): Promise<BenchmarkResult | null> {
  const timestamps = await getTimestamps();

  for (const timestamp of timestamps) {
    const filePath = path.join(CACHE_DIR, timestamp, "codegen-typecheck", mode, "metrics.json");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as BenchmarkResult;
    } catch {
      // Result doesn't exist for this timestamp/mode, try next
      continue;
    }
  }

  return null;
}

/**
 * Get recent results for a specific mode
 */
export async function getRecentResults(mode: string, count: number): Promise<BenchmarkResult[]> {
  const timestamps = await getTimestamps();
  const results: BenchmarkResult[] = [];

  for (const timestamp of timestamps) {
    if (results.length >= count) break;

    const filePath = path.join(CACHE_DIR, timestamp, "codegen-typecheck", mode, "metrics.json");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      results.push(JSON.parse(content) as BenchmarkResult);
    } catch {
      continue;
    }
  }

  return results;
}

/**
 * Get the previous result for a specific mode (skipping the most recent)
 */
export async function getPreviousResult(mode: string): Promise<BenchmarkResult | null> {
  const results = await getRecentResults(mode, 2);
  return results[1] ?? null;
}

/**
 * Compare two sets of metrics
 */
export function compareResults(current: DiagnosticMetrics, baseline: DiagnosticMetrics): ComparisonResult {
  const checkTimeDiff = current.checkTime - baseline.checkTime;
  const instantiationsDiff = current.instantiations - baseline.instantiations;
  const typesDiff = current.types - baseline.types;
  const memoryDiff = current.memoryUsed - baseline.memoryUsed;

  return {
    checkTimeDiff,
    checkTimePercent: baseline.checkTime > 0 ? (checkTimeDiff / baseline.checkTime) * 100 : 0,
    instantiationsDiff,
    instantiationsPercent: baseline.instantiations > 0 ? (instantiationsDiff / baseline.instantiations) * 100 : 0,
    typesDiff,
    typesPercent: baseline.types > 0 ? (typesDiff / baseline.types) * 100 : 0,
    memoryDiff,
    memoryPercent: baseline.memoryUsed > 0 ? (memoryDiff / baseline.memoryUsed) * 100 : 0,
  };
}

/**
 * Format a percentage change with + or - prefix
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Check if a comparison result exceeds the threshold (regression)
 */
export function isRegression(comparison: ComparisonResult, thresholdPercent: number): boolean {
  // Positive percent means regression (slower/more usage)
  return comparison.checkTimePercent > thresholdPercent;
}
