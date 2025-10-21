# soda-gql Improvement Proposals - Decision Record

**Date**: 2025-10-05
**Status**: Pending Decision
**Codex Analysis Reference**: [Conversation ID to be added]

This document tracks decisions on improvement proposals identified through comprehensive codebase analysis.

---

## 🔴 P0: Critical Issues (Immediate Action Required)

### 1. Incremental Build Cache Bug (Windows Path Normalization)

**Problem**:
- Removed modules remain cached due to path normalization mismatch
- `snapshots.get(filePath)` uses non-normalized paths
- Actual snapshots stored under `snapshot.normalizedFilePath`
- **Impact**: Stale definitions persist in cache, breaking incremental builds

**Location**:
- `packages/builder/src/session/builder-session.ts:247, 420`

**Proposed Solution**:
- Introduce shared path normalization helper
- Add Windows-specific regression tests for `.tsx` module removal

**Decision**:
```
[ ] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[x] Defer - Until: everything is production ready

```

---

### 2. Runtime Dependency Resolution Bug (.tsx/.index.tsx)

**Problem**:
- `.tsx` and `index.tsx` imports invisible to dependency diffs
- `resolveModuleSpecifier` returns first `.ts` candidate without filesystem check
- **Impact**: Missing dependencies in incremental builds

**Location**:
- `packages/builder/src/session/builder-session.ts:104-126`

**Proposed Solution**:
- Add actual filesystem existence checks
- Support `.tsx` and index file resolution

