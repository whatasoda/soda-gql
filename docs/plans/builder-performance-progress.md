# Builder Performance Optimization - Progress Report

**Status:** In Progress - Prerequisites & Tooling Complete
**Last Updated:** 2025-10-03
**Branch:** `feat/improved-performance-of-builder`
**Plan:** [builder-performance-optimization.md](./builder-performance-optimization.md)

## Overview

This document tracks the implementation progress of the builder performance optimization plan, which consists of three sequential strategies plus prerequisites.

## Implementation Status

### ✅ Prerequisites & Tooling (Complete)

**Commit:** `2fc0c61` - "feat(perf): add benchmark infrastructure and tooling"

#### Benchmark Fixtures
Created three deterministic benchmark fixtures in `benchmarks/runtime-builder/`:

- **small-app** (Baseline)
  - 6 files total (1 schema, 1 entity, 2 operations, 2 configs)
  - 1 entity (Product), 3 types
  - 2 operations (1 query, 1 mutation)
  - Schema: ~15 LOC
  - Location: `benchmarks/runtime-builder/small-app/`

- **medium-app** (Intermediate)
  - 13 files total (1 schema, 3 entities, 6 operations, 2 configs)
  - 3 entities (Product, Order, Category), 12 types
  - 6 operations (3 queries, 2 mutations, 1 subscription)
  - Schema: ~110 LOC
  - Location: `benchmarks/runtime-builder/medium-app/`

- **large-app** (Real-world complexity)
  - 25 files total (1 schema, 6 entities, 15 operations, 2 configs)
  - 6 entities (Product, Category, Brand, Order, User, Review, Cart), 28 types
  - 15 operations (9 queries, 5 mutations, 2 subscriptions)
  - Schema: ~350 LOC
  - Feature-based organization (cart, reviews modules)
  - Location: `benchmarks/runtime-builder/large-app/`

**Fixture Design:**
- Manually created with deterministic structure
- Fixed naming conventions (alphabetically sorted)
- Consistent formatting across all files
- No dynamic timestamps or random values
- Each includes README with usage instructions

#### Performance Collection Script
Created `scripts/perf/collect-builder-metrics.ts`:

**Features:**
- CLI arguments: `--fixture <name> --iterations <n>`
- Metrics collected:
  - Wall time (total elapsed time)
  - CPU time (user + system)
  - Peak memory usage (MB)
  - GC count and duration
  - Average wall time (for multiple iterations)
- Integration with Node.js PerformanceObserver
- Memory tracking via interval sampling
- Output: JSON to `.cache/perf/<timestamp>/<fixture>/metrics.json`

**Usage:**
```bash
bun run perf:builder --fixture small-app --iterations 5
```

#### CLI Integration
Updated `package.json`:
- Added `perf:builder` script pointing to collection script
- Integrated with existing build system

#### Documentation
Created `docs/guides/performance-profiling.md`:

**Contents:**
- Quick start guide
- Benchmark fixture descriptions
- Running benchmarks (basic and advanced)
- CPU profiling with Node.js `--cpu-prof`
- Flame graphs with Clinic.js
- Memory profiling (heap snapshots, Chrome DevTools)
- Metrics interpretation and regression detection
- CI integration details
- Troubleshooting common issues
- Best practices for benchmarking

#### CI Automation
Created `.github/workflows/builder-benchmarks.yml`:

**Features:**
- **Schedule:** Nightly runs at 2 AM UTC
- **Manual dispatch:** Support fixture and iteration selection
- **Platforms:** Ubuntu and macOS runners
- **Workflow:**
  1. Setup Bun and install dependencies
  2. Generate GraphQL runtime for all fixtures (codegen)
  3. Run benchmarks (5 iterations default)
  4. Collect and aggregate results
  5. Check for regressions (5% threshold)
  6. Upload artifacts (30-day retention)
  7. Notify on regressions (Slack integration placeholder)

**Outputs:**
- Per-OS benchmark results as artifacts
- Aggregated summary report
- GitHub PR comments on regressions
- Slack notifications (to be configured)

### 🔄 Strategy 1 - Long-Lived Incremental Service (Not Started)

**Target:** 2.0 weeks
**Status:** Pending

**Planned Tasks:**
- [ ] Create `BuilderSession` in `packages/builder/src/service/session.ts`
  - Maintain in-memory discovery cache
  - Track file fingerprints
  - Store dependency adjacency (module + definition level)
  - Expose `{ buildInitial, update }` API

- [ ] Add `BuilderChangeSet` type to `packages/builder/src/types.ts`
  - Fields: `added`, `updated`, `removed`
  - Metadata: schema hash, analyzer version

- [ ] Refactor `createBuilderService` in `packages/builder/src/service.ts`
  - Lazily instantiate session scoped to config
  - Expose `build()` using `session.buildInitial()`
  - Add `update(changeSet)` returning `Result<BuilderArtifact, BuilderError>`

