#!/usr/bin/env bun

/**
 * Types and formatting utilities for builder runtime benchmarks.
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

export interface BuilderMetrics {
  // Timing
  wallTimeMs: number;
  cpuTimeMs: number;
  builderDurationMs: number;

  // Memory
  memory: MemoryMetrics;

  // Discovery statistics
  discoveryHits: number;
  discoveryMisses: number;
  discoverySkips: number;

  // File statistics
  totalFilesScanned: number;
  gqlFilesFound: number;
  elementCount: number;
}

export interface IterationResult {
  iteration: number;
  metrics: BuilderMetrics;
}

export interface FixtureScale {
  totalFiles: number;
  gqlRatio: number;
  objectTypes: number;
  models: number;
  slices: number;
  operations: number;
}

export interface BenchmarkResult {
  fixture: string;
  timestamp: string;
  scale: FixtureScale;
  iterations: IterationResult[];
  average: BuilderMetrics;
  min: BuilderMetrics;
  max: BuilderMetrics;
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
 * Create empty builder metrics.
 */
export function createEmptyBuilderMetrics(): BuilderMetrics {
  return {
    wallTimeMs: 0,
    cpuTimeMs: 0,
    builderDurationMs: 0,
    memory: createEmptyMemoryMetrics(),
    discoveryHits: 0,
    discoveryMisses: 0,
    discoverySkips: 0,
    totalFilesScanned: 0,
    gqlFilesFound: 0,
    elementCount: 0,
  };
}

/**
 * Compute statistics from multiple iteration results.
 */
export function computeStatistics(iterations: IterationResult[]): {
  average: BuilderMetrics;
  min: BuilderMetrics;
  max: BuilderMetrics;
} {
  if (iterations.length === 0) {
    return {
      average: createEmptyBuilderMetrics(),
      min: createEmptyBuilderMetrics(),
      max: createEmptyBuilderMetrics(),
    };
  }

  const metrics = iterations.map((i) => i.metrics);
  const firstMetrics = metrics[0];

  // TypeScript narrowing: we've already checked iterations.length > 0
  if (!firstMetrics) {
    return {
      average: createEmptyBuilderMetrics(),
      min: createEmptyBuilderMetrics(),
      max: createEmptyBuilderMetrics(),
    };
  }

  const average = createEmptyBuilderMetrics();
  const min = structuredClone(firstMetrics);
  const max = structuredClone(firstMetrics);

  for (const m of metrics) {
    // Timing
    average.wallTimeMs += m.wallTimeMs;
    average.cpuTimeMs += m.cpuTimeMs;
    average.builderDurationMs += m.builderDurationMs;

    min.wallTimeMs = Math.min(min.wallTimeMs, m.wallTimeMs);
    min.cpuTimeMs = Math.min(min.cpuTimeMs, m.cpuTimeMs);
    min.builderDurationMs = Math.min(min.builderDurationMs, m.builderDurationMs);

    max.wallTimeMs = Math.max(max.wallTimeMs, m.wallTimeMs);
    max.cpuTimeMs = Math.max(max.cpuTimeMs, m.cpuTimeMs);
    max.builderDurationMs = Math.max(max.builderDurationMs, m.builderDurationMs);

    // Memory - aggregate peak values
    for (const key of ["heapUsed", "heapTotal", "rss", "external"] as const) {
      average.memory[key].peak += m.memory[key].peak;
      average.memory[key].delta += m.memory[key].delta;

      min.memory[key].peak = Math.min(min.memory[key].peak, m.memory[key].peak);
      min.memory[key].delta = Math.min(min.memory[key].delta, m.memory[key].delta);

      max.memory[key].peak = Math.max(max.memory[key].peak, m.memory[key].peak);
      max.memory[key].delta = Math.max(max.memory[key].delta, m.memory[key].delta);
    }

    // Discovery statistics
    average.discoveryHits += m.discoveryHits;
    average.discoveryMisses += m.discoveryMisses;
    average.discoverySkips += m.discoverySkips;

    min.discoveryHits = Math.min(min.discoveryHits, m.discoveryHits);
    min.discoveryMisses = Math.min(min.discoveryMisses, m.discoveryMisses);
    min.discoverySkips = Math.min(min.discoverySkips, m.discoverySkips);

    max.discoveryHits = Math.max(max.discoveryHits, m.discoveryHits);
    max.discoveryMisses = Math.max(max.discoveryMisses, m.discoveryMisses);
    max.discoverySkips = Math.max(max.discoverySkips, m.discoverySkips);

    // File statistics
    average.totalFilesScanned += m.totalFilesScanned;
    average.gqlFilesFound += m.gqlFilesFound;
    average.elementCount += m.elementCount;

    min.totalFilesScanned = Math.min(min.totalFilesScanned, m.totalFilesScanned);
    min.gqlFilesFound = Math.min(min.gqlFilesFound, m.gqlFilesFound);
    min.elementCount = Math.min(min.elementCount, m.elementCount);

    max.totalFilesScanned = Math.max(max.totalFilesScanned, m.totalFilesScanned);
    max.gqlFilesFound = Math.max(max.gqlFilesFound, m.gqlFilesFound);
    max.elementCount = Math.max(max.elementCount, m.elementCount);
  }

  const count = metrics.length;

  // Compute averages
  average.wallTimeMs /= count;
  average.cpuTimeMs /= count;
  average.builderDurationMs /= count;

  for (const key of ["heapUsed", "heapTotal", "rss", "external"] as const) {
    average.memory[key].peak /= count;
    average.memory[key].delta /= count;
  }

  average.discoveryHits /= count;
  average.discoveryMisses /= count;
  average.discoverySkips /= count;

  average.totalFilesScanned /= count;
  average.gqlFilesFound /= count;
  average.elementCount /= count;

  return { average, min, max };
}

