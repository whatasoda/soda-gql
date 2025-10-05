# Builder Performance - Session Logs (October 2025)

## Session 1: Prerequisites & Strategy 1 (2025-10-04)

**Focus:** Benchmark infrastructure and session foundation

**Achievements:**
- Created 3-tier benchmark fixtures (small/medium/large apps)
  - small-app: 6 files, 2 operations
  - medium-app: 13 files, 6 operations
  - large-app: 25 files, 15 operations
- Built performance collection script with metrics
- Added CI workflow for nightly benchmarks
- Implemented `BuilderSession` with warm state
- Added `BuilderChangeSet` type with 100% test coverage
- Created module/definition-level adjacency tracking

**Commits:** `2fc0c61`, `f9c092b`, `894648d`, `a35d059`, `3d827c5`, `0544aaf`, `26ea45a`, `c3baf7b`, `6e1e52f`

**Key Decision:** V1 uses full rebuild fallback (correctness over performance)

---

## Session 2: Strategy 2 (2025-10-04)

**Focus:** Fingerprint-based cache optimization

**Achievements:**
- Implemented file fingerprinting (xxhash-wasm)
- Added stat-only fast path for unchanged files
- Integrated fingerprints into discovery cache
- Created cache stats tracking (hits/misses/skips)
- Achieved 100% cache hit rate after warmup

**Commits:** `0bf6837`, `24256e6`, `5bd43a8`, `dc1d678`, `c4069ac`

**Performance Impact:**
- Cache hits: stat() only (~100-500x faster)
- Cache misses: Full re-read + hash
- Proven: 100% hit rate after warmup across all fixtures

---

## Session 3: Strategy 3 Core (2025-10-04 - 2025-10-05)

**Focus:** Dependency graph pruning and chunk emission

**Achievements:**
- Created graph patcher infrastructure (9 tests)
- Built chunk planning and diffing (11 tests)
- Implemented artifact delta builder (11 tests)
- Added per-chunk emission (6 tests)
- Created chunk writer with transpilation (4 tests)
- Implemented graph differ (7 tests)
- Updated SessionState for incremental builds
- Wired incremental rebuild in update()

**Commits:** `bd7d8b5`, `05099d8`, `d2497ef`, `f509895`, `f36f160`, `0c37cc0`, `48f4826`, `cede6fc`, `3671d02`

**Test Coverage:** 48 unit tests, 100% coverage for core modules

---

## Session 4: Critical Bug Fixes (2025-10-05)

**Focus:** Evaluator lifecycle and import caching issues

**Achievements:**
- Fixed evaluator lifecycle isolation
  - Generated unique evaluatorId per session
  - Clear registry at start of builds
  - Thread evaluatorId through cache/registry
- Resolved gqlImportPath dynamic resolution
  - Extracted shared helper
  - Fix incremental path computation
- Fixed chunk manifest persistence
  - Persist before chunk creation
  - Update immediately after computing
- Fixed registry cleanup for removed chunks
  - Added removeModule() and clear()
  - Clear before loading chunks
- **Major fix:** Import cache issue
  - Discovered Bun caches imports despite query params
  - Solution: register() function pattern
  - Tests improved from 0/5 → 2/5 passing

**Commits:** `ba9533d`, `b99d3cf`, `71accab`, `05a5328`, `c945d8d`

**Key Insight:** Bun's import() caching requires explicit registry control

---

## Session 5: Path Resolution & Config Integration (2025-10-05)

**Focus:** Fix path resolution and integrate config system

**Achievements:**
- Discovered complete config implementation (commit `d218e27`)
  - 51 tests passing across 6 files
  - 100% coverage for all modules
- Fixed coercePaths and cache invalidation
  - Added path normalization helper
  - Fixed cache invalidation for removed files
  - Created unit tests (3/3 passing)
- Integrated config into builder
  - Made config required in BuilderInput (breaking)
  - Removed filesystem heuristics (findWorkspaceRoot)
  - Extension mapping: .ts → .js, .mts → .mjs
- Updated CLI for config loading
  - Load config at entry point
  - Pass to service and runner
  - Exit on config errors
- Created test infrastructure
  - Shared helper: createTestConfig()
  - Updated integration tests

**Commits:** `f777cac`, `021e7c2`, `38b6d04`

**Impact:**
- ✅ Path resolution **SOLVED**
- ✅ Integration tests: 1/5 passing (was 0/5)
- ⏳ 4 test files need config updates

---

## Session 6: Documentation Reorganization (2025-10-05)

**Focus:** Restructure docs for better organization and AI efficiency

**Phase 1 - Initial Reorganization:**
- Created builder-performance/ directory structure
- Moved historical docs to archives/
- Split progress tracking into focused files
- Updated all cross-references

**Phase 2 - AI Context Optimization:**
- Implemented tiered documentation (Tier 0/1/2)
- Created quick-brief README (<300 tokens)
- Consolidated metrics into single source
- Added metadata headers for query routing
- Reduced redundancy across files

**Commits:** `1de3a56`, (pending)

**Impact:**
- Cleaner information hierarchy
- Faster AI context loading
- Single source of truth for metrics
- Better query routing
