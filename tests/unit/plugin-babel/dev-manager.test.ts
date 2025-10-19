import { describe, expect, it } from "bun:test";
import type { BuilderArtifact, BuilderServiceConfig } from "@soda-gql/builder";
import { createDevManager, type StateStore } from "@soda-gql/plugin-babel/dev";
import type { NormalizedOptions } from "@soda-gql/plugin-shared";
import type {
  BuilderServiceController,
  DevBuilderSessionEvent,
  DevBuilderSessionLike,
  DevBuilderSessionOptions,
} from "@soda-gql/plugin-shared/dev";

// Utilities
const deferred = <T>() => {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (!resolve || !reject) {
    throw new Error("[INTERNAL] Promise executor should be synchronous");
  }
  return { promise, resolve, reject };
};

const createMockOptions = (): NormalizedOptions => ({
  importIdentifier: "@soda-gql/runtime",
  diagnostics: "json",
  resolvedConfig: {
    graphqlSystemPath: "./src/graphql-system/index.ts",
    corePath: "@soda-gql/core",
    configDir: "/test",
    configPath: "/test/soda-gql.config.ts",
    configHash: "test-hash",
    configMtime: Date.now(),
    builder: {
      entry: ["**/*.ts"],
      analyzer: "ts",
      outDir: "./.cache",
      mode: "zero-runtime",
    },
    codegen: undefined,
    plugins: {},
  },
  builderConfig: {
    config: {
      graphqlSystemPath: "./src/graphql-system/index.ts",
      corePath: "@soda-gql/core",
      configDir: "/test",
      configPath: "/test/soda-gql.config.ts",
      configHash: "test-hash",
      configMtime: Date.now(),
      builder: {
        entry: ["**/*.ts"],
        analyzer: "ts",
        outDir: "./.cache",
        mode: "zero-runtime",
      },
      codegen: undefined,
      plugins: {},
    },
    entrypoints: ["**/*.ts"],
  },
  project: undefined,
});

const createMockArtifact = (): BuilderArtifact => ({
  elements: {},
  report: {
    durationMs: 100,
    warnings: [],
    stats: {
      hits: 0,
      misses: 0,
      skips: 0,
    },
  },
});

const createMockConfig = (): BuilderServiceConfig => ({
  config: createMockOptions().resolvedConfig,
  entrypoints: ["**/*.ts"],
});

const createMockCoordinatorKey = (): string => "mock-coordinator-key";

const createMockSnapshot = () => ({
  artifact: createMockArtifact(),
  elements: {},
  generation: 0,
  createdAt: Date.now(),
  options: createMockOptions(),
});

// Test Harness
type TestHarness = {
  controller: BuilderServiceController & { buildCalls: number };
  session: DevBuilderSessionLike & {
    listeners: Set<(event: DevBuilderSessionEvent) => void>;
    emit: (event: DevBuilderSessionEvent) => void;
    resolveInitialBuild: () => void;
    rejectInitialBuild: (error: Error) => void;
    resetCalled: boolean;
  };
  stateStore: StateStore & {
    initializeCalls: number;
    updateArtifactCalls: number;
    setErrorCalls: number;
    snapshotValue: any;
  };
  capturedControllerConfig: BuilderServiceConfig | null;
  manager: ReturnType<typeof createDevManager>;
};

