# File Change Detection Implementation Plan

**Status**: In Progress
**Codex conversationId**: `0199fb5a-a62d-7023-a7b4-67320e84c4c3`
**Created**: 2025-10-19

## Overview

Move file change detection from plugin side to builder side using an independent file tracker that maintains its own state.

## Motivation

- Current approach requires each plugin to implement file difference detection
- Some build tools cannot provide expected file differences
- Plugin-side detection complicates overall architecture
- Builder should own change detection for consistency

## Design Principles

1. **Independence**: Tracker maintains its own persistent state, not dependent on discovery
2. **Simplicity**: Single responsibility - track file metadata changes
3. **Self-contained**: Survives process restarts via disk persistence
4. **Breaking changes acceptable**: Pre-release v0.1.0, no migration needed

## Architecture

### 1. FileTracker Module (`packages/builder/src/tracker/file-tracker.ts`)

**Interface**:
```typescript
interface FileTracker {
  loadState(): FileTrackerState;
  scan(paths: readonly string[]): Promise<FileScan>;
  detectChanges(prev: FileTrackerState, next: FileScan): FileDiff;
  persist(next: FileTrackerState): Promise<void>;
}

interface FileTrackerState {
  version: number;
  files: Map<string, FileMetadata>;
}

interface FileMetadata {
  mtimeMs: number;
  size: number;
}

interface FileScan {
  files: Map<string, FileMetadata>;
}

interface FileDiff {
  added: Set<string>;
  updated: Set<string>;
  removed: Set<string>;
}
```

**Persistence**:
- Location: `.cache/soda-gql/builder/file-tracker.json`
- Format: `{ version: 1, files: { [normalizedPath]: { mtimeMs, size } } }`
- Use atomic writes for consistency
- Normalize all paths to POSIX-style absolute strings

**Operations**:
1. `loadState()`: Read persisted JSON from cache, return empty state if missing
2. `scan(paths)`: Stat each path, ignore missing files, return current metadata map
3. `detectChanges(prev, current)`:
   - `added`: In current but not in previous
   - `updated`: In both but metadata changed
   - `removed`: In previous but not in current
4. `persist(state)`: Atomically write state to disk

### 2. Builder Session Integration

**Updated flow** (`packages/builder/src/session/builder-session.ts`):

```typescript
async function build() {
  // 1. Initialize tracker
  const tracker = ensureFileTracker(config);

  // 2. Load previous state (from disk only)
  const previousState = tracker.loadState();

  // 3. Resolve entry globs to get candidate files
  const candidatePaths = await resolveEntryPaths(config.entry);

  // 4. Scan current file state
  const currentScan = await tracker.scan(candidatePaths);

  // 5. Detect changes
  const diff = tracker.detectChanges(previousState, currentScan);

  // 6. Early return if no changes and cached artifact exists
  if (isEmpty(diff) && hasCachedArtifact()) {
    return getCachedArtifact();
  }

  // 7. Pass changes to discovery
  const changedFiles = union(diff.added, diff.updated);
  const removedFiles = diff.removed;

  // 8. Run discovery with invalidation
  const modules = await discoverModules({ changedFiles, removedFiles });

  // 9. Build artifact
  const artifact = await buildArtifact(modules);

  // 10. Persist tracker state on success
  await tracker.persist({ files: currentScan.files, version: 1 });

  return artifact;
}
```

**Key changes**:
- Remove `BuilderChangeSet` parameter from `build()`
- Tracker is the single source of truth for change detection
- Discovery receives tracker's diff output
- Persist tracker state after successful build

### 3. Builder Service API

**Current API** (`packages/builder/src/service.ts`):
```typescript
interface BuilderService {
  build(): Promise<BuilderArtifact>;
  update(changeSet: BuilderChangeSet): Promise<BuilderArtifact>;
}
```

**New API**:
```typescript
interface BuilderService {
  build(options?: { force?: boolean }): Promise<BuilderArtifact>;
}
```

**Changes**:
- Remove `update()` method entirely
- Add optional `force` flag to bypass tracker and trigger full discovery
- Simplify to single entry point

### 4. Plugin Infrastructure Updates

#### BuilderServiceController (`packages/plugin-shared/src/dev/builder-service-controller.ts`)

**Current**:
- Accepts `update(changeSet)` calls
- Manually increments generation counter

**Updated**:
- Single `build()` operation
- Get generation from `instance.getGeneration()` after build
- Sync `currentArtifact` with session

#### PluginCoordinator (`packages/plugin-shared/src/dev/coordinator/plugin-coordinator.ts`)

**Current**:
- `ensureLatest()` and `update(changeSet)` methods
- Passes change-sets to controller

**Updated**:
- Single `ensureLatest()` method that calls `controller.build()`
- Update cached snapshot only when `controller.getGeneration()` changes
- Remove `update()` entry point

