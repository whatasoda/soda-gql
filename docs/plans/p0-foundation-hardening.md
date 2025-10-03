# P0 Foundation Hardening - Strategy 1 Completion Plan

**Status:** 📋 Planning
**Branch:** `feat/improved-performance-of-builder`
**Target:** Complete before Strategy 2
**Created:** 2025-10-03

## Executive Summary

Strategy 1 (Long-Lived Incremental Service) has established the core infrastructure for incremental builds, but three critical issues must be resolved before proceeding to Strategy 2 (Smarter Discovery & Cache Invalidation). This plan addresses those P0 tasks to ensure a solid foundation for optimization work.

## Background & Context

### Current State

**What We've Built:**
- `BuilderSession` with state management (snapshots, adjacency maps, metadata)
- `BuilderChangeSet` types for tracking file changes (100% test coverage)
- Service integration with backward-compatible API
- CLI `--watch` flag (parsing only, no file watching yet)
- V1 fallback strategy: full rebuild on changes (correctness over optimization)

**Test Status:**
- 158 tests passing, 11 todo
- `change-set.test.ts`: 9/9 passing ✅
- `builder-session.test.ts`: 1/12 passing ⚠️
- Integration tests: 0 ❌

**Implementation Quality:**
- Type-safe, lint-clean, neverthrow error handling ✅
- Adjacency extraction logic incomplete ❌
- End-to-end validation missing ❌

### Why P0 Tasks Are Critical

**1. Foundation Correctness**
- Strategy 2/3 optimization relies on accurate adjacency tracking
- Broken `extractModuleAdjacency()` means invalid invalidation
- Without tests, we can't trust the session state management

**2. Risk Mitigation**
- Proceeding with broken adjacency extraction → wrong files invalidated
- Missing integration tests → runtime failures in production
- Incomplete unit tests → regression risk during Strategy 2 refactoring

**3. Development Velocity**
- Fixing now (0.5–1 day) vs. fixing later (2+ days after Strategy 2 changes)
- Tests provide confidence to iterate quickly on optimization
- Clear baseline enables accurate performance measurement

## P0 Tasks Breakdown

### Task 1: Fix Module Adjacency Extraction

**Location:** `packages/builder/src/session/builder-session.ts:84-118`

**Problem:**
Current implementation has critical flaws:
```typescript
// Current (broken) logic:
for (const _runtimeImport of moduleSummary.runtimeImports) {
  const importedModules = Array.from(graph.values())
    .filter((n) => n.moduleSummary.gqlExports.length > 0)
    .map((n) => n.filePath);

  for (const importedPath of importedModules) {
    // Creates fan-out: every module depends on every other!
  }
}
```

Issues:
- Ignores actual import relationships
- Hardcoded filter creates false dependencies
- Never resolves runtime imports to actual file paths
- Results in unusable `moduleAdjacency` map

**Solution Approach:**

1. **Build Per-Module View (Phase 1)**
   ```typescript
   // Cache module summaries by file path
   const modulesByPath = new Map<string, ModuleSummary>();
   for (const node of graph.values()) {
     modulesByPath.set(node.filePath, node.moduleSummary);
   }
   ```

2. **Derive Imports from Dependencies (Phase 2)**
   ```typescript
   // Extract module path from canonical ID: "path/to/file.ts::exportName"
   for (const depId of node.dependencies) {
     const [modulePath] = depId.split('::');
     // Record: modulePath is imported by node.filePath
   }
   ```

3. **Handle Runtime Imports (Phase 3)**
   ```typescript
   // For modules with no tracked dependencies (side-effects only)
   if (dependencies.length === 0) {
     for (const runtimeImport of moduleSummary.runtimeImports) {
       const resolved = resolveModuleSpecifier(runtimeImport.source, node.filePath);
       if (resolved && modulesByPath.has(resolved)) {
         // Record runtime import
       }
     }
   }
   ```

