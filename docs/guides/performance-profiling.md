# Performance Profiling Guide

This guide covers how to profile and benchmark the soda-gql builder for performance analysis and optimization.

## Table of Contents

- [Quick Start](#quick-start)
- [Type-check Benchmarks](#type-check-benchmarks)
- [Runtime Builder Benchmarks](#runtime-builder-benchmarks)
- [Interpreting Results](#interpreting-results)
- [CPU Profiling](#cpu-profiling)
- [Memory Profiling](#memory-profiling)
- [Best Practices](#best-practices)

## Quick Start

```bash
# Type-check benchmark (TypeScript compiler performance)
bun run perf:typecheck

# Runtime builder benchmark (builder execution performance)
bun run perf:builder --fixture small

# With multiple iterations for more accurate averages
bun run perf:builder --fixture medium --iterations 5
```

## Type-check Benchmarks

Type-check benchmarks measure TypeScript compiler performance when type-checking soda-gql generated types.

**Location:** `perf-measures/type-check/`

### Running Type-check Benchmarks

```bash
# Basic run with default fixtures
bun run perf:typecheck

# Generate new fixtures with custom sizes
bun run perf:typecheck --generate --objectTypes 20 --models 15

# JSON output for CI/scripting
bun run perf:typecheck --json

# Generate TypeScript trace files for analysis
bun run perf:typecheck --trace
```

### Analyzing Trace Files

When run with `--trace`, TypeScript trace files are saved to `perf-measures/type-check/.traces/`.

```bash
# Analyze with @typescript/analyze-trace
npx @typescript/analyze-trace perf-measures/type-check/.traces/trace-<timestamp>
```

## Runtime Builder Benchmarks

Runtime builder benchmarks measure the actual builder execution time, memory usage, and cache performance.

**Location:** `perf-measures/runtime-builder/`

### Fixture Presets

The benchmarks simulate realistic applications with varying scales:

| Preset | Total Files | GQL Files | Description |
|--------|-------------|-----------|-------------|
| small | 50 | 10 | Quick baseline testing |
| medium | 200 | 30 | Typical small project |
| large | 500 | 60 | Real-world complexity |
| xlarge | 1000 | 100 | Stress testing |

Fixtures include noise files (components, utils, hooks, types) that don't contain gql calls, simulating realistic codebases where most files are unrelated to GraphQL.

### Running Builder Benchmarks

```bash
# Small fixture (quick test)
bun run perf:builder --fixture small

# Medium fixture with multiple iterations
bun run perf:builder --fixture medium --iterations 5

# Large fixture with warm (incremental) builds
bun run perf:builder --fixture large --warm

# Extra-large fixture for stress testing
bun run perf:builder --fixture xlarge --iterations 3

# Custom fixture configuration
bun run perf:builder --fixture custom \
  --total-files 300 \
  --gql-ratio 0.1 \
  --object-types 40 \
  --models 20 \
  --slices 20 \
  --operations 20

# Force GC for accurate memory measurements
bun run perf:builder --fixture large --gc

# JSON output
bun run perf:builder --fixture medium --json
```

### Output Metrics

Builder benchmarks report:

**Timing:**
- Wall time: Total elapsed time
- CPU time: Actual CPU computation time
- Builder duration: Time reported by BuilderArtifact

**Memory:**
- Heap used (start/peak/end/delta)
- Heap total (start/peak/end/delta)
- RSS (start/peak/end/delta)

**Discovery:**
- Hits: Files found in cache
- Misses: Files requiring analysis
- Skips: Files not matching criteria

**Files:**
- Total files scanned
- GQL files found
- Elements generated

## Interpreting Results

### Key Metrics to Watch

**For cold builds:**
- Wall time: Primary performance indicator
- Memory peak: Maximum memory usage
- Discovery misses: Files requiring full analysis

**For warm builds:**
- Wall time vs cold: Should be significantly faster
- Discovery hits: Should be high (good caching)
- Memory delta: Memory growth per build

### Performance Targets

| Metric | Target |
|--------|--------|
| Cold build (medium) | < 500ms |
| Warm build (medium) | < 50ms |
| Memory peak (medium) | < 200MB |
| Discovery hit rate (warm) | > 90% |

### Variance Considerations

- Run at least 5 iterations for averages
- First iteration may be slower (JIT warmup)
- Use `--gc` flag for consistent memory measurements

## CPU Profiling

### Using Node.js Profiler

```bash
# Run with CPU profiling
node --cpu-prof --cpu-prof-dir=.cache/perf/profiles \
  scripts/perf/collect-builder-metrics.ts --fixture large
```

### Analyzing CPU Profiles

```bash
# Install speedscope
npm install -g speedscope

# Open profile
speedscope .cache/perf/profiles/CPU.*.cpuprofile
```

**What to look for:**
- Wide plateaus indicate optimization targets
- Deep stacks suggest complex call chains
- Repeated patterns may benefit from caching

## Memory Profiling

### Heap Snapshots

```bash
# Run with heap profiling
node --expose-gc --heap-prof --heap-prof-dir=.cache/perf/heap \
  scripts/perf/collect-builder-metrics.ts --fixture large
```

### Chrome DevTools Analysis

1. Open Chrome DevTools > Memory
2. Load heap snapshot from `.cache/perf/heap/`
3. Look for:
   - Retained size (memory not being freed)
   - Object growth across iterations
   - Unexpected large allocations

## Best Practices

### Benchmarking

1. **Warm-up runs:** First iteration may be slower
2. **Multiple iterations:** Use `--iterations 5` minimum
3. **Consistent environment:** Same hardware for comparisons
4. **Isolate changes:** Benchmark one optimization at a time
5. **Document baselines:** Save metrics before refactors

### Memory Measurements

1. **Use `--gc` flag:** Forces GC before each iteration
2. **Watch delta values:** Shows memory growth per build
3. **Compare cold vs warm:** Warm builds should have minimal memory growth

### Regression Detection

- Acceptable variance: ±5% wall time
- Warning threshold: >5% regression
- Failure threshold: >10% regression

## Output Locations

| Output | Location |
|--------|----------|
| Type-check traces | `perf-measures/type-check/.traces/` |
| Builder metrics | `.cache/perf/<timestamp>/<fixture>/metrics.json` |
| CPU profiles | `.cache/perf/profiles/` |
| Heap snapshots | `.cache/perf/heap/` |

## Troubleshooting

### High GC Time

- Check for excessive object allocation
- Review string concatenation patterns
- Consider object pooling for hot paths

### Memory Growth Across Iterations

- Likely a memory leak
- Use heap snapshots to identify retained objects
- Check for global state or closure captures

### CPU Time Much Lower Than Wall Time

- Indicates I/O or await blocking
- Profile async operations
- Consider parallelizing independent tasks

## Related Documentation

- [Performance Measurement Reference](../reference/perf-measures.md) - Quick reference for benchmark commands
- [Builder Flow](./builder-flow.md) - Builder architecture overview