#### DevBuilderSession (`packages/plugin-shared/src/dev/session.ts`)

**Current**:
- `applyFileChanges(changeSet)` receives change-sets from watch

**Updated**:
- `applyFileChanges()` simply triggers `controller.build()`
- No change-set parameter needed

### 5. Plugin-Specific Changes

#### Webpack Plugin (`packages/plugin-webpack/src/plugin.ts`)

**Remove**:
- `createBuilderWatch()` usage
- Change-set construction from `modifiedFiles`/`removedFiles`

**Update**:
- `watchRun` hook: Call `coordinator.ensureLatest()` when Webpack reports changes
- Builder tracker handles actual diff detection

#### Babel Plugin (`packages/plugin-babel/src/dev/manager.ts`)

**Similar changes**:
- Remove watch helper dependency
- Call `coordinator.ensureLatest()` on file system events
- Rely on builder tracker for change detection

#### Remove builder-watch (`packages/plugin-shared/src/dev/builder-watch.ts`)

- Delete entire module unless reused elsewhere
- If needed, narrow to simple debounce utility without file statting

### 6. Cleanup Tasks

1. **Remove BuilderChangeSet**:
   - Delete `packages/builder/src/session/change-set.ts`
   - Remove from all exports in `packages/builder/src/index.ts`
   - Update dependency graphs

2. **Update Tests**:
   - Refresh incremental builder tests to use tracker
   - Add tracker unit tests (persist/load/detect cycle)
   - Update coordinator/controller tests
   - Add plugin integration tests

3. **Update Documentation**:
   - README updates for new API
   - Remove change-set references from examples
   - Update architecture docs

## Testing Strategy

### 1. Tracker Unit Tests

**Test file**: `tests/unit/tracker/file-tracker.test.ts`

Coverage:
- `persist()` → `loadState()` round-trip
- `detectChanges()` correctly reports added/updated/removed
- No-changes case (empty diff)
- Missing files handled gracefully
- Path normalization (POSIX absolute)

### 2. Integration Tests

**Update existing**: `tests/integration/builder-session-incremental.test.ts`

Scenarios:
- Touch file → rebuild triggered
- Delete file → removed files handled
- Add new file matching entry glob → discovered
- No changes → cached artifact returned
- Multiple successive builds → tracker state persists

### 3. Coordinator/Controller Tests

Coverage:
- Generation advances only on actual session changes
- Repeated `ensureLatest()` with no edits → no new events
- Cached snapshot reuse

### 4. Plugin Integration Tests

Coverage:
- Webpack/Babel plugins call `ensureLatest()` instead of constructing change-sets
- Diff streams propagate correctly
- No file statting on plugin side

### 5. End-to-End Watch Mode Test

Manual or automated:
- Create/edit/delete files under entry glob
- Verify builder detects all changes
- Confirm incremental behavior works

## Implementation Steps

1. ✅ Create implementation plan (this document)
2. Implement FileTracker module
   - Core interface and implementation
   - Persistence layer (JSON cache)
   - Path normalization helpers
   - Unit tests
3. Integrate tracker into builder session
   - Remove `BuilderChangeSet` from `build()`
   - Add tracker initialization and flow
   - Update discovery integration
   - Integration tests
4. Refactor builder service API
   - Remove `update()` method
   - Add `force` option
   - Update exports
5. Update plugin-shared
   - Refactor BuilderServiceController
   - Refactor PluginCoordinator
   - Update DevBuilderSession
   - Remove builder-watch module
6. Update plugins
   - Webpack plugin changes
   - Babel plugin changes
   - Remove BuilderChangeSet imports
7. Cleanup
   - Delete change-set module
   - Remove from all exports
   - Update related tests
8. Documentation
   - Update README
   - Update examples
   - Update architecture docs

## Breaking Changes

Since this is pre-release v0.1.0, the following breaking changes are acceptable:

1. **Builder Service API**: `update(changeSet)` method removed
2. **Plugin API**: Coordinators no longer accept change-sets
3. **Internal**: `BuilderChangeSet` type removed entirely
4. **Cache format**: New tracker state file in cache directory

No migration paths needed.

## Success Criteria

- [ ] Tracker independently maintains file state across builds
- [ ] Builder detects file changes without plugin input
- [ ] Single `build()` API for all use cases
- [ ] All tests pass with new architecture
- [ ] Plugin code simplified (no change-set construction)
- [ ] Documentation updated

## References

- Codex conversationId: `0199fb5a-a62d-7023-a7b4-67320e84c4c3`
- Current builder session: `packages/builder/src/session/builder-session.ts`
- Current service: `packages/builder/src/service.ts`
- Current change-set: `packages/builder/src/session/change-set.ts`
- Plugin coordinator: `packages/plugin-shared/src/dev/coordinator/plugin-coordinator.ts`
