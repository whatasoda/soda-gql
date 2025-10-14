# Step 4: Plugin-Babel Dev Mode Implementation Guide

## Overview

Refactor plugin-babel to integrate with DevBuilderSession for hot module replacement support.

**Goal**: Make plugin-babel aware of artifact changes and automatically refresh state without process restart.

## Current State (Before Step 4)

### What's Complete
- ✅ Step 1: DevBuilderSession with diff computation
- ✅ Step 3: BuilderArtifactElement with metadata
- ✅ Step 5: Runtime operation replacement API

### Current plugin-babel Architecture
- `packages/plugin-babel/src/plugin.ts` - Babel plugin entry point
- `pre()` hook calls `preparePluginState()` once per transform
- State is static - loaded once and never updated
- No subscription or reload capability

## Implementation Plan

### Phase 1: Create Dev Manager Infrastructure

**New Files to Create:**

#### 1. `packages/plugin-babel/src/dev/manager.ts`
Singleton dev session manager that coordinates DevBuilderSession lifecycle.

```typescript
import type { BuilderServiceConfig } from "@soda-gql/builder";
import {
  DevBuilderSession,
  createBuilderServiceController,
  createBuilderWatch,
  type DevBuilderSessionEvent,
} from "@soda-gql/plugin-shared/dev";
import type { PluginState } from "@soda-gql/plugin-shared";

import { createStateStore, type StateStore } from "./state-store";

export interface DevManager {
  ensureInitialized(config: BuilderServiceConfig): Promise<void>;
  getStateStore(): StateStore;
  dispose(): void;
}

let globalManager: DevManager | null = null;

export const getDevManager = (): DevManager => {
  if (!globalManager) {
    globalManager = createDevManager();
  }
  return globalManager;
};

const createDevManager = (): DevManager => {
  let session: DevBuilderSession | null = null;
  let stateStore: StateStore | null = null;
  let unsubscribe: (() => void) | null = null;

  return {
    async ensureInitialized(config) {
      if (session) return;

      const controller = createBuilderServiceController(config);
      const watch = createBuilderWatch({
        rootDir: config.rootDir,
        schemaHash: config.schemaHash,
        analyzerVersion: config.analyzer,
      });

      session = new DevBuilderSession({
        controller,
        watch,
      });

      stateStore = createStateStore();

      // Subscribe to artifact updates
      unsubscribe = session.subscribe((event: DevBuilderSessionEvent) => {
        if (event.type === "artifact") {
          stateStore?.updateArtifact(event.artifact);
        }
      });

      // Initial build
      await session.ensureInitialBuild();
    },

    getStateStore() {
      if (!stateStore) {
        throw new Error("DevManager not initialized");
      }
      return stateStore;
    },

    dispose() {
      unsubscribe?.();
      session = null;
      stateStore = null;
    },
  };
};
```

#### 2. `packages/plugin-babel/src/dev/state-store.ts`
Reactive state store that holds current PluginState and notifies subscribers.

```typescript
import type { BuilderArtifact } from "@soda-gql/builder";
import type { PluginState } from "@soda-gql/plugin-shared";

export interface StateStore {
  getSnapshot(): PluginState;
  updateArtifact(artifact: BuilderArtifact): void;
  subscribe(listener: () => void): () => void;
}

export const createStateStore = (): StateStore => {
  let currentState: PluginState | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot() {
      if (!currentState) {
        throw new Error("State not initialized");
      }
      return currentState;
    },

    updateArtifact(artifact) {
      generation++;
      currentState = {
        options: currentState?.options ?? ({} as any), // Preserve options
        allArtifacts: artifact.elements,
        generation,
      };

      // Notify all subscribers
      for (const listener of listeners) {
        listener();
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
```

#### 3. `packages/plugin-babel/src/dev/index.ts`
Barrel export for dev modules.

```typescript
export { getDevManager, type DevManager } from "./manager";
export { createStateStore, type StateStore } from "./state-store";
```