- [ ] Split `buildPipeline` in `packages/builder/src/runner.ts`
  - Separate discovery, graph build, intermediate, artifact steps
  - Allow cached module injection to skip recomputation

- [ ] Implement adjacency tracking in `packages/builder/src/dependency-graph/adjacency.ts`
  - Build bidirectional maps (module + definition level)
  - Identify impacted nodes during updates

- [ ] Extend module cache in `packages/builder/src/cache/module-cache.ts`
  - Persist session snapshot to `.cache/soda-gql/builder/session.json`
  - Store adjacency signature + metadata

- [ ] Add CLI `--watch` flag to `packages/cli/src/commands/builder.ts`
  - Parse `--watch` and `--incremental-cache-dir`

- [ ] Create `packages/cli/src/watch/builder-watch.ts`
  - Use chokidar for file watching
  - Emit change batches with debouncing
  - Call service `update()`

- [ ] Write documentation in `docs/guides/builder-incremental.md`
  - Session lifecycle
  - CLI flags
  - Cache directories

- [ ] Add tests:
  - Unit: `packages/builder/src/service/__tests__/session.test.ts`
  - Integration: `tests/integration/builder_cache_flow.test.ts`
  - CLI: `tests/integration/builder_watch_mode.test.ts`
  - Benchmark validation: Run `perf:builder` and verify targets

**Performance Targets:**
- Cold build: ≥25% wall time improvement
- Peak RSS: ≥20% reduction
- Repeat build: ≤40% of cold build time

### ⏳ Strategy 2 - Smarter Discovery & Cache Invalidation (Not Started)

**Target:** 1.5 weeks
**Status:** Pending (requires Strategy 1)

**Planned Tasks:**
- [ ] Create `packages/builder/src/discovery/fingerprint.ts`
  - Implement `computeFingerprint(path)` with lazy xxhash-wasm
  - Memoize in-memory map keyed by path

- [ ] Enhance discovery cache in `packages/builder/src/discovery/cache.ts`
  - Store fingerprints + version metadata
  - Include analyzer version, schema hash, plugin options hash

- [ ] Modify `discoverModules` in `packages/builder/src/discovery/discoverer.ts`
  - Accept explicit invalidations from BuilderChangeSet
  - Skip re-reading when fingerprint unchanged
  - Record diagnostic counters

- [ ] Add logging in `packages/builder/src/debug/debug-writer.ts`
  - Emit cache hit/miss metrics

- [ ] Add CLI `--show-cache` flag to `packages/cli/src/commands/builder.ts`
  - Print aggregated fingerprint stats
  - Show cache clearing instructions

- [ ] Update plugin-babel integration
  - Compute configuration fingerprints
  - Reuse session from service
  - Call `update` on output divergence

- [ ] Add tests:
  - Unit: `packages/builder/src/discovery/__tests__/fingerprint.test.ts`
  - Integration: `tests/integration/builder_fingerprint_cache.test.ts`
  - CLI: `tests/integration/cli_show_cache.test.ts`
  - Plugin: Extend `tests/plugin-babel/state.test.ts`

**Performance Targets:**
- Discovery CPU: ≥40% reduction vs Strategy 1
- Cache hit ratio: ≥85% on unchanged reruns
- Stale plugin option changes trigger rebuild within one pass

### ⏳ Strategy 3 - Dependency Graph Pruning & Incremental Codegen (Not Started)

**Target:** 2.0 weeks
**Status:** Pending (requires Strategy 1 & 2)

**Planned Tasks:**
- [ ] Refactor `packages/builder/src/dependency-graph/builder.ts`
  - Separate full graph construction from incremental pruning
  - Expose affected subgraph retrieval

- [ ] Create `packages/builder/src/dependency-graph/prune.ts`
  - Selective traversal predicates (include/exclude IDs, depth limits)
  - Cycle detection on partial graphs

- [ ] Decompose intermediate module emitter in `packages/builder/src/intermediate-module/index.ts`
  - Emit per-module chunks to `.cache/soda-gql/builder/modules/<canonical-id>.ts`
  - Lazy composition of runtime modules

- [ ] Modify artifact builder in `packages/builder/src/artifact/`
  - Accept changed chunks
  - Emit delta results

- [ ] Add CLI flags
  - `--write-delta` for debugging partial outputs
  - `--incremental`, `--graph-filter`

- [ ] Update CLI help text with new defaults

- [ ] Add tests:
  - Unit: `packages/builder/src/dependency-graph/__tests__/prune.test.ts`
  - Integration: Extend `tests/integration/runtime_builder_flow.test.ts`
  - Delta output: `tests/integration/builder_delta_output.test.ts`
  - Zero-runtime regression: Update `tests/integration/zero_runtime_transform.test.ts`
  - Benchmark gating: Verify ≤35% rebuild time

**Performance Targets:**
- Targeted rebuild (≤5% documents): ≤35% of Strategy 1 cold build time
- Artifact equality validation via snapshot tests

## Timeline

