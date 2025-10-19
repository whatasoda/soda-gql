# Issue: NestJS TypeScript Compiler Plugin Build Hang

## Status
🔴 **Critical** - nestjs-compiler-tsc example hangs indefinitely during build

## Affected Component
- Package: `@soda-gql/plugin-tsc`
- Path: `packages/plugin-tsc/src/`
- Examples: `examples/nestjs-compiler-tsc`

## Problem Description

The `bun run build` command for the nestjs-compiler-tsc example hangs indefinitely with no output.

### Observed Behavior
```bash
cd examples/nestjs-compiler-tsc
bun run artifact  # ✓ Works (generates artifact in 0ms, 4 elements)
bun run build     # ✗ Hangs (>1 minute, no output, no errors)
```

### Comparison with Other Examples

| Example | Build Time | Status |
|---------|-----------|--------|
| babel-app | 663ms | ✓ Works |
| nestjs-app (webpack) | 1.3s | ✓ Works |
| nestjs-compiler-swc | 6.56ms | ✓ Works |
| **nestjs-compiler-tsc** | **∞ (hangs)** | **✗ Broken** |

## Root Cause Analysis

### Deadlock in `runPromiseSync`

**Location**: `packages/plugin-shared/src/compiler-sync/prepare-transform-state.ts`

```typescript
// This causes the deadlock:
runPromiseSync(() => preparePluginState(...))
```

**Blocking Helper**: `packages/plugin-shared/src/compiler-sync/blocking.ts`

The `runPromiseSync` helper uses `Atomics.wait` to block the Node.js main thread while waiting for a promise to resolve. However, the promise itself requires the event loop to complete:

1. **Main thread blocks** on `Atomics.wait`
2. **Promise requires async work**:
   - `loadConfig` calls `esbuild.build()` (packages/config/src/loader.ts:30)
   - Dynamic `import()` needs event loop
   - Coordinator calls `coordinator.ensureLatest()` (packages/plugin-shared/src/state.ts:152)
   - Builder service runs async operations (packages/plugin-shared/src/coordinator/plugin-coordinator.ts:33)
3. **Event loop is blocked** → async work never completes
4. **Promise never resolves** → deadlock

### Reproduction

Simple reproduction showing the deadlock:

```typescript
runPromiseSync(async () => {
  await new Promise(resolve => setTimeout(resolve, 10));
});
// Never returns - command times out
```

## Technical Details

### Call Stack

```
nest build (Nest CLI)
  ↓
TypeScript transformer plugin
  ↓
prepareTransformState()
  ↓
runPromiseSync(() => preparePluginState(...))  ← BLOCKS MAIN THREAD
  ↓
Atomics.wait()  ← Spins waiting for promise
  ↓
preparePluginState() needs event loop:
  - loadConfig() → esbuild.build() → dynamic import()
  - coordinator.ensureLatest() → builder service
  ↓
DEADLOCK: Event loop blocked, async work can't complete
```

### Why SWC Works

The nestjs-compiler-swc example works because SWC compiler plugins run in a different execution context that doesn't have this synchronous blocking constraint.

## Proposed Solutions

### Option 1: Remove `runPromiseSync` (Recommended)

**Pros**:
- Eliminates deadlock completely
- Aligns with Node.js async patterns
- Simplest solution

**Cons**:
- Requires TypeScript transformer API changes
- May need upstream Nest CLI changes

**Implementation**:
- Refactor transformer to accept async factory
- Preload state before transformation starts
- Cache coordinator state globally

### Option 2: Preload Artifacts

**Pros**:
- Minimal code changes
- Keeps synchronous transformer API
- Quick fix

**Cons**:
- Doesn't solve root cause
- Requires explicit preload step
- Error handling complexity

**Implementation**:
```typescript
// Before nest build
const state = await preparePluginState(...);

// In transformer (synchronous)
function transform(node) {
  // Use preloaded state (no async work)
  return transformNode(node, state);
}
```

### Option 3: Worker Thread

**Pros**:
- Isolates async work
- Keeps current API

**Cons**:
- Complex IPC setup
- Performance overhead
- Harder to debug

**Implementation**:
- Spawn worker thread for async operations
- Use MessageChannel for communication
- Block main thread only on IPC (not event loop)

## Recommended Fix

**Option 2 (Short-term)** + **Option 1 (Long-term)**:

1. **Immediate**: Preload artifacts synchronously
   - Read `.cache/soda-gql-artifact.json` with `fs.readFileSync`
   - Load config once at plugin initialization
   - Cache coordinator state

2. **Future**: Refactor to async transformers
   - Work with Nest team on async plugin API
   - Remove `runPromiseSync` entirely

## Files to Modify

### High Priority
- `packages/plugin-shared/src/compiler-sync/prepare-transform-state.ts` - Remove async work from sync context
- `packages/plugin-shared/src/compiler-sync/blocking.ts` - Document limitations or remove
- `packages/plugin-tsc/src/transformer.ts` - Preload state at plugin init

### Medium Priority
- `packages/plugin-shared/src/state.ts` - Add synchronous state getters
- `packages/config/src/loader.ts` - Add synchronous config loader

### Low Priority (Testing)
- `tests/integration/plugin-tsc/` - Add regression test for tsc plugin with enabled: true

## Success Criteria

- [ ] `bun run build` completes successfully in nestjs-compiler-tsc
- [ ] Build time comparable to other examples (<5s)
- [ ] No changes to example configuration needed
- [ ] Regression test covers enabled plugin path
- [ ] Documentation updated with any new preload requirements

## Related Issues

- Coordinator migration: Already completed
- SWC plugin: Works correctly (reference implementation)

## Next Steps

1. Choose fix strategy (recommend Option 2 for immediate fix)
2. Implement synchronous artifact loading
3. Test with nestjs-compiler-tsc example
4. Add regression tests
5. Update documentation

## References

- Prepare transform state: `packages/plugin-shared/src/compiler-sync/prepare-transform-state.ts`
- Blocking helper: `packages/plugin-shared/src/compiler-sync/blocking.ts`
- Config loader: `packages/config/src/loader.ts`
- Coordinator: `packages/plugin-shared/src/coordinator/plugin-coordinator.ts`