4. **Populate Adjacency Map (Phase 4)**
   ```typescript
   // Build reverse adjacency: imported -> [importers]
   const adjacency = new Map<string, Set<string>>();
   for (const [importer, imports] of importMap) {
     for (const imported of imports) {
       if (!adjacency.has(imported)) {
         adjacency.set(imported, new Set());
       }
       adjacency.get(imported)!.add(importer);
     }
   }
   // Include isolated modules with empty sets
   for (const modulePath of modulesByPath.keys()) {
     if (!adjacency.has(modulePath)) {
       adjacency.set(modulePath, new Set());
     }
   }
   ```

**Related Fix:**
`dropRemovedFiles()` at line 204-215 splits canonical IDs on `'#'` but should use `'::'`:
```typescript
// Before: const [filePath] = canonicalId.split('#');
// After:  const [filePath] = canonicalId.split('::');
```

**Unit Test Coverage:**
- Simple chain: A imports B → adjacency has B → {A}
- Re-export barrel: A imports B, B re-exports C → verify transitive tracking
- External imports: Ignore `node_modules` and bare specifiers
- Isolated modules: Modules with no dependents appear with empty sets
- Side-effect imports: Modules with only runtime imports tracked correctly

**Estimated Effort:** 0.5 day

**Success Criteria:**
- [ ] Adjacency map correctly reflects actual import relationships
- [ ] New unit tests pass with deterministic graph fixtures
- [ ] Canonical ID parsing uses `'::'` consistently
- [ ] No regressions in existing 158 passing tests

---

### Task 2: Complete BuilderSession Unit Tests

**Location:** `tests/unit/builder/builder-session.test.ts`

**Current State:** 1 pass, 11 todo (placeholders)

**Testing Strategy:**
Use `bun:test`'s `mock.module` to stub heavy dependencies:
- `discoverModules` → return deterministic snapshots
- `buildDependencyGraph` → return handcrafted graph
- `createIntermediateModule` → return mock intermediate module
- `buildArtifact` → return ok(mockArtifact)
- `createJsonCache` → return in-memory cache

**Test Categories:**

#### A. buildInitial() Tests

**Test 1: Happy Path**
```typescript
describe('buildInitial', () => {
  it('should perform full build and cache state', async () => {
    // Given: mocked dependencies return valid data
    // When: session.buildInitial(input)
    // Then:
    // - Returns ok(artifact)
    // - Stores snapshots (assert state.snapshots.size === expected)
    // - Builds module adjacency map
    // - Builds definition adjacency map
    // - Persists metadata (schemaHash, analyzerVersion)
  });
});
```

**Test 2: Cache Interaction**
```typescript
it('should store discovery snapshots in cache', async () => {
  // Assert: snapshots stored once per discovered module
  // Verify: cache.set() called with correct keys
});
```

**Test 3: Dependency Maps**
```typescript
it('should extract adjacency maps correctly', async () => {
  // Given: graph with known dependencies
  // Then: moduleAdjacency matches expected relationships
  // Then: definitionAdjacency matches expected relationships
});
```

#### B. update() Tests

**Test 4: Metadata Mismatch Fallback**
```typescript
describe('update', () => {
  it('should rebuild when schema hash changes', async () => {
    // Given: session initialized with schemaHash = "abc"
    // When: update({ metadata: { schemaHash: "xyz" } })
    // Then: calls buildInitial() instead of incremental update
  });

  it('should rebuild when analyzer version changes', async () => {
    // Similar to schema hash test
  });
});
```

**Test 5: Added Files**
```typescript
it('should handle added files', async () => {
  // Given: changeSet with added = ["new-file.ts"]
  // When: update(changeSet)
  // Then: calls buildInitial() (V1 fallback)
  // Then: adjacency consulted (spy on collectAffectedModules)
});
```

**Test 6: Updated Files**
```typescript
it('should handle updated files', async () => {
  // Given: changeSet with updated = ["existing-file.ts"]
  // When: update(changeSet)
  // Then: V1 fallback to full rebuild
  // Then: new fingerprints stored
});
```

