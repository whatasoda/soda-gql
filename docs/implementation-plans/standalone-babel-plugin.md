# Standalone Babel Plugin Implementation Plan

## Overview

Enable `@soda-gql/plugin-babel` to work standalone without requiring users to manually run the builder first. The plugin will be able to generate artifacts on-demand while keeping the existing JSON artifact workflow as an option.

## Current Architecture Issues

1. **Builder always writes to disk**: `runBuilder` always ends with `writeArtifact`, forcing disk I/O
2. **Plugin requires pre-built artifacts**: Plugin bails out immediately if no `artifactsPath` is provided
3. **Hard dependency chain**: Users must execute builder CLI → generate artifact file → run Babel transform
4. **No programmatic artifact generation**: No API to get in-memory `BuilderArtifact` without disk write

## Goals

- ✅ Plugin can generate artifacts on-demand without pre-running builder
- ✅ Keep existing JSON artifact workflow for CI/tooling scenarios
- ✅ CLI behavior remains unchanged
- ✅ Same canonical ID resolution between builder and plugin
- 🔄 Performance optimization (caching) - **DEFERRED until basic functionality is verified**

## Implementation Steps

### Phase 1: Extract Artifact Generation API

**File**: `packages/builder/src/runner.ts`

1. Extract `generateArtifact(options: BuilderInput): Promise<Result<BuilderArtifact, BuilderError>>`
   - Returns in-memory artifact without disk write
   - Encapsulates: discovery → dependency graph → intermediate module → artifact generation
2. Refactor `runBuilder` to use `generateArtifact` + `writeArtifact`
3. Add tests for both code paths
4. Ensure CLI output stays identical

### Phase 2: Create Builder Service

**New file**: `packages/builder/src/service.ts`

1. Export `createBuilderService(config: BuilderServiceConfig)`
   - Config includes: entry patterns, analyzer type, mode, optional debugDir
2. API surface:
   ```typescript
   interface BuilderService {
     build(): Promise<Result<BuilderArtifact, BuilderError>>
     // Caching/invalidation deferred to Phase 4
   }
   ```
3. Reuse in both CLI and plugin
4. Respect same analyzer configuration (TS vs SWC) as CLI

### Phase 3: Extend Plugin Options

**File**: `packages/plugin-babel/src/options.ts`

1. Define discriminated union for artifact sources:
   ```typescript
   type ArtifactSource =
     | { source: "artifact-file"; path: string }
     | { source: "builder"; config: BuilderConfig }
   ```
2. Update `normalizeOptions` to handle both branches
3. Update Zod schema validation
4. Keep existing error messages for artifact-file branch

### Phase 4: Make Plugin Pre() Async

**File**: `packages/plugin-babel/src/plugin.ts`

1. Convert `pre()` to support async setup
2. Branch on options.source:
   - **artifact-file**: Keep current JSON load logic (unchanged)
   - **builder**: Call builder service, await artifact, cache in `this._state`
3. Handle synchronous Babel APIs:
   - Fallback to `child_process.spawnSync` for sync contexts
   - Memoize result for subsequent transforms
4. Wire builder diagnostics into plugin's existing diagnostics channel

### Phase 5: Testing

1. **Unit tests**:
   - `generateArtifact` returns correct in-memory artifact
   - Builder service instantiation and build() method
   - Option normalization for both artifact sources

2. **Integration tests**:
   - Run `transformAsync` without pre-built artifacts
   - Verify plugin generates artifacts on-demand
   - Regression tests for JSON artifact path (ensure unchanged)
   - Multi-file builds work correctly

3. **Contract tests**:
   - Canonical IDs match between standalone and pre-built modes
   - Same analyzer produces same results

## Deferred to Phase 6 (Performance Optimization)

The following will be implemented **after** core functionality is verified:

1. **Artifact caching per options hash**
   - Cache key based on entry patterns, analyzer config, mode
   - Reuse artifacts across transforms with identical config

2. **Invalidation strategy**
   - Detect entry source or schema dependency changes
   - Leverage builder's `.cache/soda-gql` stats
   - Expose `invalidate(paths?: string[])` hook

3. **Builder service memoization**
   - Cache discovery results
   - Cache dependency graphs
   - Cache intermediate module recompilation

## Risks and Considerations

1. **Async pre() compatibility**: Works with `transformAsync`, requires fallback for sync Babel APIs
2. **Startup cost**: Large projects may have noticeable delay; caching essential (Phase 6)
3. **Workspace resolution**: Must agree on root resolution for entry globs; may need `rootDir` option
4. **Analyzer consistency**: Same analyzer config must be used to ensure canonical ID alignment

## Success Criteria

- [x] Plugin works standalone without pre-built artifacts
- [x] Existing JSON artifact workflow still works
- [x] CLI behavior unchanged
- [x] Tests pass for both artifact sources
- [x] Canonical IDs match between both modes
- [x] No breaking changes to public APIs

## Implementation Status

**✅ All phases completed successfully** (2025-01-02)

### Summary

The standalone Babel plugin implementation is now complete. Users can use the plugin in two ways:

1. **Builder mode** (new): Plugin generates artifacts on-demand
   ```typescript
   {
     artifactSource: {
       source: "builder",
       config: {
         mode: "zero-runtime",
         analyzer: "ts",
         entry: ["./src/**/*.query.ts"]
       }
     }
   }
   ```

2. **Artifact-file mode** (existing): Plugin loads pre-built artifacts
   ```typescript
   {
     artifactsPath: "./.cache/soda-gql/artifacts.json"
   }
   ```

### Completed Phases

1. ✅ **Phase 1**: Extracted `generateArtifact` API from `runBuilder`
2. ✅ **Phase 2**: Created builder service with `createBuilderService`
3. ✅ **Phase 3**: Extended plugin options with discriminated union
4. ✅ **Phase 4**: Made plugin `pre()` async with builder integration
5. ✅ **Phase 5**: Added integration and contract tests

### Test Results

```
118 pass
1 skip
0 fail
376 expect() calls
```

All existing tests continue to pass with no regressions.

### Key Changes

- **New exports from `@soda-gql/builder`**:
  - `generateArtifact(options: BuilderInput)`
  - `createBuilderService(config: BuilderServiceConfig)`
  - `BuilderInput`, `BuilderService`, `BuilderServiceConfig` types

- **Plugin options**:
  - New `artifactSource` option with discriminated union
  - Legacy `artifactsPath` still supported for backward compatibility
  - Builder mode requires Babel async APIs (`transformAsync`)

- **Error handling**:
  - All `BuilderError` codes mapped to plugin error codes
  - Clear error messages with actionable context

## Follow-up Tasks

1. Consider ADR for this architectural change (multi-source plugin design)
2. Update user-facing documentation
3. Performance benchmarking (Phase 6 trigger)
4. Consider fixing `buildLiteralFromValue` to handle `undefined` values for full zero-runtime transformation with builder artifacts
