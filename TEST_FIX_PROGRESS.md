# Test Fix Progress

**Date**: 2025-10-16
**Status**: In Progress (Paused at 62% context)
**Total Errors**: 52 → In Progress

## ✅ Completed

### 1. Contract Tests Fixed (5 errors)
**File**: `tests/contract/plugin-babel/plugin_babel.test.ts`

**Changes**:
- Removed `mode: "zero-runtime"` from all test configurations (5 locations)
- Removed `artifact: { useBuilder: false, path: artifactPath }` options
- Updated to use only `{ configPath }` for plugin options

**Result**: All contract tests now use coordinator API correctly

### 2. DevManager Tests - Partially Fixed (1 error)
**File**: `tests/unit/plugin-babel/dev-manager.test.ts`

**Changes Made**:
- ✅ Updated `createMockOptions()`:
  - Removed `mode` field
  - Renamed `artifact` to `builderConfig`
  - Added `project: undefined` field

**Remaining Work** (17 errors):
- Need to add `coordinatorKey` and `initialSnapshot` to all `ensureInitialized()` calls
- 18 locations total need updating
- Requires adding helper functions:
  ```typescript
  const createMockCoordinatorKey = (): CoordinatorKey => "mock-coordinator-key";
  const createMockSnapshot = (): CoordinatorSnapshot => ({
    artifact: createMockArtifact(),
    elements: {},
    generation: 0,
    createdAt: Date.now(),
    options: createMockOptions(),
  });
  ```

## 🚧 Remaining Work

### 3. DevManager Tests - Complete (17 errors remaining)
**File**: `tests/unit/plugin-babel/dev-manager.test.ts`

**Pattern to Fix**:
```typescript
// Before
await harness.manager.ensureInitialized({
  config,
  options
});

// After
await harness.manager.ensureInitialized({
  config,
  options,
  coordinatorKey: createMockCoordinatorKey(),
  initialSnapshot: createMockSnapshot()
});
```

**Special Cases**:
- Line 239: Has `initialArtifact: artifact` → Remove this, use `initialSnapshot` instead
- Line 258, 344, 431: Same pattern with `initialArtifact`

### 4. StateStore Tests (~30 errors)
**File**: `tests/unit/plugin-babel/state-store.test.ts`

**Issues**:
- `initialize()` expects 4 arguments but gets 2
- `updateArtifact()` expects 2 arguments but gets 1
- Need to update signatures to include `coordinatorKey` and `snapshot` parameters

**Pattern**:
```typescript
// initialize() calls need coordinatorKey and snapshot
stateStore.initialize(coordinatorKey, initialSnapshot, options, artifact);

// updateArtifact() calls need snapshot
stateStore.updateArtifact(snapshot, artifact);
```

### 5. Other Test Files
- No errors found in plugin-nestjs tests after compiler migration
- plugin-shared tests may need updates

## Next Steps

1. **Add helper functions** to `dev-manager.test.ts`:
   - `createMockCoordinatorKey()`
   - `createMockSnapshot()`

2. **Update all `ensureInitialized()` calls**:
   - Add `coordinatorKey` parameter (18 locations)
   - Add `initialSnapshot` parameter where appropriate
   - Remove `initialArtifact` parameter (4 locations)

3. **Fix StateStore tests**:
   - Update `initialize()` signature
   - Update `updateArtifact()` signature
   - Add coordinator-related parameters

4. **Run full typecheck**:
   - Verify all 52 errors are resolved
   - Commit fixes

## Technical Notes

### New DevManager.ensureInitialized Signature

```typescript
interface EnsureInitializedArgs {
  config: BuilderServiceConfig;
  options: NormalizedOptions;
  watchOptions?: {
    rootDir: string;
    schemaHash: string;
    analyzerVersion: string;
  } | null;
  coordinatorKey: CoordinatorKey;      // NEW - required
  initialSnapshot: CoordinatorSnapshot; // NEW - required (replaces initialArtifact)
}
```

### CoordinatorSnapshot Structure

```typescript
interface CoordinatorSnapshot {
  artifact: BuilderArtifact;
  elements: Record<CanonicalId, BuilderArtifactElement>;
  generation: number;
  createdAt: number;
  options: NormalizedOptions;
}
```

## Commits Made

None yet - work in progress

## Time Estimate

- DevManager tests: 15 minutes remaining
- StateStore tests: 20 minutes
- Verification: 5 minutes
- **Total**: ~40 minutes
