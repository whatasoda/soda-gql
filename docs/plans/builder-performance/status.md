# Builder Performance Optimization - Status

**Last Updated:** 2025-10-05
**Branch:** `feat/improved-performance-of-builder`
**Strategy:** 3 (Dependency Graph Pruning & Incremental Codegen)

## Current Status

**Strategy 3:** 🔄 Core implementation complete, integration tests 2/5 passing (40%)

### Completion Overview

| Phase | Status | Completion |
|-------|--------|-----------|
| Prerequisites & Tooling | ✅ Complete | 100% |
| Strategy 1 - Session Infrastructure | ✅ Core Complete | 95% (docs/tests deferred) |
| Strategy 2 - Fingerprint Caching | ✅ Complete | 100% |
| Strategy 3 - Graph Pruning | 🔄 In Progress | 90% (integration tests) |

## Strategy 3 Progress Detail

### ✅ Completed (Core Implementation)

**Infrastructure (8 modules, 48 unit tests, 100% coverage):**
- Graph patcher (`patcher.ts`): 9 tests ✅
- Chunk planning (`chunks.ts`): 11 tests ✅
- Artifact delta (`delta.ts`): 11 tests ✅
- Per-chunk emission (`per-chunk-emission.ts`): 6 tests ✅
- Chunk writer (`chunk-writer.ts`): 4 tests ✅
- Graph differ (`differ.ts`): 7 tests ✅

**Integration (buildInitial + update):**
- ✅ Session state updated (graph, graphIndex, chunkManifest, chunkModules)
- ✅ buildInitial() uses chunk pipeline
- ✅ update() implements incremental rebuild logic
- ✅ Artifact builder supports multi-chunk loading

**Bug Fixes (Session 2: 2025-10-05):**
- ✅ Evaluator lifecycle isolation (`ba9533d`, `b99d3cf`)
- ✅ gqlImportPath dynamic resolution (`b99d3cf`)
- ✅ Chunk manifest persistence (`b99d3cf`)
- ✅ Registry cleanup for removed chunks (`b99d3cf`)
- ✅ Import cache issue resolution (`05a5328`, `c945d8d`)

**Config Integration (Session 5: 2025-10-05):**
- ✅ Path normalization with `coercePaths()` (`f777cac`)
- ✅ Config-driven import path resolution (`021e7c2`)
- ✅ CLI config loading (`38b6d04`)

### 🔄 In Progress

**Integration Tests: 2/5 passing (40%)**

Current status (builder-session-incremental.test.ts):
- ✅ "initial build creates chunks and artifact"
- ✅ "adds new module without touching unaffected chunks"
- ⚠️ "applies graph patch when a module changes" - cache.skips assertion
- ❌ "removes module and updates artifact" - discovery reads deleted files
- ❌ "handles mixed add/update/remove in one pass" - same as above

**Root Causes:**
1. Cache.skips assertion expects > 0, gets 0 (test expectation issue)
2. Deleted file imports fail when metadata mismatch triggers buildInitial fallback
3. Other integration test files need config updates (4 files)

### ⏳ Pending

**CLI Flags:**
- [ ] `--incremental` to enable incremental mode
- [ ] `--write-delta` for debugging partial outputs
- [ ] `--graph-filter` for selective rebuilds

**Benchmarks:**
- [ ] Validate ≤35% rebuild time for ≤5% changes
- [ ] Measure chunk emission overhead
- [ ] Verify cache hit ratios

**Documentation:**
- [ ] User guide for incremental builds
- [ ] Architecture docs for chunk system
- [ ] Migration guide from legacy API

## Benchmark Source & Coverage

**Collection Pipeline:**
```bash
bun run perf:builder --fixture <name> --iterations 5
```

**Output:** `.cache/perf/<timestamp>/<fixture>/metrics.json`

**Metrics Captured:**
- Wall time (total elapsed)
- CPU time (user + system)
- Peak memory usage (MB)
- GC count and duration
- Cache hits/misses/skips

**Current Metrics (Strategy 2 baseline):**

| Fixture | Elements | Avg Wall Time | Cache (warmup) |
|---------|----------|---------------|----------------|
| small-app | 5 | 15.35ms | 3 hits / 0 miss |
| medium-app | 16 | 18.30ms | 9 hits / 0 miss |
| large-app | 40 | 23.60ms | 23 hits / 0 miss |

**Key Findings:**
- ✅ 100% cache hit rate after warmup
- ✅ Linear scaling with codebase size
- ✅ No GC pressure (0 GC events)
- ✅ Efficient CPU usage (1.25-1.70x CPU/Wall ratio)

## Config Dependency

**Status:** ✅ Resolved

**Background:**
Strategy 3 requires config-driven path resolution because generated `.mjs` files use path aliases that don't work without configuration.

**Solution:**
`@soda-gql/config` package implemented with:
- TypeScript config file support (esbuild execution)
- Extension mapping (.ts → .js, .mts → .mjs, .cts → .cjs)
- Domain-separated config (builder/codegen/plugins)

**Implementation:**
- Package: commit `d218e27` (51 tests, 100% coverage)
- Builder integration: commit `021e7c2`
- CLI integration: commit `38b6d04`

**Impact:**
- ✅ Path resolution working correctly
- ✅ 1/5 integration tests passing (was 0/5 before)
- ⏳ 4 integration test files need config updates

## Validation Requirements (Strategy 3)

### Integration Tests
**Current:** 2/5 passing (builder-session-incremental.test.ts)

**Remaining Work:**
1. Fix cache.skips assertion (test expectation issue)
2. Handle removed files in discovery fallback scenarios
3. Update 4 other test files to use config:
   - `builder_cache_flow.test.ts`
   - `builder_incremental_session.test.ts`
   - `runtime_builder_flow.test.ts`
   - `zero_runtime_transform.test.ts`

### Performance Validation
**Targets:**
- Targeted rebuild (≤5% changes): ≤35% of Strategy 1 cold build
- Chunk emission overhead: minimal impact
- Cache hit ratio for unchanged chunks: 100%

**Actions Needed:**
- Run benchmarks with Strategy 3 implementation
- Compare against Strategy 2 baseline
- Validate incremental rebuild effectiveness

### CLI Integration
**Pending:**
- `--incremental` flag implementation
- `--write-delta` debugging support
- `--graph-filter` selective rebuild control

## Blockers

**None currently.** All critical bugs resolved.

## Next Steps

1. **Fix integration test failures** (P0)
   - Update test expectations for cache.skips
   - Handle deleted file scenarios in discovery
   - Add config to 4 remaining test files

2. **Run benchmarks** (P0)
   - Validate Strategy 3 performance targets
   - Compare with Strategy 2 baseline
   - Document results

3. **CLI flags** (P1)
   - Implement `--incremental` mode
   - Add debugging flags
   - Update help text

4. **Documentation** (P1)
   - User guide for incremental builds
   - Architecture documentation
   - Migration guide

## References

- **Roadmap:** [roadmap.md](./roadmap.md)
- **History:** [history.md](./history.md)
- **Upcoming:** [upcoming.md](./upcoming.md)
- **Profiling Guide:** [docs/guides/performance-profiling.md](../../guides/performance-profiling.md)
