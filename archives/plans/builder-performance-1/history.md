---
role: "milestones"
includes_by_default: false
best_for_query:
  - "timeline"
  - "what happened when"
  - "past milestones"
last_updated: 2025-10-05
---

# Builder Performance - History

## Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| 2025-10-04 | Prerequisites & Tooling | ✅ Complete |
| 2025-10-04 | Strategy 1 Core | ✅ Complete |
| 2025-10-04 | Strategy 2 | ✅ Complete |
| 2025-10-05 | Strategy 3 Core | ✅ Complete |
| 2025-10-05 | Strategy 3 Bug Fixes | ✅ Complete |
| 2025-10-05 | Config Integration | ✅ Complete |
| 2025-10-05 | Doc Reorganization | ✅ Complete |

## Milestones & Key Decisions

### Prerequisites (2025-10-04)
**Delivered:** 3-tier fixtures, perf collection, CI automation, profiling docs
**Key Decision:** Deterministic fixtures for reproducible benchmarks

### Strategy 1 - Session Infrastructure (2025-10-04)
**Delivered:** BuilderSession, BuilderChangeSet, adjacency tracking
**Key Decision:** V1 full rebuild fallback (correctness first)
**Trade-off:** Doesn't meet 40% target, but provides foundation

### Strategy 2 - Fingerprint Caching (2025-10-04)
**Delivered:** xxhash fingerprints, stat-only fast path, 100% cache hits
**Key Decision:** Fingerprint = hash + mtime + size
**Impact:** ~100-500x faster for unchanged files

### Strategy 3 - Graph Pruning (2025-10-04 - 2025-10-05)
**Delivered:** 48 unit tests, chunk system, incremental rebuild
**Key Decision:** One chunk per file (not per module)
**Trade-off:** More chunks, simpler invalidation

### Critical Fixes (2025-10-05)
**Delivered:** Evaluator isolation, import cache fix, registry cleanup
**Key Discovery:** Bun caches imports despite query params
**Solution:** register() function pattern

### Config Integration (2025-10-05)
**Delivered:** Path resolution fix, config system integration
**Key Decision:** Required config in BuilderInput (breaking change)
**Impact:** Path aliases resolved correctly

## Performance Evolution

### Strategy 1+2 Combined
- Wall time: 15-24ms (small to large)
- Cache hits: 100% after warmup
- Scaling: Linear with file count
- CPU efficiency: 1.25-1.70x ratio

### Strategy 3 (Pending Benchmarks)
- Target: ≤35% rebuild time
- Expected: 100% chunk cache hits
- Validation: Snapshot tests for artifact equality

## Session Details

See [reference/history/2025-10-sessions.md](./reference/history/2025-10-sessions.md) for detailed session logs.

## References

- Current status: [progress.md](./progress.md)
- Architecture: [roadmap.md](./roadmap.md)
- Decisions: [decisions.md](./decisions.md)
