# Performance Measurement Reference

This document provides a quick reference for soda-gql's performance measurement tools.

## Overview

soda-gql provides two benchmark suites:

1. **Type-check benchmarks** (`perf:typecheck`) - Measures TypeScript compiler performance on soda-gql types
2. **Runtime builder benchmarks** (`perf:builder`) - Measures builder execution performance

## Quick Reference

### Type-check Benchmarks

**Location:** `perf-measures/type-check/`

**Commands:**
```bash
# Run with defaults
bun run perf:typecheck

# Regenerate fixtures
bun run perf:typecheck --generate

# JSON output
bun run perf:typecheck --json

# Generate TypeScript trace files
bun run perf:typecheck --trace

# Custom fixture sizes
bun run perf:typecheck --objectTypes 20 --models 15 --slices 10 --operations 8
```

**CLI Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--generate` | false | Force regenerate fixtures |
| `--json` | false | Output as JSON |
| `--trace` | false | Generate TypeScript trace files |
| `--objectTypes <n>` | 10 | Number of GraphQL object types |
| `--models <n>` | 10 | Number of models |
| `--slices <n>` | 8 | Number of slices |
| `--operations <n>` | 5 | Number of operations |

**Output Metrics:**
- Check time, Parse time, Bind time, Total time
- Memory used
- Files, Lines, Identifiers, Symbols
- Type instantiations

### Runtime Builder Benchmarks

**Location:** `perf-measures/runtime-builder/`

**Commands:**
```bash
# Run with small preset
bun run perf:builder --fixture small

# Run with larger fixtures
bun run perf:builder --fixture medium
bun run perf:builder --fixture large
bun run perf:builder --fixture xlarge

# Multiple iterations for averages
bun run perf:builder --fixture medium --iterations 5

# Include warm (incremental) builds
bun run perf:builder --fixture large --warm

# JSON output
bun run perf:builder --fixture small --json

# Force regenerate fixtures
bun run perf:builder --fixture medium --generate

# Force GC between iterations (for accurate memory measurements)
bun run perf:builder --fixture large --gc

# Custom fixture configuration
bun run perf:builder --fixture custom --total-files 300 --gql-ratio 0.1 --object-types 40
```

**CLI Options:**

*Preset Selection:*
| Option | Default | Description |
|--------|---------|-------------|
| `--fixture <name>` | small | Preset name: small, medium, large, xlarge |

*Custom Configuration (override preset):*
| Option | Description |
|--------|-------------|
| `--total-files <n>` | Total number of files to generate |
| `--gql-ratio <0-1>` | Ratio of files containing gql calls |
| `--object-types <n>` | Number of GraphQL object types |
| `--models <n>` | Number of models |
| `--slices <n>` | Number of slices |
| `--operations <n>` | Number of operations |

*Execution Options:*
| Option | Default | Description |
|--------|---------|-------------|
| `--iterations <n>` | 1 | Number of iterations |
| `--json` | false | Output as JSON |
| `--generate` | false | Force regenerate fixtures |
| `--warm` | false | Include warm (incremental) builds |
| `--gc` | false | Force GC before each iteration |

**Output Metrics:**

*Timing:*
- Wall time (total elapsed time)
- CPU time (actual CPU computation)
- Builder duration (from BuilderArtifact.report)

*Memory:*
- Heap used (start, peak, end, delta)
- Heap total (start, peak, end, delta)
- RSS (start, peak, end, delta)
- External (start, peak, end, delta)

*Discovery:*
- Hits (cache hits)
- Misses (cache misses)
- Skips (files skipped)

*Files:*
- Total files scanned
- GQL files found
- Elements generated

## Fixture Presets

Builder benchmarks simulate realistic applications with noise files (non-gql files) mixed with gql-containing files.

| Preset | Total Files | GQL Files | GQL Ratio | Types | Models | Slices | Operations |
|--------|-------------|-----------|-----------|-------|--------|--------|------------|
| small | 50 | 10 | 20% | 10 | 5 | 5 | 5 |
| medium | 200 | 30 | 15% | 30 | 15 | 15 | 15 |
| large | 500 | 60 | 12% | 60 | 30 | 30 | 30 |
| xlarge | 1000 | 100 | 10% | 100 | 50 | 50 | 50 |

**Noise Files Generated:**
- `src/components/*.ts` - React component-like files
- `src/utils/*.ts` - Utility function files
- `src/hooks/*.ts` - Hook-like files
- `src/types/*.ts` - Type definition files

**GQL Files Generated:**
- `src/entities/model*.ts` - Model definitions
- `src/entities/slice*.ts` - Slice definitions
- `src/pages/operation*.ts` - Operation definitions

## Output Locations

| Benchmark | Output |
|-----------|--------|
| Type-check traces | `perf-measures/type-check/.traces/` |
| Builder metrics | `.cache/perf/<timestamp>/<fixture>/metrics.json` |

## Implementation Details

### Type-check Benchmark (`perf-measures/type-check/`)

- Uses `tsc --diagnostics` to collect compiler metrics
- Generates synthetic GraphQL schema, models, slices, operations
- Optionally generates trace files for `@typescript/analyze-trace`

**Files:**
- `scripts/run.ts` - Main CLI entry
- `scripts/generate-fixtures.ts` - Fixture generation
- `scripts/process-results.ts` - Result parsing and formatting
- `client.ts` - Type inference target

### Builder Benchmark (`perf-measures/runtime-builder/`)

- Uses `BuilderSession.build()` to measure build performance
- Generates realistic app structure with noise files
- Tracks detailed memory usage via `process.memoryUsage()`
- Reports metrics from `BuilderArtifact.report`

**Files:**
- `scripts/run.ts` - Main CLI entry
- `scripts/generate-fixtures.ts` - Fixture generation with noise files
- `scripts/process-results.ts` - Metrics types and formatting

## Related Documentation

- [Performance Profiling Guide](../guides/performance-profiling.md) - Detailed profiling techniques
- [Builder Flow](../guides/builder-flow.md) - Builder architecture overview