### Phase 2: Update Plugin Entry Point

**File to Modify:** `packages/plugin-babel/src/plugin.ts`

```typescript
import type { PluginObj } from "@babel/core";
import { formatPluginError, preparePluginState } from "@soda-gql/plugin-shared";
import type { SodaGqlBabelOptions } from "./types";
import { getDevManager } from "./dev";

export const createSodaGqlPlugin = (): PluginObj => {
  let pluginState: PluginState | null = null;

  return {
    name: "soda-gql",
    async pre() {
      const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};

      // Determine if we should use dev mode
      const isDev = process.env.NODE_ENV !== "production" && rawOptions.mode !== "zero-runtime";

      if (isDev && rawOptions.artifactSource?.source === "builder") {
        // Dev mode: use DevBuilderSession
        const devManager = getDevManager();

        // Initialize on first run
        if (!devManager.isInitialized()) {
          const builderConfig = {
            // Extract from rawOptions
            rootDir: rawOptions.artifactSource.rootDir,
            // ... other config
          };
          await devManager.ensureInitialized(builderConfig);
        }

        // Get current snapshot from store
        const stateStore = devManager.getStateStore();
        pluginState = stateStore.getSnapshot();
      } else {
        // Production mode: one-shot state preparation
        const stateResult = await preparePluginState(rawOptions);

        if (stateResult.isErr()) {
          throw new Error(formatPluginError(stateResult.error));
        }

        pluginState = stateResult.value;
      }

      // Store state for visitor access
      (this as any)._sodaGqlState = pluginState;
    },

    visitor: {
      // ... existing visitor logic uses (this as any)._sodaGqlState
    },
  };
};
```

### Phase 3: Legacy Code Removal

**Files to Update:**

1. **Remove from `@soda-gql/plugin-shared/src/state.ts`:**
   - `normalizePluginOptionsLegacy()` - if unused
   - Old artifact-file only branches

2. **Simplify plugin-babel options:**
   - Remove `SodaGqlPluginOptions` legacy shape if new options are fully adopted
   - Ensure all tests use new options format

3. **Update tests:**
   - Use `createMockArtifactElement` everywhere
   - Remove artifact file fixtures, replace with programmatic artifact creation

### Phase 4: Testing Strategy

#### Unit Tests

**File:** `tests/unit/plugin-babel/dev-manager.test.ts`

```typescript
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { getDevManager } from "@soda-gql/plugin-babel/dev";

describe("DevManager", () => {
  afterEach(() => {
    getDevManager().dispose();
  });

  test("initializes DevBuilderSession on first call", async () => {
    const manager = getDevManager();

    await manager.ensureInitialized({
      rootDir: "/test",
      schemaHash: "hash",
      analyzer: "test",
      // ... config
    });

    expect(manager.getStateStore()).toBeDefined();
  });

  test("returns same instance on subsequent calls", () => {
    const manager1 = getDevManager();
    const manager2 = getDevManager();

    expect(manager1).toBe(manager2);
  });
});
```

**File:** `tests/unit/plugin-babel/state-store.test.ts`

```typescript
import { describe, expect, test } from "bun:test";
import { createStateStore } from "@soda-gql/plugin-babel/dev";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";

describe("StateStore", () => {
  test("notifies subscribers on update", () => {
    const store = createStateStore();
    let notified = false;

    store.subscribe(() => {
      notified = true;
    });

    const artifact = createBuilderArtifact([]);
    store.updateArtifact(artifact);

    expect(notified).toBe(true);
  });

  test("unsubscribe stops notifications", () => {
    const store = createStateStore();
    let count = 0;

    const unsubscribe = store.subscribe(() => {
      count++;
    });

    store.updateArtifact(createBuilderArtifact([]));
    expect(count).toBe(1);

    unsubscribe();
    store.updateArtifact(createBuilderArtifact([]));
    expect(count).toBe(1); // Still 1
  });
});
```

#### Integration Tests

