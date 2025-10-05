# Builder Performance Optimization - Roadmap

**Document:** Strategic roadmap and implementation timeline
**Source:** Derived from [plan-original.md](./plan-original.md)

## Objectives

Implement comprehensive performance overhaul through three sequential strategies:
1. Long-lived incremental service
2. Smarter discovery & cache invalidation
3. Dependency-graph pruning with incremental codegen

**Pre-release status:** Breaking changes acceptable. Ideal architecture takes priority over backward compatibility.

## Strategies Overview

### Strategy 1 - Long-Lived Incremental Service

**Goal:** Build session infrastructure for incremental builds

**Key Components:**
- `BuilderSession` with warm state (discovery cache, dependency graph, intermediate modules)
- `BuilderChangeSet` type for tracking file changes
- Session persistence across builds
- Module-level and definition-level adjacency tracking
- CLI `--watch` and `--incremental-cache-dir` flags

**Deliverables:**
- Session-based service API with `load()`, `update()`, `dispose()`
- Adjacency maps keyed by CanonicalId
- Persistent cache in `.cache/soda-gql/builder/session.json`

### Strategy 2 - Smarter Discovery & Cache Invalidation

**Goal:** Optimize file discovery with fingerprint-based caching

**Key Components:**
- File fingerprint computation (xxhash-wasm: hash + size + mtime)
- stat-only fast path for unchanged files
- Explicit invalidation from BuilderChangeSet
- Cache hit/miss/skip tracking
- Schema version and plugin option hashing

**Deliverables:**
- Fingerprint-based cache validation
- Diagnostic logging with hit/miss counts
- CLI `--show-cache` flag for debugging
- Version-aware cache purging

### Strategy 3 - Dependency Graph Pruning & Incremental Codegen

**Goal:** Selective rebuilds and chunked code generation

**Key Components:**
- Lazy definition-level adjacency construction
- Graph pruning with include/exclude predicates
- Per-module chunk emission (`.cache/soda-gql/builder/modules/<id>.ts`)
- Incremental artifact diffs
- Selective module regeneration

**Deliverables:**
- Graph pruning with depth thresholds
- Chunked intermediate modules
- CLI flags: `--incremental`, `--write-delta`, `--graph-filter`
- Delta artifact debugging

## Implementation Order & Dependencies

```
Prerequisites (benchmarks + tooling)
    ↓
Strategy 1 (session infrastructure)
    ↓
Strategy 2 (fingerprint caching) ← requires Strategy 1 session API
    ↓
Strategy 3 (graph pruning) ← requires Strategy 1 + 2
```

**Critical Dependencies:**
- Strategy 2 feeds fingerprints into Strategy 1's `update()` path
- Strategy 3 uses Strategy 2 fingerprints for change detection
- Strategy 3 uses Strategy 1 session APIs for cache invalidation
- **Config package:** Strategy 3 depends on `@soda-gql/config` for path resolution

## Performance Checkpoints

### Checkpoint S1 (Strategy 1 Complete)
- ✅ Cold build: ≥25% wall time improvement
- ✅ Peak RSS: ≥20% reduction
- ✅ Repeat build: ≤40% of cold build time

### Checkpoint S2 (Strategy 2 Complete)
- ✅ Discovery CPU: ≥40% reduction vs Strategy 1
- ✅ Cache hit ratio: ≥85% on unchanged reruns
- ✅ Plugin config change triggers rebuild in one pass

### Checkpoint S3 (Strategy 3 Complete)
- ⏳ Targeted rebuild (≤5% changes): ≤35% of Strategy 1 cold build
- ⏳ Delta artifact matches full rebuild (snapshot tests)
- ⏳ Unchanged chunks: 100% cache hit ratio

### Acceptance Criteria
- CLI exposes session-backed `--watch`
- Identical artifacts for runtime/zero-runtime modes
- 3 consecutive green nightly benchmark runs
- Instrumentation data archived in `.cache/perf/`

## Timeline Estimate

| Phase | Duration | Focus Areas |
|-------|----------|-------------|
| **Prerequisites** | 0.5 week | Fixtures, metrics, CI, docs |
| **Strategy 1** | 2.0 weeks | Session, adjacency, CLI watch |
| **Strategy 2** | 1.5 weeks | Fingerprints, cache, invalidation |
| **Strategy 3** | 2.0 weeks | Graph pruning, chunking, incremental |
| **Hardening** | 0.5 week | Benchmarks, docs |
| **Total** | **6.0 weeks** | |

**Actual Progress (as of 2025-10-05):**
- Prerequisites: ✅ 0.5 week
- Strategy 1: ✅ Core complete (tests/docs deferred)
- Strategy 2: ✅ 1 session (vs 1.5 weeks)
- Strategy 3: 🔄 2 sessions (core + bugs, integration tests in progress)
- **Elapsed:** ~3.5 weeks

## Config Package Dependency

**Requirement:** Strategy 3 needs config-driven path resolution for generated imports.

**Why:** Generated `.mjs` files use path aliases (`@/graphql-system`, `@soda-gql/core`) that don't resolve without config.

**Solution:** `@soda-gql/config` package provides:
- TypeScript config file support (executed via esbuild)
- File extension mapping (.ts → .js)
- Domain-separated config (builder/codegen/plugins)
- Multi-project workspace support

**Status:**
- ✅ Package implementation complete (commit `d218e27`)
- ✅ Builder integration complete (commits `021e7c2`, `38b6d04`)
- ✅ 51 tests passing, 100% coverage

See [config-package-implementation.md](../config-package-implementation.md) for details.

## Testing Strategy

### Unit Tests
- Session lifecycle and state management
- Fingerprint computation and caching
- Adjacency graph construction
- Graph pruning predicates
- Chunk manifest diffing

### Integration Tests
- Cache flow (session reuse scenarios)
- Watch mode (chokidar + file changes)
- Zero-runtime mode (no runtime imports)
- Plugin-babel integration
- Incremental rebuild correctness

### Benchmarks
- Three fixtures: small-app, medium-app, large-app
- Nightly CI runs (macOS + Linux)
- Regression detection (5% threshold)
- CPU profiling with `--cpu-prof`
- Flame graphs via Clinic.js

## References

- **Detailed Plan:** [plan-original.md](./plan-original.md)
- **Current Status:** [status.md](./status.md)
- **Profiling Guide:** [docs/guides/performance-profiling.md](../../guides/performance-profiling.md)