**Test 7: Removed Files**
```typescript
it('should handle removed files', async () => {
  // Given: changeSet with removed = ["deleted-file.ts"]
  // When: update(changeSet)
  // Then: dropRemovedFiles() called
  // Then: snapshots pruned
  // Then: adjacency pruned
  // Then: affected modules computed correctly
});
```

**Test 8: No-Op Changes**
```typescript
it('should return cached artifact for no-op changes', async () => {
  // Given: changeSet with no actual changes (fingerprints match)
  // When: update(changeSet)
  // Then: returns lastArtifact without rebuild
});
```

**Test 9: Change Set Handling**
```typescript
it('should distinguish added/updated/removed sets', async () => {
  // Given: mixed changeSet (added, updated, removed)
  // When: update(changeSet)
  // Then: each category processed correctly
});
```

#### C. Adjacency Extraction Tests

**Test 10: Module Adjacency Helper**
```typescript
describe('extractModuleAdjacency', () => {
  it('should build correct adjacency from dependency graph', () => {
    // Given: handcrafted DependencyGraph
    // When: extractModuleAdjacency(graph)
    // Then: returns expected adjacency map
  });

  it('should include isolated modules with empty sets', () => {
    // Test edge case: module with no imports/exports
  });
});
```

**Test 11: Definition Adjacency Helper**
```typescript
describe('extractDefinitionAdjacency', () => {
  it('should track canonical ID dependencies', () => {
    // Given: graph with definition-level dependencies
    // When: extractDefinitionAdjacency(graph)
    // Then: canonical IDs mapped to dependents
  });
});
```

#### D. Metadata Validation

**Test 12: Metadata Matching**
```typescript
describe('metadataMatches', () => {
  it('should return true when metadata matches', () => {
    // Direct test of metadataMatches() helper
  });

  it('should return false when schema hash differs', () => {});
  it('should return false when analyzer version differs', () => {});
});
```

**Implementation Notes:**
- Use `beforeEach` to reset mocks
- Assert mock invocation counts for verification
- Keep tests hermetic (no disk I/O)
- Use deterministic fixtures for graph stubs

**Estimated Effort:** 1 day

**Success Criteria:**
- [ ] All 11 TODO tests converted to passing tests
- [ ] Total unit test count: 20+ (9 changeSet + 11+ session)
- [ ] Mock interactions verified
- [ ] Edge cases covered (isolated modules, empty changes, etc.)
- [ ] Local `bun test` shows 0 todo in builder-session.test.ts

---

### Task 3: Add Integration Test for Incremental Session Flow

**Location:** `tests/integration/builder_incremental_session.test.ts` (new file)

**Objective:** End-to-end validation of `BuilderSession` lifecycle with real files

**Test Scenario:**

#### Setup Phase
```typescript
describe('BuilderSession E2E', () => {
  let tmpDir: string;

  beforeEach(async () => {
    // 1. Copy tests/fixtures/runtime-app to temp directory
    tmpDir = createTempWorkspace('runtime-app');

    // 2. Run codegen to generate graphql-system
    await runCodegen({
      schema: join(tmpDir, 'schema.graphql'),
      out: join(tmpDir, 'graphql-system/index.ts'),
    });
  });

  afterEach(async () => {
    await cleanupTempWorkspace(tmpDir);
  });
});
```

#### Test 1: Initial Build
```typescript
it('should perform initial build and cache state', async () => {
  // Given: fresh session
  const session = createBuilderSession();

  // When: buildInitial with entry patterns
  const result = await session.buildInitial({
    mode: 'runtime',
    entry: [join(tmpDir, 'src/**/*.ts')],
    analyzer: 'typescript',
  });

  // Then:
  expect(result.isOk()).toBe(true);

  const snapshot = session.getSnapshot();
  expect(snapshot.snapshotCount).toBeGreaterThan(0);
  expect(snapshot.moduleAdjacencySize).toBeGreaterThan(0);

  // Verify specific edge: profile.query.ts depends on user.ts
  // (requires exposing adjacency in snapshot or debug mode)
});
```

