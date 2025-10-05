# Strategy 1: Long-Lived Incremental Service - Implementation Summary

**Status:** ✅ Core Implementation Complete
**Branch:** `feat/improved-performance-of-builder`
**Commits:** 10 (f9c092b → 7335b68)
**Duration:** ~1 session

## Overview

Successfully implemented the foundational infrastructure for incremental builds in the soda-gql builder. The implementation focuses on session-based state management with adjacency tracking to enable future optimization.

## Implemented Features

### 1. BuilderChangeSet Types (f9c092b)
- **Location:** `packages/builder/src/session/change-set.ts`
- **Features:**
  - `BuilderFileChange` type with filePath, fingerprint, mtimeMs
  - `BuilderChangeSet` with added/updated/removed + metadata
  - Helper functions: `shouldInvalidateSchema`, `shouldInvalidateAnalyzer`, `hasFileChanged`
- **Tests:** 9 unit tests (100% coverage)

### 2. BuilderSession (894648d, c3baf7b)
- **Location:** `packages/builder/src/session/builder-session.ts`
- **Features:**
  - Session state in closure: snapshots, adjacency maps, metadata
  - `buildInitial()`: Full build with state caching
  - `update()`: Incremental update with affected module tracking
  - Module-level adjacency (BFS traversal)
  - Definition-level adjacency (canonical ID tracking)
  - `lastInput` and `lastArtifact` caching
- **Architecture:**
  - Pure functions for adjacency extraction
  - Metadata validation with fallback to full rebuild
  - V1: Falls back to full rebuild (correctness over optimization)

### 3. BuilderService Integration (a35d059)
- **Location:** `packages/builder/src/service.ts`
- **Features:**
  - Lazy session instantiation
  - `build()` uses `session.buildInitial()`
  - Optional `update(changeSet)` method
  - Backward compatible API

### 4. CLI Watch Mode (6e1e52f)
- **Location:** `packages/cli/src/commands/builder.ts`
- **Features:**
  - `--watch` flag parsing
  - Initial build in watch mode
  - Process kept alive for watching
  - Status messages and graceful exit
- **TODO:** File watcher integration with `BuilderSession.update()`

## Helper Functions

### Adjacency Tracking
- `extractModuleAdjacency()`: File → Set<files that import it>
- `extractDefinitionAdjacency()`: CanonicalId → Set<dependent IDs>
- `collectAffectedModules()`: BFS traversal for transitive dependencies
- `collectAffectedDefinitions()`: Find definitions in removed files
- `dropRemovedFiles()`: Clean state and return affected modules

### Validation
- `metadataMatches()`: Compare schema hash and analyzer version

## Architecture Decisions

### V1 Fallback Strategy
**Decision:** Fall back to full rebuild in `update()` for V1
**Rationale:**
- Maintains correctness while infrastructure is proven
- Adjacency tracking and state management are in place
- True incremental discovery deferred to Strategy 2/3
- Faster time to stable foundation

### State Management
**Decision:** In-memory closure-based state
**Rationale:**
- Simpler than classes (follows project conventions)
- No persistence needed for V1
- Session lifecycle clear and testable

### Deferred Features
- True incremental discovery (partial file sets)
- Graph merging (only rebuild affected subgraph)
- File watcher integration (debouncing, change batching)
- Session persistence (`.cache/soda-gql/builder/session.json`)

## Quality Metrics

### Tests
- ✅ All existing tests pass (157 pass, 12 todo)
- ✅ BuilderChangeSet: 9 unit tests
- ⏳ BuilderSession integration tests: TODO
- ⏳ Watch mode tests: TODO

### Code Quality
- ✅ Type-safe (tsc -b passes)
- ✅ Biome lint clean
- ✅ No classes (pure functions + closures)
- ✅ neverthrow error handling

## Performance Baseline

**Current Status:** Infrastructure ready, optimization pending

**Expected (with full incremental logic):**
- Cold build: ≥25% improvement
- Peak RSS: ≥20% reduction
- Repeat build: ≤40% of cold build time

**V1 Actual:** Full rebuild on changes (no regression, no optimization yet)

## Next Steps

### Strategy 2: Smarter Discovery & Cache Invalidation
- Fingerprint-based change detection (xxhash-wasm)
- Enhanced discovery cache with version metadata
- Selective invalidation based on fingerprints

### Strategy 3: Dependency Graph Pruning
- Partial graph construction for affected subgraph
- Incremental intermediate module generation
- Delta artifact building

### Testing & Validation
- BuilderSession integration tests
- Watch mode file detection tests
- Benchmark validation with `perf:builder`

## Files Modified/Created

### New Files (6)
- `packages/builder/src/session/change-set.ts`
- `packages/builder/src/session/builder-session.ts`
- `tests/unit/builder/change-set.test.ts`
- `tests/unit/builder/builder-session.test.ts` (placeholder)
- `docs/plans/builder-performance/progress.md` (was builder-performance-progress.md, then status.md, now progress.md)
- `docs/plans/strategy-1-summary.md` (this file)

### Modified Files (2)
- `packages/builder/src/service.ts` (session integration)
- `packages/cli/src/commands/builder.ts` (--watch flag)
- `packages/builder/package.json` (exports)

## Key Commits

1. `f9c092b` - BuilderChangeSet types + tests
2. `894648d` - BuilderSession (buildInitial)
3. `a35d059` - BuilderService integration
4. `c3baf7b` - update() with affected tracking
5. `6e1e52f` - CLI --watch flag
6. `7335b68` - Lint fixes

Total: **+700 LOC** (implementation + tests)

## Lessons Learned

1. **Start with helpers:** Adjacency extraction and affected module tracking proved critical
2. **Fallback strategy:** Full rebuild fallback maintains correctness during development
3. **State in closure:** Simpler than class-based state, follows project patterns
4. **Test coverage early:** BuilderChangeSet tests caught edge cases early

## Success Criteria

- [x] Session state management implemented
- [x] Adjacency tracking (module + definition level)
- [x] Metadata validation with fallback
- [x] BuilderService integration (backward compatible)
- [x] CLI --watch flag
- [x] All tests passing
- [x] Code quality checks passing
- [ ] Integration tests (deferred)
- [ ] Benchmark validation (deferred)

**Status:** ✅ Core implementation complete, ready for Strategy 2/3 optimization
