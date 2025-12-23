#!/usr/bin/env bun

/**
 * Types and formatting utilities for transformer benchmarks.
 */

export interface MemorySnapshot {
  start: number;
  peak: number;
  end: number;
  delta: number;
}

export interface MemoryMetrics {
  heapUsed: MemorySnapshot;
  heapTotal: MemorySnapshot;
  rss: MemorySnapshot;
  external: MemorySnapshot;
}

export interface TransformerMetrics {
  // Timing
  wallTimeMs: number;
  cpuTimeMs: number;
  transformerInitMs: number;

  // Memory
  memory: MemoryMetrics;

  // Throughput
  filesTransformed: number;
  totalSourceBytes: number;
  totalOutputBytes: number;
  bytesPerMs: number;
  filesPerSecond: number;
}

export interface TransformerIterationResult {
  iteration: number;
  metrics: TransformerMetrics;
}

export interface FixtureScale {
  totalFiles: number;
  gqlRatio: number;
  objectTypes: number;
  models: number;
  slices: number;
  operations: number;
}

export type TransformerType = "swc" | "babel";
export type TransformMode = "cold" | "warm";

export interface TransformerComparisonResult {
  transformerType: TransformerType;
  mode: TransformMode;
  fixture: string;
  timestamp: string;
  scale: FixtureScale;
  iterations: TransformerIterationResult[];
  average: TransformerMetrics;
  min: TransformerMetrics;
  max: TransformerMetrics;
}

export interface BenchmarkResult {
  fixture: string;
  timestamp: string;
  scale: FixtureScale;
  gqlFileCount: number;
  totalSourceBytes: number;
  swc: {
    cold: TransformerComparisonResult;
    warm: TransformerComparisonResult;
  };
  babel: {
    cold: TransformerComparisonResult;
    warm: TransformerComparisonResult;
  };
  comparison: {
    warmSpeedRatio: number;
    coldSpeedRatio: number;
    warmMemoryRatio: number;
    coldMemoryRatio: number;
  };
}

/**
 * Create an empty memory snapshot.
 */
export function createEmptyMemorySnapshot(): MemorySnapshot {
  return { start: 0, peak: 0, end: 0, delta: 0 };
}

/**
 * Create empty memory metrics.
 */
export function createEmptyMemoryMetrics(): MemoryMetrics {
  return {
    heapUsed: createEmptyMemorySnapshot(),
    heapTotal: createEmptyMemorySnapshot(),
    rss: createEmptyMemorySnapshot(),
    external: createEmptyMemorySnapshot(),
  };
}

/**
 * Create empty transformer metrics.
 */
export function createEmptyTransformerMetrics(): TransformerMetrics {
  return {
    wallTimeMs: 0,
    cpuTimeMs: 0,
    transformerInitMs: 0,
    memory: createEmptyMemoryMetrics(),
    filesTransformed: 0,
    totalSourceBytes: 0,
    totalOutputBytes: 0,
    bytesPerMs: 0,
    filesPerSecond: 0,
  };
}

/**
 * Compute statistics from multiple iteration results.
 */
