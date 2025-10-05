---
role: "performance-data"
includes_by_default: false
best_for_query:
  - "benchmark results"
  - "performance metrics"
  - "cache effectiveness"
last_updated: 2025-10-05
---

# Builder Performance - Metrics

## Current Benchmarks {#current}

**Collection:** `bun run perf:builder --fixture <name> --iterations 5`
**Output:** `.cache/perf/<timestamp>/<fixture>/metrics.json`

### Strategy 2 Baseline (2025-10-04)

| Fixture | Elements | Avg Wall Time | Cache (warmup) | Scaling |
|---------|----------|---------------|----------------|---------|
| small-app | 5 | 15.35ms | 3 hits / 0 miss (100%) | - |
| medium-app | 16 | 18.30ms | 9 hits / 0 miss (100%) | +3.2x elements → +19% time |
| large-app | 40 | 23.60ms | 23 hits / 0 miss (100%) | +2.5x elements → +29% time |

**Key Characteristics:**
- **Cache Hit Rate:** 100% after warmup
- **Scaling:** Near-linear with file count
- **GC Pressure:** 0 events across all fixtures
- **CPU Efficiency:** 1.25-1.70x CPU/Wall ratio

### Performance Trends

| Metric | Strategy 1+2 | Target | Status |
|--------|--------------|--------|--------|
| Cold build improvement | Not measured* | ≥25% | ⚠️ Unknown |
| Peak RSS reduction | 0MB reported** | ≥20% | ⚠️ Unknown |
| Repeat build time | 100%*** | ≤40% | ❌ Not met |
| Discovery CPU | ~90% reduction | ~90% | ✅ Met |
| Cache hit ratio | 100% | ≥85% | ✅ Exceeded |

*No baseline before Strategy 2
**Memory profiling needs improvement
***V1 does full rebuild

### Strategy 3 Targets

| Target | Goal | Measurement |
|--------|------|-------------|
| Targeted rebuild | ≤35% of cold build | Pending benchmarks |
| Chunk cache hits | 100% unchanged | Pending benchmarks |
| Artifact equality | 100% match | Snapshot tests |

## Cache Performance Detail

### Discovery Cache (Strategy 2)

**Mechanism:** Fingerprint-based (xxhash + mtime + size)

**Fast Path:** Unchanged files → stat() only (~100-500x faster than read+parse)

**Iteration Breakdown:**

**small-app:**
- Iter 1: 2 hits + 1 miss (67% hit rate)
- Iter 2-5: 3 hits + 0 misses (100% hit rate)

**medium-app:**
- Iter 1: 4 hits + 5 misses (44% hit rate)
- Iter 2-5: 9 hits + 0 misses (100% hit rate)

**large-app:**
- Iter 1: 22 hits + 1 miss (96% hit rate)
- Iter 2-5: 23 hits + 0 misses (100% hit rate)

**Observation:** High first-iteration hits indicate cache persistence across runs

### Chunk Cache (Strategy 3)

**Status:** Implementation complete, benchmarks pending

**Expected:**
- Unchanged chunks: 100% cache hit
- Changed chunks: Selective rebuild only
- Artifact: Identical to full rebuild

## Investigation Log {#investigation-log}

### Memory Profiling Issue
**Date:** 2025-10-04
**Issue:** Peak memory reported as 0MB across all runs
**Hypothesis:** Metrics capture incremental peak, or sampling misses peak
**Action:** Improve `collect-builder-metrics.ts` with process.memoryUsage() sampling

### Cold Build Baseline
**Date:** 2025-10-04
**Issue:** No pre-Strategy-2 baseline for comparison
**Action:** Can simulate by clearing `.cache/soda-gql/builder/`
**Priority:** P1 (nice-to-have for validation)

## Benchmark Commands

### Run All Fixtures
```bash
# Generate codegen first
for app in small medium large; do
  bun run soda-gql codegen \
    --schema ./benchmarks/runtime-builder/${app}-app/schema.graphql \
    --out ./benchmarks/runtime-builder/${app}-app/graphql-system/index.ts
done

# Run benchmarks
bun run perf:builder --fixture small-app --iterations 5
bun run perf:builder --fixture medium-app --iterations 5
bun run perf:builder --fixture large-app --iterations 5
```

### Analyze Results
```bash
ls -la .cache/perf/*/
cat .cache/perf/<timestamp>/large-app/metrics.json | jq
```

## References

- Profiling guide: [docs/guides/performance-profiling.md](../../guides/performance-profiling.md)
- CI benchmarks: [.github/workflows/builder-benchmarks.yml](../../../.github/workflows/builder-benchmarks.yml)