/**
 * Format bytes as human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Format milliseconds as human-readable string.
 */
function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a single metrics object for console output.
 */
function formatSingleMetrics(metrics: BuilderMetrics, label: string): string {
  return `
${label}:
  Timing:
    Wall time:      ${formatMs(metrics.wallTimeMs)}
    CPU time:       ${formatMs(metrics.cpuTimeMs)}
    Builder time:   ${formatMs(metrics.builderDurationMs)}

  Memory (peak):
    Heap used:      ${formatBytes(metrics.memory.heapUsed.peak)}
    Heap total:     ${formatBytes(metrics.memory.heapTotal.peak)}
    RSS:            ${formatBytes(metrics.memory.rss.peak)}
    External:       ${formatBytes(metrics.memory.external.peak)}

  Memory (delta):
    Heap used:      ${formatBytes(metrics.memory.heapUsed.delta)}
    Heap total:     ${formatBytes(metrics.memory.heapTotal.delta)}
    RSS:            ${formatBytes(metrics.memory.rss.delta)}

  Discovery:
    Hits:           ${metrics.discoveryHits}
    Misses:         ${metrics.discoveryMisses}
    Skips:          ${metrics.discoverySkips}

  Files:
    Total scanned:  ${metrics.totalFilesScanned}
    GQL files:      ${metrics.gqlFilesFound}
    Elements:       ${metrics.elementCount}
`.trim();
}

/**
 * Format benchmark result for human-readable console output.
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  const lines: string[] = [
    "Builder Runtime Benchmark",
    "=".repeat(60),
    "",
    `Fixture: ${result.fixture}`,
    `Timestamp: ${result.timestamp}`,
    `Iterations: ${result.iterations.length}`,
    "",
    "Scale:",
    `  Total files:    ${result.scale.totalFiles}`,
    `  GQL ratio:      ${(result.scale.gqlRatio * 100).toFixed(0)}%`,
    `  Object types:   ${result.scale.objectTypes}`,
    `  Models:         ${result.scale.models}`,
    `  Slices:         ${result.scale.slices}`,
    `  Operations:     ${result.scale.operations}`,
    "",
  ];

  const firstIteration = result.iterations[0];
  if (result.iterations.length === 1 && firstIteration) {
    lines.push(formatSingleMetrics(firstIteration.metrics, "Results"));
  } else {
    lines.push(formatSingleMetrics(result.average, "Average"));
    lines.push("");
    lines.push(formatSingleMetrics(result.min, "Minimum"));
    lines.push("");
    lines.push(formatSingleMetrics(result.max, "Maximum"));
  }

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