export function computeStatistics(iterations: TransformerIterationResult[]): {
  average: TransformerMetrics;
  min: TransformerMetrics;
  max: TransformerMetrics;
} {
  if (iterations.length === 0) {
    return {
      average: createEmptyTransformerMetrics(),
      min: createEmptyTransformerMetrics(),
      max: createEmptyTransformerMetrics(),
    };
  }

  const metrics = iterations.map((i) => i.metrics);
  const firstMetrics = metrics[0];

  if (!firstMetrics) {
    return {
      average: createEmptyTransformerMetrics(),
      min: createEmptyTransformerMetrics(),
      max: createEmptyTransformerMetrics(),
    };
  }

  const average = createEmptyTransformerMetrics();
  const min = structuredClone(firstMetrics);
  const max = structuredClone(firstMetrics);

  for (const m of metrics) {
    // Timing
    average.wallTimeMs += m.wallTimeMs;
    average.cpuTimeMs += m.cpuTimeMs;
    average.transformerInitMs += m.transformerInitMs;

    min.wallTimeMs = Math.min(min.wallTimeMs, m.wallTimeMs);
    min.cpuTimeMs = Math.min(min.cpuTimeMs, m.cpuTimeMs);
    min.transformerInitMs = Math.min(min.transformerInitMs, m.transformerInitMs);

    max.wallTimeMs = Math.max(max.wallTimeMs, m.wallTimeMs);
    max.cpuTimeMs = Math.max(max.cpuTimeMs, m.cpuTimeMs);
    max.transformerInitMs = Math.max(max.transformerInitMs, m.transformerInitMs);

    // Memory - aggregate peak values
    for (const key of ["heapUsed", "heapTotal", "rss", "external"] as const) {
      average.memory[key].peak += m.memory[key].peak;
      average.memory[key].delta += m.memory[key].delta;

      min.memory[key].peak = Math.min(min.memory[key].peak, m.memory[key].peak);
      min.memory[key].delta = Math.min(min.memory[key].delta, m.memory[key].delta);

      max.memory[key].peak = Math.max(max.memory[key].peak, m.memory[key].peak);
      max.memory[key].delta = Math.max(max.memory[key].delta, m.memory[key].delta);
    }

    // Throughput
    average.filesTransformed += m.filesTransformed;
    average.totalSourceBytes += m.totalSourceBytes;
    average.totalOutputBytes += m.totalOutputBytes;
    average.bytesPerMs += m.bytesPerMs;
    average.filesPerSecond += m.filesPerSecond;

    min.bytesPerMs = Math.min(min.bytesPerMs, m.bytesPerMs);
    min.filesPerSecond = Math.min(min.filesPerSecond, m.filesPerSecond);

    max.bytesPerMs = Math.max(max.bytesPerMs, m.bytesPerMs);
    max.filesPerSecond = Math.max(max.filesPerSecond, m.filesPerSecond);
  }

  const count = metrics.length;

  // Compute averages
  average.wallTimeMs /= count;
  average.cpuTimeMs /= count;
  average.transformerInitMs /= count;

  for (const key of ["heapUsed", "heapTotal", "rss", "external"] as const) {
    average.memory[key].peak /= count;
    average.memory[key].delta /= count;
  }

  average.filesTransformed /= count;
  average.totalSourceBytes /= count;
  average.totalOutputBytes /= count;
  average.bytesPerMs /= count;
  average.filesPerSecond /= count;

  // Copy file counts to min/max (they should be the same across iterations)
  min.filesTransformed = average.filesTransformed;
  max.filesTransformed = average.filesTransformed;
  min.totalSourceBytes = average.totalSourceBytes;
  max.totalSourceBytes = average.totalSourceBytes;
  min.totalOutputBytes = average.totalOutputBytes;
  max.totalOutputBytes = average.totalOutputBytes;

  return { average, min, max };
}

/**
 * Format bytes as human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Format milliseconds as human-readable string.
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a single transformer metrics object for console output.
 */
function formatSingleMetrics(metrics: TransformerMetrics, label: string): string {
  return `
${label}:
  Timing:
    Wall time:        ${formatMs(metrics.wallTimeMs)}
    CPU time:         ${formatMs(metrics.cpuTimeMs)}
    Init time:        ${formatMs(metrics.transformerInitMs)}

  Memory (peak):
    Heap used:        ${formatBytes(metrics.memory.heapUsed.peak)}
    RSS:              ${formatBytes(metrics.memory.rss.peak)}

  Throughput:
    Files:            ${metrics.filesTransformed}
    Bytes/ms:         ${metrics.bytesPerMs.toFixed(1)}
    Files/sec:        ${metrics.filesPerSecond.toFixed(1)}
`.trim();
}

/**
 * Format comparison table for two transformers.
 */
