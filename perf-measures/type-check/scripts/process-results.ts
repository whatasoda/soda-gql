#!/usr/bin/env bun

export interface DiagnosticsMetrics {
  files: number;
  lines: number;
  identifiers: number;
  symbols: number;
  types: number;
  instantiations: number;
  memoryUsed: number; // in bytes
  ioReadTime: number; // in seconds
  ioWriteTime: number; // in seconds
  parseTime: number; // in seconds
  bindTime: number; // in seconds
  checkTime: number; // in seconds
  emitTime: number; // in seconds
  totalTime: number; // in seconds
}

export interface BenchmarkResult {
  timestamp: string;
  fixtures: {
    types: number;
    models: number;
    slices: number;
    operations: number;
  };
  metrics: DiagnosticsMetrics;
}

/**
 * Parse tsc --diagnostics output into structured metrics
 *
 * Example output:
 * Files:            123
 * Lines:          45678
 * Identifiers:    12345
 * Symbols:        67890
 * Types:           9876
 * Instantiations: 54321
 * Memory used:   123456K
 * I/O read:        0.05s
 * I/O write:       0.01s
 * Parse time:      0.12s
 * Bind time:       0.34s
 * Check time:      1.23s
 * Emit time:       0.00s
 * Total time:      1.75s
 */
export function parseDiagnostics(output: string): DiagnosticsMetrics {
  const metrics: DiagnosticsMetrics = {
    files: 0,
    lines: 0,
    identifiers: 0,
    symbols: 0,
    types: 0,
    instantiations: 0,
    memoryUsed: 0,
    ioReadTime: 0,
    ioWriteTime: 0,
    parseTime: 0,
    bindTime: 0,
    checkTime: 0,
    emitTime: 0,
    totalTime: 0,
  };

  const patterns: Record<keyof DiagnosticsMetrics, RegExp> = {
    files: /Files:\s*(\d+)/,
    lines: /Lines:\s*(\d+)/,
    identifiers: /Identifiers:\s*(\d+)/,
    symbols: /Symbols:\s*(\d+)/,
    types: /Types:\s*(\d+)/,
    instantiations: /Instantiations:\s*(\d+)/,
    memoryUsed: /Memory used:\s*(\d+)K/,
    ioReadTime: /I\/O read:\s*([\d.]+)s/,
    ioWriteTime: /I\/O write:\s*([\d.]+)s/,
    parseTime: /Parse time:\s*([\d.]+)s/,
    bindTime: /Bind time:\s*([\d.]+)s/,
    checkTime: /Check time:\s*([\d.]+)s/,
    emitTime: /Emit time:\s*([\d.]+)s/,
    totalTime: /Total time:\s*([\d.]+)s/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern);
    if (match?.[1]) {
      const value = parseFloat(match[1]);
      if (key === "memoryUsed") {
        // Convert KB to bytes
        metrics[key] = value * 1024;
      } else {
        metrics[key as keyof DiagnosticsMetrics] = value;
      }
    }
  }

  return metrics;
}

/**
 * Format metrics for human-readable console output
 */
export function formatMetrics(metrics: DiagnosticsMetrics): string {
  const formatNumber = (n: number): string => n.toLocaleString();
  const formatTime = (s: number): string => `${(s * 1000).toFixed(1)}ms`;
  const formatMemory = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

  return `
Results:
  Instantiations:  ${formatNumber(metrics.instantiations)}
  Types:           ${formatNumber(metrics.types)}
  Symbols:         ${formatNumber(metrics.symbols)}

  Check time:      ${formatTime(metrics.checkTime)}
  Parse time:      ${formatTime(metrics.parseTime)}
  Bind time:       ${formatTime(metrics.bindTime)}
  Total time:      ${formatTime(metrics.totalTime)}

  Memory used:     ${formatMemory(metrics.memoryUsed)}
  Files:           ${formatNumber(metrics.files)}
  Lines:           ${formatNumber(metrics.lines)}
`.trim();
}

// CLI entry point - read from stdin
if (import.meta.main) {
  const input = await Bun.stdin.text();
  const metrics = parseDiagnostics(input);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log(formatMetrics(metrics));
  }
}
