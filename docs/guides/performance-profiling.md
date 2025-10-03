# Performance Profiling Guide

This guide covers how to profile and benchmark the soda-gql builder for performance analysis and optimization.

## Table of Contents

- [Quick Start](#quick-start)
- [Benchmark Fixtures](#benchmark-fixtures)
- [Running Benchmarks](#running-benchmarks)
- [Analyzing Results](#analyzing-results)
- [CPU Profiling with Node.js](#cpu-profiling-with-nodejs)
- [Flame Graphs with Clinic.js](#flame-graphs-with-clinicjs)
- [Memory Profiling](#memory-profiling)
- [Interpreting Metrics](#interpreting-metrics)
- [CI Integration](#ci-integration)

## Quick Start

Run a basic performance benchmark:

```bash
# Run benchmark for small fixture (single iteration)
bun run perf:builder --fixture small-app

# Run multiple iterations for more accurate averages
bun run perf:builder --fixture medium-app --iterations 5

# Run large-scale benchmark
bun run perf:builder --fixture large-app --iterations 3
```

## Benchmark Fixtures

Three deterministic fixtures are available in `benchmarks/runtime-builder/`:

### Small App
- **Scale:** 1 entity, 3 types, 2 operations
- **Files:** 6 total (1 schema, 1 entity, 2 operations, 2 configs)
- **Schema:** ~15 LOC
- **Use case:** Baseline performance testing, quick iterations

### Medium App
- **Scale:** 3 entities, 12 types, 6 operations
- **Files:** 13 total (1 schema, 3 entities, 6 operations, 2 configs)
- **Schema:** ~110 LOC
- **Use case:** Intermediate complexity testing, typical small project

### Large App
- **Scale:** 6 entities, 28 types, 15 operations
- **Files:** 25 total (1 schema, 6 entities, 15 operations, 2 configs)
- **Schema:** ~350 LOC
- **Use case:** Real-world complexity testing, performance stress testing

## Running Benchmarks

### Basic Usage

```bash
# Single run
bun run perf:builder --fixture small-app

# Multiple iterations (recommended for stability)
bun run perf:builder --fixture medium-app --iterations 10
```

### Output

Metrics are saved to `.cache/perf/<timestamp>/<fixture>/metrics.json`:

```json
{
  "fixture": "medium-app",
  "timestamp": "2025-10-03T12:34:56.789Z",
  "wallTime": 1234.56,
  "cpuTime": 1100.23,
  "peakMemoryMB": 128.45,
  "gcCount": 12,
  "gcDurationMs": 45.67,
  "iterations": 5,
  "averageWallTime": 1250.34
}
```

## Analyzing Results

### Key Metrics

- **Wall Time:** Total elapsed time (includes I/O, GC, etc.)
- **CPU Time:** Actual CPU computation time
- **Peak Memory:** Maximum heap usage during execution
- **GC Count:** Number of garbage collection cycles
- **GC Duration:** Total time spent in garbage collection

### Performance Targets (from optimization plan)

**Strategy 1 (Long-Lived Incremental Service):**
- Cold build: ≥25% improvement in wall time
- Peak RSS: ≥20% reduction
- Repeat build: ≤40% of cold build time

**Strategy 2 (Smarter Discovery & Cache Invalidation):**
- Discovery CPU: ≥40% reduction vs Strategy 1
- Cache hit ratio: ≥85% on unchanged reruns

**Strategy 3 (Dependency Graph Pruning & Incremental Codegen):**
- Targeted rebuild (≤5% of documents): ≤35% of Strategy 1 cold build time

## CPU Profiling with Node.js

Generate CPU profiles using Node's built-in profiler:

```bash
# Run with CPU profiling
node --cpu-prof --cpu-prof-dir=.cache/perf/profiles \
  scripts/perf/collect-builder-metrics.ts --fixture large-app
```

### Analyzing CPU Profiles

1. Install `speedscope`:
```bash
npm install -g speedscope
```

2. Open profile:
```bash
speedscope .cache/perf/profiles/CPU.*.cpuprofile
```

3. Look for:
   - Hot paths (functions taking most time)
   - Unexpected call stacks
   - Synchronous I/O blocking

## Flame Graphs with Clinic.js

For advanced profiling, use Clinic.js:

### Installation

```bash
npm install -g clinic
```

### Flame Graph Generation

```bash
# Generate flame graph
clinic flame --collect-only -- bun run perf:builder --fixture medium-app

# View results
clinic flame --visualize-only <pid>.clinic-flame
```

### Interpreting Flame Graphs

- **Width:** Time spent in function (wider = more time)
- **Height:** Call stack depth
- **Color:** Different modules/packages
- Look for:
  - Wide plateaus (optimization targets)
  - Unexpected deep stacks
  - Repeated patterns (potential for caching)

### Bubble Graph (for async operations)

```bash
clinic bubbleprof --collect-only -- bun run perf:builder --fixture large-app
clinic bubbleprof --visualize-only <pid>.clinic-bubbleprof
```

## Memory Profiling

### Heap Snapshots

```bash
# Run with heap snapshots
node --expose-gc --heap-prof --heap-prof-dir=.cache/perf/heap \
  scripts/perf/collect-builder-metrics.ts --fixture large-app
```

### Chrome DevTools

1. Generate heap snapshot:
```bash
bun run perf:builder --fixture large-app
```

2. Open Chrome DevTools > Memory > Load snapshot
3. Look for:
   - Retained size (memory not being freed)
   - Shallow size (direct object size)
   - Memory leaks (objects growing over iterations)

## Interpreting Metrics

### Baseline Comparison

Before optimization:
```bash
bun run perf:builder --fixture large-app --iterations 5 > baseline.txt
```

After changes:
```bash
bun run perf:builder --fixture large-app --iterations 5 > optimized.txt
diff baseline.txt optimized.txt
```

### Regression Detection

Acceptable variance: ±5% wall time
Warning threshold: >5% regression
Failure threshold: >10% regression

### Statistical Significance

Run at least 5 iterations to account for:
- JIT warm-up effects
- System load variance
- GC timing variations

## CI Integration

Automated benchmarks run nightly via `.github/workflows/builder-benchmarks.yml`:

- **Platforms:** macOS, Ubuntu
- **Fixtures:** All three scales
- **Iterations:** 5 per fixture
- **Regression checks:** Compares against previous baseline
- **Notifications:** Slack alerts on >5% regression

### Manual CI Run

```bash
# Trigger via GitHub Actions
gh workflow run builder-benchmarks.yml
```

### Accessing CI Results

Benchmark artifacts are uploaded as JSON:
```bash
gh run download <run-id> --name benchmark-results
```

## Best Practices

1. **Warm-up runs:** First iteration may be slower (JIT compilation)
2. **Multiple iterations:** Use `--iterations 5` minimum for averages
3. **Consistent environment:** Run on same hardware for comparisons
4. **Isolate changes:** Benchmark one optimization at a time
5. **Document baselines:** Save metrics before major refactors
6. **Monitor trends:** Track metrics over time, not just point-in-time

## Troubleshooting

### High GC Time (>10% of wall time)

- Check for excessive object allocation
- Review string concatenation patterns
- Consider object pooling for hot paths

### Memory Growth Across Iterations

- Likely a memory leak
- Use heap snapshots to identify retained objects
- Check for global state or closure captures

### CPU Time Much Lower Than Wall Time

- Indicates I/O or await blocking
- Profile async operations with bubbleprof
- Consider parallelizing independent tasks

## Related Documentation

- [Builder Incremental Guide](./builder-incremental.md) - Incremental build architecture
- [Optimization Plan](../plans/builder-performance-optimization.md) - Full optimization roadmap
- [ADR-001](../decisions/001-zero-runtime-plan.md) - Zero-runtime architecture decisions

## References

- [Node.js CPU Profiling](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Clinic.js Documentation](https://clinicjs.org/documentation/)
- [Chrome DevTools Memory Profiler](https://developer.chrome.com/docs/devtools/memory-problems/)
- [speedscope](https://www.speedscope.app/)
