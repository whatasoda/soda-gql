---
role: "architecture"
includes_by_default: false
best_for_query:
  - "how does it work"
  - "architecture design"
  - "future strategies"
last_updated: 2025-10-05
---

# Builder Performance - Roadmap

## Objectives

Comprehensive performance overhaul through three sequential strategies:
1. Long-lived incremental service (session infrastructure)
2. Smarter discovery & cache invalidation (fingerprint-based)
3. Dependency-graph pruning with incremental codegen (chunk system)

**Philosophy:** Pre-release status allows breaking changes—ideal architecture over compatibility.

## Strategies Overview

### Strategy 1 - Session Infrastructure

**Goal:** Enable incremental builds with warm state

**Architecture:**
- `BuilderSession` maintains discovery cache, dependency graph, intermediate modules
- Adjacency maps (module + definition level) keyed by CanonicalId
- `BuilderChangeSet` tracks file additions/updates/removals
- Persistent cache in `.cache/soda-gql/builder/session.json`

**API:**
```typescript
BuilderSession {
  buildInitial(input): BuilderArtifact
  update(changeSet): BuilderArtifact
  getSnapshot(): SessionSnapshot
}
```

**Status:** ✅ V1 complete (full rebuild fallback, correctness first)

### Strategy 2 - Fingerprint Caching

**Goal:** Optimize discovery with stat-only fast path

**Architecture:**
- File fingerprint: `{ hash, size, mtimeMs }` via xxhash-wasm
- Cache validation: Fingerprint match → reuse snapshot (no file read)
- Explicit invalidation from BuilderChangeSet
- Version-aware purging (schema hash, analyzer version)

**Performance:**
```
Unchanged file:
  Before: readFileSync() + parse + hash  (~1-5ms)
  After:  statSync() only               (~0.01ms)
  Speedup: ~100-500x
```

**Status:** ✅ Complete (100% cache hits proven)

### Strategy 3 - Graph Pruning & Chunking

**Goal:** Selective rebuilds and incremental codegen

**Architecture:**
- **Graph Patcher:** Incremental graph updates (add/update/remove nodes)
- **Chunk Planner:** One chunk per source file
- **Chunk Writer:** Emit changed chunks only
- **Artifact Builder:** Load all chunks, rebuild artifact

**Chunk Flow:**
```
1. Diff graphs → DependencyGraphPatch
2. Apply patch → Updated graph
3. Plan chunks → ChunkManifest
4. Diff manifests → Changed chunks
5. Write chunks → .cache/.../modules/*.mjs
6. Load all chunks → Build artifact
```

**Why per-file chunks?**
- Aligns with file-level change detection
- Simpler invalidation logic
- Clean separation of concerns

**Status:** 🔄 Core complete, integration tests in progress

## Implementation Flow

```
Prerequisites (benchmarks + tooling)
    ↓
Strategy 1 (session infrastructure)
    ↓
Strategy 2 (fingerprints) ← requires session.update() API
    ↓
Strategy 3 (graph pruning) ← requires Strategy 1 + 2
    ↓
Config Package ← Strategy 3 path resolution dependency
```

**Critical Dependencies:**
- S2 feeds fingerprints into S1's update() path
- S3 uses S2 fingerprints for change detection
- S3 uses S1 session APIs for cache invalidation
- Config package enables S3 path resolution

## Performance Targets

### Strategy 1 Checkpoints
- ✅ Cold build: ≥25% improvement (via S2 fingerprints)
- ✅ Peak RSS: ≥20% reduction (efficient session state)
- ⚠️ Repeat build: ≤40% of cold (V1 doesn't meet, S3 will)

### Strategy 2 Checkpoints
- ✅ Discovery CPU: ~90% reduction (stat vs read+parse)
- ✅ Cache hit ratio: 100% (proven in benchmarks)
- ✅ Plugin config change: Triggers rebuild

### Strategy 3 Checkpoints
- ⏳ Targeted rebuild: ≤35% of S1 cold build
- ⏳ Chunk cache hits: 100% for unchanged
- ⏳ Artifact equality: 100% match with full rebuild

## Testing Strategy

### Unit Tests (48 passing for S3)
- Graph patcher: Add/update/remove nodes
- Chunk planner: File grouping, content hashing
- Artifact delta: Diff computation
- Session lifecycle: State management

### Integration Tests (2/5 passing for S3)
- Incremental session flow
- Config-driven builds
- Multi-chunk loading
- Zero-runtime mode

### Benchmarks
- Three fixtures: small (5 files), medium (16), large (40)
- Nightly CI: macOS + Linux
- Regression threshold: 5%
- Profiling: CPU (--cpu-prof), flame graphs (Clinic.js)

## Future Work (Post-Strategy 3)

### P1 - CLI Enhancement
- `--incremental` flag
- `--write-delta` debugging
- `--graph-filter` selective rebuilds

### P2 - Optimization
- File watcher integration (chokidar)
- Session persistence across processes
- Memory profiling improvements

### P2 - CI/CD
- Nightly benchmark automation
- PR performance comments
- Regression alerts (Slack)

## References

- Full plan: [reference/plan-original.md](./reference/plan-original.md)
- Current status: [progress.md](./progress.md)
- Decisions rationale: [decisions.md](./decisions.md)
- Performance data: [metrics.md](./metrics.md)
