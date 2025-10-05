# Builder Performance Optimization Plan

## Overview
This plan implements a comprehensive performance overhaul for the builder through three sequential strategies: long-lived incremental service, smarter discovery & cache invalidation, and dependency-graph pruning with incremental codegen. Each layer builds upon the previous one to unlock cumulative performance gains.

**Pre-release status**: Breaking changes are acceptable. We will implement the ideal architecture directly without backward compatibility layers, feature flags, or rollback mechanisms. Any issues will be handled through git version control.

## Prerequisites & Tooling
- Create deterministic fixtures in benchmarks/small-app, benchmarks/medium-app, benchmarks/large-app that mirror real project shapes and commit them with README instructions; wire a Bun script perf:builder in package.json that runs `bun run scripts/perf/collect-builder-metrics.ts --mode runtime --fixture <name>` to produce baseline JSON and CPU profiles via `node --cpu-prof`.
- Add scripts/perf/collect-builder-metrics.ts to invoke packages/cli/src/index.ts builder command, wrap execution with Node's PerformanceObserver, and emit CPU/heap stats; persist raw results under .cache/perf/<timestamp>.
- Add a docs/guides/performance-profiling.md walkthrough covering baseline setup, `clinic flame --collect` usage, and how to diff `speedscope` traces; reference this doc from docs/plans/README.md.
- Integrate benchmark execution into CI by adding a GitHub workflow at .github/workflows/builder-benchmarks.yml that runs nightly on macOS and linux, uploads JSON metrics, and flags regressions beyond 5% to Slack via existing scripts/common.sh hooks.

## Strategy 1 – Long-Lived Incremental Service
- Add packages/builder/src/service/session.ts defining BuilderSession { load, update, dispose } that owns discovery cache, dependency graph, and intermediate module state; expose warm state via adjacency maps keyed by CanonicalId.
- Refactor packages/builder/src/service.ts so createBuilderService wraps a shared BuilderSession and exposes a new update(changes: BuilderChangeSet) alongside existing build(); surface BuilderChangeSet type in packages/builder/src/types.ts.
- Extend packages/builder/src/runner.ts to skip full pipeline rebuild when update() reports no affected nodes; reuse cached ModuleAnalysis and IntermediateModule outputs by default.
- Introduce packages/builder/src/dependency-graph/adjacency.ts that materializes both module-level and definition-level adjacency sets on first load and keeps inverse edges needed for incremental updates.
- Update packages/cli/src/commands/builder.ts to accept `--watch` and `--incremental-cache-dir` flags, and add packages/cli/src/watch/builder-watch.ts using chokidar to translate fs events into BuilderChangeSet batches dispatched to the shared session.
- Persist discovery cache across process restarts by extending packages/builder/src/cache/module-cache.ts to store per-module AST hashes and adjacency segments under .cache/soda-gql/builder/session.json.
- Record design notes and public API contracts in docs/guides/builder-incremental.md (session lifecycle, thread-safety, expected cache dirs) and add release entry in docs/plan-history.

## Strategy 2 – Smarter Discovery & Cache Invalidation
- Introduce packages/builder/src/discovery/fingerprint.ts that computes FileFingerprint { hash, size, mtimeMs } with lazy hashing (xxhash-wasm) and memoizes results in memory.
- Extend packages/builder/src/discovery/cache.ts to persist fingerprints per entry and short-circuit module loading when fingerprint unchanged; add a diagnostic log to packages/builder/src/debug/debug-writer.ts showing hit/miss counts.
- Modify packages/builder/src/discovery/discoverer.ts to accept explicit invalidation requests derived from BuilderChangeSet (created/updated/deleted) and to avoid touching the filesystem when deletion already handled.
- Enhance packages/builder/src/cache/json-cache.ts to version stored fingerprints and purge stale entries when analyzer or schema configuration changes; add schemaVersion computation in packages/builder/src/discovery/common.ts.
- Update packages/plugin-babel/src/state.ts to pass analyzer + plugin option hash into the builder fingerprint key and to call session.update() with transform-specific invalidations when artifact hashes mismatch.
- Add CLI command `bun run soda-gql builder --show-cache` (wired in packages/cli/src/commands/builder.ts) that prints fingerprint stats and instructions for clearing caches, aiding support.