#### Test 2: Incremental Update (Modified File)
```typescript
it('should handle file modification incrementally', async () => {
  // Given: initial build completed
  const session = createBuilderSession();
  await session.buildInitial(input);

  // When: modify user.ts contents
  const userPath = join(tmpDir, 'src/entities/user.ts');
  await appendToFile(userPath, '// modified');

  const changeSet: BuilderChangeSet = {
    added: [],
    updated: [{
      filePath: userPath,
      fingerprint: await computeHash(userPath),
      mtimeMs: Date.now(),
    }],
    removed: [],
    metadata: {
      schemaHash: 'unchanged',
      analyzerVersion: 'v1.0.0',
    },
  };

  // Then: update succeeds
  const result = await session.update(changeSet);
  expect(result.isOk()).toBe(true);

  // Verify: session state refreshed
  const snapshot = session.getSnapshot();
  expect(snapshot.snapshotCount).toBeGreaterThan(0);
});
```

#### Test 3: File Removal
```typescript
it('should handle file removal', async () => {
  // Given: initial build completed
  const session = createBuilderSession();
  await session.buildInitial(input);

  const initialSnapshot = session.getSnapshot();

  // When: delete user.ts
  const userPath = join(tmpDir, 'src/entities/user.ts');
  await rm(userPath);

  const changeSet: BuilderChangeSet = {
    added: [],
    updated: [],
    removed: [{ filePath: userPath, fingerprint: '', mtimeMs: 0 }],
    metadata: { schemaHash: 'unchanged', analyzerVersion: 'v1.0.0' },
  };

  // Then: update succeeds
  const result = await session.update(changeSet);
  expect(result.isOk()).toBe(true);

  // Verify: snapshot count decreased
  const finalSnapshot = session.getSnapshot();
  expect(finalSnapshot.snapshotCount).toBeLessThan(initialSnapshot.snapshotCount);
});
```

#### Test 4: Metadata Mismatch Triggers Rebuild
```typescript
it('should rebuild when metadata changes', async () => {
  // Given: session with schemaHash = "original"
  const session = createBuilderSession();
  await session.buildInitial(input);

  // When: provide changeSet with different schemaHash
  const changeSet: BuilderChangeSet = {
    added: [],
    updated: [],
    removed: [],
    metadata: {
      schemaHash: 'new-schema-hash', // Changed!
      analyzerVersion: 'v1.0.0',
    },
  };

  // Then: update() performs full rebuild (not incremental)
  const result = await session.update(changeSet);
  expect(result.isOk()).toBe(true);
  // (In V1, all updates are full rebuilds, but verify no crash)
});
```

**Guardrails:**
- Use deterministic fingerprints (hash file contents or use placeholders)
- Clean temp directories after each test
- Reuse helper patterns from `runtime_builder_flow.test.ts`
- Seed known file structure for predictable assertions

**Estimated Effort:** 0.5–0.75 day

**Success Criteria:**
- [ ] New file `tests/integration/builder_incremental_session.test.ts` created
- [ ] All 4 scenarios passing
- [ ] Tests fail if adjacency or session state regress
- [ ] Demonstrates incremental update handling (add/update/remove)
- [ ] Local `bun test` includes new integration test in pass count

---

## Implementation Order

**Recommended Sequence:**

1. **Task 1** (Adjacency Fix) → Unblocks Task 2 and Task 3
   - Fix `extractModuleAdjacency()` implementation
   - Fix `dropRemovedFiles()` canonical ID parsing
   - Add unit tests for adjacency helpers

2. **Task 2** (Unit Tests) → Validates Task 1 fixes
   - Convert TODO tests to passing tests
   - Use mocks to isolate session logic
   - Cover all buildInitial/update/adjacency/metadata cases