export function formatComparisonTable(result: BenchmarkResult): string {
  const pad = (s: string, len: number) => s.padStart(len);
  const col1 = 20;
  const col2 = 12;

  const lines: string[] = [
    "",
    "=".repeat(60),
    "COMPARISON",
    "=".repeat(60),
    "",
    `${pad("", col1)}${pad("SWC", col2)}${pad("Babel", col2)}${pad("Ratio", col2)}`,
    "-".repeat(56),
  ];

  // Cold transform
  const coldSwc = result.swc.cold.average.wallTimeMs;
  const coldBabel = result.babel.cold.average.wallTimeMs;
  const coldRatio = coldBabel / coldSwc;
  lines.push(
    `${pad("Cold Wall Time:", col1)}${pad(formatMs(coldSwc), col2)}${pad(formatMs(coldBabel), col2)}${pad(`${coldRatio.toFixed(2)}x`, col2)}`,
  );

  // Warm transform
  const warmSwc = result.swc.warm.average.wallTimeMs;
  const warmBabel = result.babel.warm.average.wallTimeMs;
  const warmRatio = warmBabel / warmSwc;
  lines.push(
    `${pad("Warm Wall Time:", col1)}${pad(formatMs(warmSwc), col2)}${pad(formatMs(warmBabel), col2)}${pad(`${warmRatio.toFixed(2)}x`, col2)}`,
  );

  // Memory (warm)
  const memSwc = result.swc.warm.average.memory.heapUsed.peak;
  const memBabel = result.babel.warm.average.memory.heapUsed.peak;
  const memRatio = memSwc / memBabel;
  lines.push(
    `${pad("Warm Memory:", col1)}${pad(formatBytes(memSwc), col2)}${pad(formatBytes(memBabel), col2)}${pad(`${memRatio.toFixed(2)}x`, col2)}`,
  );

  // Throughput (warm)
  const tputSwc = result.swc.warm.average.filesPerSecond;
  const tputBabel = result.babel.warm.average.filesPerSecond;
  const tputRatio = tputSwc / tputBabel;
  lines.push(
    `${pad("Warm Files/sec:", col1)}${pad(tputSwc.toFixed(0), col2)}${pad(tputBabel.toFixed(0), col2)}${pad(`${tputRatio.toFixed(2)}x`, col2)}`,
  );

  return lines.join("\n");
}

/**
 * Format a single transformer's results.
 */
function formatTransformerResult(name: string, cold: TransformerComparisonResult, warm: TransformerComparisonResult): string {
  const lines: string[] = [
    "",
    "=".repeat(60),
    `${name.toUpperCase()} TRANSFORMER`,
    "=".repeat(60),
    "",
    "COLD TRANSFORM (new transformer per file):",
    formatSingleMetrics(cold.average, "  Average"),
    "",
    "WARM TRANSFORM (reuse transformer):",
    formatSingleMetrics(warm.average, "  Average"),
  ];

  return lines.join("\n");
}

/**
 * Format benchmark result for human-readable console output.
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  const lines: string[] = [
    "Transformer Benchmark",
    "=".repeat(60),
    "",
    `Fixture: ${result.fixture}`,
    `Timestamp: ${result.timestamp}`,
    `Iterations: ${result.swc.cold.iterations.length}`,
    "",
    "Scale:",
    `  Total files:      ${result.scale.totalFiles}`,
    `  GQL files:        ${result.gqlFileCount}`,
    `  Total source:     ${formatBytes(result.totalSourceBytes)}`,
    "",
  ];

  lines.push(formatTransformerResult("SWC", result.swc.cold, result.swc.warm));
  lines.push(formatTransformerResult("Babel", result.babel.cold, result.babel.warm));
  lines.push(formatComparisonTable(result));

  return lines.join("\n");
}

// CLI entry point - read from stdin
if (import.meta.main) {
  const input = await Bun.stdin.text();
  try {
    const result = JSON.parse(input) as BenchmarkResult;
    console.log(formatBenchmarkResult(result));
  } catch {
    console.error("Failed to parse input as BenchmarkResult JSON");
    process.exit(1);
  }
}