**Decision**:
```
[x] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

### 3. Broken Package Exports (Production Runtime Error)

**Problem**:
- `exports` points to `src/*.ts` but `files` only includes `dist/`
- **Impact**: Module not found errors in production

**Location**:
- `packages/builder/package.json:5-23`
- `packages/config/package.json:8-40`

**Proposed Solution**:
- Update exports to point to `dist/*.js`
- Add build scripts to CI/publish workflow
- Ship TypeScript declarations alongside built JS

**Decision**:
```
[ ] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[x] Defer - Until: Will be handled when we configure build scripts. The current way is good for development.

```

---

## 🟡 P1: Important Improvements

### 4. Cache Invalidation Defect (Schema Changes)

**Problem**:
- Schema/scalar changes don't invalidate cached artifacts
- Metadata uses `schemaHash: input.analyzer` instead of actual schema hash
- **Impact**: Stale codegen output after schema updates

**Location**:
- `packages/builder/src/runner.ts:42-45`
- `packages/builder/src/session/builder-session.ts:402-407`

**Proposed Solution**:
- Compute real schema content hash (GraphQL schema + config)
- Persist alongside analyzer version
- **Trade-off**: Slightly heavier startup due to hash I/O

**Decision**:
```
[x] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

### 5. Bun-Only APIs Breaking Portability

**Problem**:
- Core execution paths use `Bun.write`, `Bun.hash`, `Bun.Transpiler`
- **Impact**: Cannot run builder/plugin with Babel or Node workers

**Location**:
- `packages/builder/src/intermediate-module/chunk-writer.ts:52-99`
- `packages/builder/src/cache/json-cache.ts:44-123`
- `packages/plugin-babel/src/state.ts:60-87`

**Proposed Solution**:
- Replace with Node.js `fs/promises`, `crypto`, `xxhash` fallbacks
- Introduce runtime-agnostic adapters
- **Trade-off**: Lose Bun's built-in performance unless polyfilled

**Decision**:
```
[x] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

### 6. Inefficient Chunk Writing (No Content Hash Comparison)

**Problem**:
- `writeChunkModules` rewrites all chunks even when hashes unchanged
- **Impact**: Cache benefits defeated

**Location**:
- `packages/builder/src/intermediate-module/chunk-writer.ts:49-101`

**Proposed Solution**:
- Compare current and previous `contentHash` before writing
- Skip unchanged chunks

**Decision**:
```
[x] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

## 🔵 P2: Optimizations & Enhancements

### 7. Test Strategy Improvements

**Problems**:
- Integration tests risk flakiness (lingering file watchers, cache dirs)
- Missing unit tests for snapshot normalization and chunk diffing
- No coverage reporting or mutation testing configured
- **Impact**: Regressions in rarely executed branches go unnoticed

**Location**:
- `tests/integration/builder_incremental_session.test.ts:26-153`
- `tests/contract/builder/builder_cli.test.ts:60-214`
- Missing: `tests/unit/builder/` coverage for normalized keys

**Proposed Solution**:
- Add coverage reporting tooling
- Focused unit tests for path normalization and chunk diffing
- Lightweight plugin test harness mocking `createBuilderService`
- Balance E2E vs unit test coverage

**Decision**:
```
[x] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

### 8. Package Design Cleanup

**Problems**:
- `@soda-gql/runtime` merely re-exports `@soda-gql/core` (duplication)
- CLI and config packages fragment configuration responsibilities
- Builder exposes session internals across package boundaries

**Location**:
- `packages/runtime/src/index.ts:1`
- `packages/cli/src/config/loader.ts:35-59` vs `packages/config/src/loader.ts:33-84`
- `packages/builder/src/index.ts:1-41`

**Proposed Solution**:
- Consolidate or clarify runtime/core separation
- Unify config loading logic
- Tighten builder API boundaries

**Decision**:
```
[ ] Accept - Implement as proposed
[x] Modify - Alternative approach:
Do not handle `@soda-gql/runtime` issue here. It will be handled in the next iteration.


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

### 9. Incomplete neverthrow Adoption

**Problem**:
- Documentation mandates neverthrow but code still uses `throw new Error`
- **Impact**: Unhandled rejections when invoked through Result types

**Location**:
- `packages/core/src/buildtime/slice.ts:22-46`
- `packages/builder/src/discovery/discoverer.ts:121-124`

**Proposed Solution**:
- Complete migration to Result types
- Remove all throw statements in favor of `err()`

**Decision**:
```
[ ] Accept - Implement as proposed
[x] Modify - Alternative approach:
We won't use neverthrow on the core package. Handle only builder and plugin.


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

### 10. Plugin Artifact Memoization

**Problem**:
- Babel plugin rebuilds entire artifact on every file change
- `preparePluginState` lacks memoization
- **Impact**: Inefficient watch mode

**Location**:
- `packages/plugin-babel/src/state.ts:60-147`

**Proposed Solution**:
- Memoize artifact loading (keyed by config hash)
- Add cache invalidation UI for CLI users
- **Trade-off**: Need explicit cache invalidation mechanism

**Decision**:
```
[x] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[ ] Reject - Reason:


[ ] Defer - Until:

```

---

## Additional Considerations

### 11. Monorepo Build Tooling

**Observation**:
- No explicit dependency graph tooling (Lage/Turbo)
- Cross-package builds rely on manual `bun tsc -b`
- **Impact**: Slower incremental dev as workspace grows

**Proposed Solution**:
- Evaluate and integrate monorepo build orchestration

**Decision**:
```
[ ] Accept - Implement as proposed
[ ] Modify - Alternative approach:


[x] Reject - Reason: We will handle this in the next iteration.


[ ] Defer - Until:

```

---

## Implementation Phases

### Phase 1: Stability (P0)
- [ ] Issue #1: Path normalization + Windows tests
- [ ] Issue #2: .tsx resolution with filesystem checks
- [ ] Issue #3: Package exports fix + build scripts


### Phase 2: Performance & Portability (P1)
- [ ] Issue #4: Schema content hashing
- [ ] Issue #5: Runtime-agnostic adapters (Bun decoupling)
- [ ] Issue #6: Content hash comparison in chunk writing


### Phase 3: DX & Maintainability (P2)
- [ ] Issue #7: Test coverage improvements
- [ ] Issue #8: Package design cleanup
- [ ] Issue #9: neverthrow migration completion
- [ ] Issue #10: Plugin memoization
- [ ] Issue #11: Monorepo tooling (if accepted)


---
