# Builder Performance Optimization

**Status:** In Progress - Strategy 3 integration tests in progress
**Branch:** `feat/improved-performance-of-builder`
**Last Updated:** 2025-10-05

## Overview

This directory contains documentation for the builder performance optimization initiative, which implements three sequential strategies to improve build performance:

1. **Strategy 1:** Long-lived incremental service (session infrastructure)
2. **Strategy 2:** Smarter discovery & cache invalidation (fingerprint-based caching)
3. **Strategy 3:** Dependency graph pruning & incremental codegen

## Documentation

- **[Roadmap](./roadmap.md)** - Strategic overview, objectives, and implementation timeline
- **[Status](./status.md)** - Current progress, metrics, and blockers
- **[History](./history.md)** - Completed milestones and session summaries
- **[Upcoming](./upcoming.md)** - Prioritized future work with dependencies
- **[Original Plan](./plan-original.md)** - Canonical detailed implementation plan

## Quick Links

- **Profiling Guide:** [docs/guides/performance-profiling.md](../../guides/performance-profiling.md)
- **Archives:** [docs/plans/archives/builder-performance/](../archives/builder-performance/)

## Benchmark Data Sources

Performance metrics are collected via `bun run perf:builder` and stored in `.cache/perf/<timestamp>/<fixture>/metrics.json`. The benchmark pipeline:

1. Runs builder on fixtures (small-app, medium-app, large-app)
2. Collects wall time, CPU time, memory usage, GC stats
3. Tracks cache hits/misses/skips for discovery phase
4. Generates JSON reports for regression analysis

### Key Metrics (as of 2025-10-05)

| Fixture | Elements | Avg Wall Time | Cache (warmup) |
|---------|----------|---------------|----------------|
| small-app | 5 | 15.35ms | 3 hits / 0 miss |
| medium-app | 16 | 18.30ms | 9 hits / 0 miss |
| large-app | 40 | 23.60ms | 23 hits / 0 miss |

**Performance Characteristics:**
- Linear scaling with codebase size
- 100% cache hit rate after warmup
- stat-only fast path for unchanged files (~100-500x speedup)

## Dependencies

**Strategy 3 Config Dependency:**
Strategy 3 requires the `@soda-gql/config` package for path resolution. The config system:
- Replaces CLI parameters with configuration files
- Enables proper import path resolution for generated files
- Status: ✅ Implemented (commit `d218e27`, 51 tests passing)
- Integration: ✅ Complete (commits `f777cac`, `021e7c2`, `38b6d04`)

See [config-package-implementation.md](../config-package-implementation.md) for full details.