const createTestHarness = (): TestHarness => {
  const captured = {
    controllerConfig: null as BuilderServiceConfig | null,
  };

  const initialBuildDeferred = deferred<void>();

  // Mock controller
  const controller: any = {
    buildCalls: 0,
    build: async () => {
      controller.buildCalls++;
      return { ok: true, value: createMockArtifact() };
    },
  };

  // Mock session
  const listeners = new Set<(event: DevBuilderSessionEvent) => void>();
  const session: any = {
    listeners,
    subscribe: (listener: (event: DevBuilderSessionEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ensureInitialBuild: () => initialBuildDeferred.promise,
    emit: (event: DevBuilderSessionEvent) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    resolveInitialBuild: () => initialBuildDeferred.resolve(),
    rejectInitialBuild: (error: Error) => initialBuildDeferred.reject(error),
    reset: () => {
      session.resetCalled = true;
    },
    resetCalled: false,
  };

  // Mock state store
  const stateStore: any = {
    initializeCalls: 0,
    updateArtifactCalls: 0,
    setErrorCalls: 0,
    snapshotValue: null,
    initialize: () => {
      stateStore.initializeCalls++;
      stateStore.snapshotValue = {
        status: "ready",
        state: { options: createMockOptions(), allArtifacts: {} },
      };
    },
    getSnapshot: () => {
      if (!stateStore.snapshotValue) {
        throw new Error("StateStore not initialized");
      }
      return stateStore.snapshotValue;
    },
    getGeneration: () => 0,
    updateArtifact: () => {
      stateStore.updateArtifactCalls++;
    },
    setError: () => {
      stateStore.setErrorCalls++;
    },
    subscribe: () => () => {},
  };

  const manager = createDevManager({
    createController: (config: BuilderServiceConfig) => {
      captured.controllerConfig = config;
      return controller;
    },
    createSession: class {
      constructor(opts: DevBuilderSessionOptions) {
        Object.assign(session, { controller: opts.controller, initialArtifact: opts.initialArtifact });
      }
      subscribe = session.subscribe;
      ensureInitialBuild = session.ensureInitialBuild;
      reset = session.reset;
    } as any,
    createStateStore: () => stateStore,
  });

  return {
    controller,
    session,
    stateStore,
    get capturedControllerConfig() {
      return captured.controllerConfig;
    },
    manager,
  };
};

describe("createDevManager", () => {
  describe("ensureInitialized", () => {
    it("creates controller, session, and state store", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      expect(harness.capturedControllerConfig).toBe(config);
      expect(harness.stateStore.initializeCalls).toBe(0); // No initial artifact
      expect(harness.session.listeners.size).toBe(1);
    });

    it("initializes state store when initial artifact provided", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      expect(harness.stateStore.initializeCalls).toBe(1);
    });

    it("only initializes once on multiple calls", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      const beforeListenerCount = harness.session.listeners.size;

      await harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });

      expect(harness.session.listeners.size).toBe(beforeListenerCount);
    });

    it("waits for ensureInitialBuild to resolve", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      let resolved = false;
      const initPromise = harness.manager
        .ensureInitialized({
          config,
          options,
          coordinatorKey: createMockCoordinatorKey(),
          initialSnapshot: createMockSnapshot(),
        })
        .then(() => {
          resolved = true;
        });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(resolved).toBe(false);

      harness.session.resolveInitialBuild();
      await initPromise;
      expect(resolved).toBe(true);
    });

    it("cleans up on initialization failure", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.rejectInitialBuild(new Error("Build failed"));

      await expect(initPromise).rejects.toThrow("Build failed");
      expect(() => harness.manager.getStateStore()).toThrow("DevManager not initialized");
    });
  });

  describe("event handling", () => {
    it("calls updateArtifact on artifact event when already initialized", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      const newArtifact = createMockArtifact();
      harness.session.emit({
        type: "artifact",
        artifact: newArtifact,
        diff: { added: [], updated: [], removed: [], unchanged: [] },
        source: "incremental",
      });

      expect(harness.stateStore.updateArtifactCalls).toBe(1);
    });

    it("calls initialize on artifact event when not yet initialized", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      const artifact = createMockArtifact();
      harness.session.emit({
        type: "artifact",
        artifact,
        diff: { added: [], updated: [], removed: [], unchanged: [] },
        source: "incremental",
      });

      expect(harness.stateStore.initializeCalls).toBe(1);
    });

    it("calls setError on builder-error event", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      harness.session.emit({
        type: "error",
        error: {
          type: "builder-error",
          error: {
            code: "CONFIG_NOT_FOUND",
            message: "Config not found",
            path: "/test",
          },
        },
        source: "initial",
      });

      expect(harness.stateStore.setErrorCalls).toBe(1);
    });

    it("calls setError on unexpected-error event", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      harness.session.emit({
        type: "error",
        error: {
          type: "unexpected-error",
          error: new Error("Unexpected error"),
        },
        source: "incremental",
      });

      expect(harness.stateStore.setErrorCalls).toBe(1);
    });

    it("does not handle events after dispose", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      harness.manager.dispose();

      const newArtifact = createMockArtifact();
      harness.session.emit({
        type: "artifact",
        artifact: newArtifact,
        diff: { added: [], updated: [], removed: [], unchanged: [] },
        source: "incremental",
      });

      expect(harness.stateStore.updateArtifactCalls).toBe(0);
    });
  });

  describe("getStateStore", () => {
    it("returns state store after initialization", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      const store = harness.manager.getStateStore();
      expect(store).toBe(harness.stateStore);
    });

    it("throws when called before initialization", () => {
      const harness = createTestHarness();

      expect(() => harness.manager.getStateStore()).toThrow("DevManager not initialized");
    });
  });

  describe("dispose", () => {
    it("unsubscribes from session events", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      expect(harness.session.listeners.size).toBe(1);

      harness.manager.dispose();

      expect(harness.session.listeners.size).toBe(0);
    });

    it("calls session reset", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      harness.manager.dispose();

      expect(harness.session.resetCalled).toBe(true);
    });

    it("allows reinitialization after dispose", async () => {
      const harness = createTestHarness();
      const config = createMockConfig();
      const options = createMockOptions();

      const initPromise = harness.manager.ensureInitialized({
        config,
        options,
        coordinatorKey: createMockCoordinatorKey(),
        initialSnapshot: createMockSnapshot(),
      });
      harness.session.resolveInitialBuild();
      await initPromise;

      harness.manager.dispose();

      expect(() => harness.manager.getStateStore()).toThrow("DevManager not initialized");
    });
  });
});