**File:** `tests/integration/plugin-babel-hmr.test.ts`

```typescript
import { describe, expect, test } from "bun:test";
import { transformWithPlugin } from "../utils/babel-transform";
import { getDevManager } from "@soda-gql/plugin-babel/dev";

describe("Plugin-Babel HMR", () => {
  test("updates transform output when artifact changes", async () => {
    // Initial transform
    const result1 = await transformWithPlugin(code, filePath, {
      mode: "zero-runtime",
      artifactSource: { source: "builder", rootDir: "/test" },
    });

    // Simulate artifact update through DevBuilderSession
    const manager = getDevManager();
    const session = manager.getSession();

    // Trigger file change
    await session.applyFileChanges([filePath]);

    // Second transform should see new artifact
    const result2 = await transformWithPlugin(code, filePath, {
      mode: "zero-runtime",
      artifactSource: { source: "builder", rootDir: "/test" },
    });

    expect(result1.code).not.toBe(result2.code);
  });
});
```

## Implementation Checklist

### Phase 1: Dev Infrastructure
- [ ] Create `packages/plugin-babel/src/dev/manager.ts`
- [ ] Create `packages/plugin-babel/src/dev/state-store.ts`
- [ ] Create `packages/plugin-babel/src/dev/index.ts`
- [ ] Add exports to `packages/plugin-babel/package.json`
- [ ] Update tsconfig paths

### Phase 2: Plugin Integration
- [ ] Modify `packages/plugin-babel/src/plugin.ts` - add dev mode detection
- [ ] Update `pre()` hook to use DevManager in dev mode
- [ ] Preserve production mode behavior (one-shot state)
- [ ] Test both dev and production paths

### Phase 3: Cleanup
- [ ] Remove legacy normalize functions (if unused)
- [ ] Remove old artifact-file branches
- [ ] Update all tests to use `createMockArtifactElement`
- [ ] Run quality checks

### Phase 4: Testing
- [ ] Write unit tests for DevManager
- [ ] Write unit tests for StateStore
- [ ] Write integration test for HMR flow
- [ ] Update characterization tests
- [ ] Ensure all existing tests still pass

## Success Criteria

1. ✅ Plugin-babel uses DevBuilderSession in dev mode
2. ✅ State updates automatically on artifact changes
3. ✅ Production builds still work (one-shot state)
4. ✅ All tests pass
5. ✅ Type checking passes
6. ✅ No breaking changes to public API

## Known Issues to Address

1. **Artifact validation failures** - 3 tests failing due to old JSON artifacts missing metadata
   - Fix: Regenerate test fixtures with metadata
   - Files: `tests/fixtures/runtime-app/.cache/soda-gql/runtime.json`

2. **Discovery cache tests** - Pre-existing cache hit issues
   - Status: Skipped for now (unrelated to HMR)
   - File: `tests/unit/builder/discovery/discoverer-invalidation.test.ts`

## Next Steps After Step 4

Once plugin-babel dev mode is complete:

1. **Step 2: Bundler Adapters** (optional)
   - Vite plugin integration
   - Webpack plugin integration
   - Bun plugin integration

2. **Documentation**
   - HMR setup guide
   - Dev mode configuration
   - Migration guide from static artifacts

3. **Performance Optimization**
   - Lazy initialization of DevBuilderSession
   - Debounce artifact updates
   - Memory leak prevention

## Timeline Estimate

- **Phase 1 (Infrastructure):** 2-3 hours
- **Phase 2 (Integration):** 1-2 hours
- **Phase 3 (Cleanup):** 1 hour
- **Phase 4 (Testing):** 2-3 hours

**Total:** ~6-9 hours of focused work

## References

- DevBuilderSession: `packages/plugin-shared/src/dev/session.ts`
- Current plugin: `packages/plugin-babel/src/plugin.ts`
- State preparation: `packages/plugin-shared/src/state.ts`
- Runtime hot API: `packages/core/src/runtime/index.ts`