- **Prerequisites:** ✅ Complete (0.5 week actual)
- **Strategy 1:** 🔄 Pending (2.0 weeks estimated)
- **Strategy 2:** ⏳ Waiting (1.5 weeks estimated)
- **Strategy 3:** ⏳ Waiting (2.0 weeks estimated)
- **Hardening:** ⏳ Waiting (0.5 week buffer)
- **Total:** 6.0 weeks estimated

## Key Decisions & Notes

### Architecture Decisions
- **Direct replacement approach:** No feature flags or dual-path maintenance
- **Git-based rollback:** Revert commits instead of compatibility layers
- **Breaking changes welcome:** Focus on ideal architecture (pre-release status)
- **Test-driven validation:** Comprehensive test suite ensures correctness

### Technical Constraints
- Use Bun for all operations (not npm/yarn)
- Follow TDD methodology (RED → GREEN → REFACTOR)
- Use neverthrow error handling (ok()/err() only, NO fromPromise)
- NO classes for state management, prefer pure functions
- Behavioral testing (test execution results, not output format)
- Use fixture-based testing (tests/fixtures/**/*.ts)

### Dependencies
- Strategy 1 must complete before Strategy 2 (session APIs required)
- Strategy 2 builds on Strategy 1 (fingerprints feed session updates)
- Strategy 3 depends on both 1 & 2 (cache invalidation + change detection)

## Files Created

### Benchmark Fixtures (51 files)
```
benchmarks/runtime-builder/
├── small-app/
│   ├── README.md
│   ├── schema.graphql
│   ├── tsconfig.json
│   ├── babel.config.js
│   └── src/
│       ├── entities/product.ts
│       └── pages/
│           ├── product-list.page.ts
│           └── product-create.mutation.ts
├── medium-app/
│   ├── README.md
│   ├── schema.graphql
│   ├── tsconfig.json
│   ├── babel.config.js
│   └── src/
│       ├── entities/
│       │   ├── product.ts
│       │   ├── order.ts
│       │   └── category.ts
│       └── pages/ (6 operations)
└── large-app/
    ├── README.md
    ├── schema.graphql
    ├── tsconfig.json
    ├── babel.config.js
    └── src/
        ├── entities/ (6 files)
        ├── pages/ (12 operations)
        └── features/
            ├── cart/ (4 files)
            └── reviews/ (1 file)
```

### Tooling & Documentation
```
scripts/perf/collect-builder-metrics.ts
docs/guides/performance-profiling.md
.github/workflows/builder-benchmarks.yml
package.json (updated)
```

## Next Steps

To continue this work in a new session:

1. **Review completed work:**
   ```bash
   git log --oneline -1  # View last commit (2fc0c61)
   git show 2fc0c61      # See changes
   ```

2. **Start Strategy 1 implementation:**
   - Consult Codex for detailed implementation strategy
   - Begin with BuilderSession design (`packages/builder/src/service/session.ts`)
   - Follow TDD: Write tests first, then implementation

3. **Reference documents:**
   - Plan: `docs/plans/builder-performance-optimization.md`
   - Progress: `docs/plans/builder-performance-progress.md` (this file)
   - Profiling guide: `docs/guides/performance-profiling.md`

4. **Run baseline benchmarks (optional):**
   ```bash
   # Generate codegen for fixtures first
   bun run soda-gql codegen --schema ./benchmarks/runtime-builder/large-app/schema.graphql \
     --out ./benchmarks/runtime-builder/large-app/graphql-system/index.ts

   # Run benchmark
   bun run perf:builder --fixture large-app --iterations 5
   ```

5. **Verify environment:**
   ```bash
   git status                    # Should be on feat/improved-performance-of-builder
   git log --oneline -5          # Recent commits
   bun test                      # Ensure tests pass
   ```

## References

- **Plan:** [builder-performance-optimization.md](./builder-performance-optimization.md)
- **Profiling Guide:** [docs/guides/performance-profiling.md](../guides/performance-profiling.md)
- **ADR-001:** [Zero-runtime plan](../decisions/001-zero-runtime-plan.md)
- **Codex:** Use `mcp__codex__codex` for implementation guidance

## Session Handoff Context

**Branch:** `feat/improved-performance-of-builder` (19 commits ahead of main)
**Last commit:** `2fc0c61` - "feat(perf): add benchmark infrastructure and tooling"
**Working directory:** Clean (all changes committed)
**Next task:** Strategy 1 - Long-Lived Incremental Service

**Recommended approach:**
1. Use Codex MCP (`mcp__codex__codex`) to analyze current builder architecture
2. Request detailed implementation strategy for BuilderSession
3. Follow TDD: Write tests, implement features, refactor
4. Commit incrementally as each component completes
5. Run benchmarks to validate performance targets

**Important notes:**
- All communication with Codex MUST be in English
- Translate user requests to English before sending to Codex
- Save conversationId (UUID) for follow-ups with `mcp__codex__codex-reply`
- NO file modifications without Codex guidance for code tasks