3. **Task 3** (Integration Test) → E2E validation
   - Create new integration test file
   - Test against real fixtures
   - Verify session lifecycle end-to-end

## Timeline & Effort

| Task | Estimated Effort | Dependencies |
|------|-----------------|--------------|
| Task 1: Adjacency Fix | 0.5 day | None |
| Task 2: Unit Tests | 1.0 day | Task 1 |
| Task 3: Integration Test | 0.5–0.75 day | Task 1, Task 2 |
| **Total** | **2.0–2.25 days** | Sequential |

**Note:** Tasks are sequential; Task 1 must complete before Task 2/3 can succeed.

## Success Criteria

**Definition of Done:**
- [ ] All 3 P0 tasks completed
- [ ] `bun test` shows 0 todo tests (currently 11)
- [ ] Total test count increased (158 → ~178+)
- [ ] No regressions in existing tests
- [ ] Adjacency extraction produces correct results
- [ ] Integration test demonstrates E2E session flow
- [ ] Code review-ready (lint clean, type-safe)

**Validation Steps:**
1. Run `bun test` → all green, 0 todo
2. Run `bun quality` → no lint/type errors
3. Run `bun typecheck` → passes
4. Manual review: adjacency maps look correct in debug output
5. Git status: clean working directory (all changes committed)

## Next Steps After P0 Completion

**Immediate:**
- Re-run full test matrix (`bun test`)
- Create PR notes summarizing coverage additions
- Update `docs/plans/builder-performance-progress.md` with P0 completion

**Strategy 2 Preparation:**
- Baseline benchmark: `bun run perf:builder --fixture large-app --iterations 5`
- Review Strategy 2 plan: fingerprint-based cache invalidation
- Consult Codex for Strategy 2 implementation strategy

**Optional (if time permits):**
- Add `--show-cache` CLI flag for debugging
- Document `BuilderSession` API in `docs/guides/builder-incremental.md`
- Explore watch mode file watcher integration

## References

- **Strategy 1 Summary:** [docs/plans/strategy-1-summary.md](./strategy-1-summary.md)
- **Progress Report:** [docs/plans/builder-performance-progress.md](./builder-performance-progress.md)
- **Optimization Plan:** [docs/plans/builder-performance-optimization.md](./builder-performance-optimization.md)
- **Branch:** `feat/improved-performance-of-builder`
- **Last Evaluation:** 2025-10-03

---

## Appendix: Why These Tasks Matter

### Impact on Strategy 2

Strategy 2 (Smarter Discovery & Cache Invalidation) introduces:
- Fingerprint-based change detection (xxhash-wasm)
- Enhanced discovery cache with version metadata
- Selective invalidation based on fingerprints

**Dependencies on P0:**
- Accurate adjacency maps → correct invalidation propagation
- Tested session state → safe to add fingerprint caching
- Integration tests → regression detection during optimization

### Impact on Strategy 3

Strategy 3 (Dependency Graph Pruning & Incremental Codegen) requires:
- Partial graph construction from affected subgraph
- Delta artifact building

**Dependencies on P0:**
- `collectAffectedModules()` must be correct → drives subgraph selection
- Session state must be reliable → enables delta builds
- E2E tests → verify incremental correctness

### Risk Without P0 Completion

**If we proceed to Strategy 2 without P0:**
- ❌ Invalid adjacency → wrong files invalidated → incorrect builds
- ❌ Missing tests → regressions introduced during optimization
- ❌ Broken session state → Strategy 2/3 optimizations fail silently
- ❌ 2x effort: fixing P0 issues after Strategy 2 changes = major refactoring

**With P0 Complete:**
- ✅ Solid foundation for optimization
- ✅ Regression detection via tests
- ✅ Confidence to iterate quickly on Strategy 2/3
- ✅ Clear performance baseline for measuring improvements