## Strategy 3 – Dependency Graph Pruning & Incremental Codegen
- Split buildDependencyGraph in packages/builder/src/dependency-graph/builder.ts so it can construct definition-level adjacency lazily and emit a pruned subset for affected CanonicalIds only; store the full graph once per session.
- Add packages/builder/src/dependency-graph/prune.ts implementing selective traversal based on include/exclude predicates and dependency depth thresholds; ensure integration tests cover optional fragments.
- Restructure packages/builder/src/intermediate-module/index.ts to emit per-module chunks under .cache/soda-gql/builder/modules/<id>.ts and stitch them lazily; update createIntermediateModule to only regenerate changed modules.
- Optimize packages/builder/src/artifact/generator.ts to consume chunked intermediate modules and emit incremental artifact diffs; add CLI flag `--write-delta` for debugging partial outputs.
- Update tests/integration/runtime_builder_flow.test.ts and tests/integration/zero_runtime_transform.test.ts to assert adjacency pruning and incremental codegen invariants using new helper assertions in tests/utils/graph.ts.
- Document configuration toggles (`--incremental`, `--graph-filter`, `--write-delta`) in docs/guides/builder-incremental.md and surface defaults in packages/cli/src/commands/builder.ts help output.

## Implementation Order & Dependencies
- Complete Prerequisites before Strategy 1 to ensure baseline metrics exist.
- Strategy 1 must ship before Strategy 2 so that fingerprints feed the session update() path.
- Strategy 3 depends on Strategy 1 session APIs for cache invalidations and on Strategy 2 fingerprints for change detection; do not ship chunked codegen until session stability validated over two benchmark passes.
- Parallel asset pipeline and Map segregation from the previous plan remain optional stretch goals once incremental codegen is stable; track them as follow-up issues.

## Checkpoints & Acceptance Criteria
- Checkpoint S1 (end of Strategy 1): baseline fixture benchmarks/large-app cold build improves ≥25% wall time and peak RSS drops ≥20% compared to v0.1.0; repeat build in same process completes in ≤40% of cold build.
- Checkpoint S2 (end of Strategy 2): discovery phase cpu-prof samples drop ≥40% vs Strategy 1 baseline and cache hit ratio ≥85% on unchanged reruns; stale plugin-babel option change triggers rebuild within one pass.
- Checkpoint S3 (end of Strategy 3): targeted rebuild touching ≤5% of documents finishes in ≤35% of Strategy 1 cold build time and emits delta artifact identical to full rebuild artifact in tests/utils/snapshot.ts comparisons.
- Acceptance Criteria: CLI exposes session-backed `--watch`, builder returns identical artifacts for runtime and zero-runtime modes, benchmark automation reports green for three consecutive nightly runs, and instrumentation data is archived in .cache/perf.

## Testing & Verification
- Extend tests/integration/builder_cache_flow.test.ts to cover session.update() by simulating file edits and verifying minimal rebuild counts.
- Add new tests/integration/builder_watch_mode.test.ts exercising CLI watch flow with chokidar mocked timers.
- Augment unit tests in packages/builder/src/dependency-graph/__tests__ to cover adjacency pruning and cycle detection with incremental updates.
- Introduce regression test in tests/contract to ensure zero-runtime mode never emits runtime import by snapshotting generated code.
- Add manual QA checklist in docs/guides/performance-profiling.md that includes running `clinic flame` and verifying plugin-babel transforms in examples/runtime-app.

## Plugin-Babel Integration Focus
- Update packages/plugin-babel/src/options.ts to use shared BuilderSession and hash plugin version + config into BuilderChangeSet.
- Add instrumentation in packages/plugin-babel/src/metadata/collector.ts to log missing artifact definitions under DEBUG.
- Document the new incremental builder architecture in docs/guides/builder-incremental.md with usage examples.

## Timeline Estimate
- Strategy 1: 2.0 weeks (0.5 instrumentation, 1.1 implementation, 0.4 testing/docs)
- Strategy 2: 1.5 weeks (0.4 fingerprint plumbing, 0.7 integration, 0.4 tests/docs)
- Strategy 3: 2.0 weeks (1.0 graph/codegen refactor, 0.6 incremental artifact work, 0.4 tests/docs)
- Hardening buffer: 0.5 week for benchmark tuning and documentation
- **Total: 6.0 weeks** with nightly benchmarks providing validation gates

## Implementation Philosophy
- **Direct replacement**: Replace existing code with optimized implementations directly
- **No feature flags**: All changes are permanent; no dual-path maintenance
- **Git-based rollback**: If issues arise, revert commits rather than maintaining compatibility layers
- **Breaking changes welcome**: Focus on ideal architecture without legacy constraints
- **Test-driven validation**: Rely on comprehensive test suite and benchmarks to ensure correctness
