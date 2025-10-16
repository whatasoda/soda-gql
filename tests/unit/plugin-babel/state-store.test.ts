import { describe, expect, it } from "bun:test";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createStateStore } from "@soda-gql/plugin-babel/dev";
import type { NormalizedOptions } from "@soda-gql/plugin-shared";

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

const createMockCoordinatorKey = (): string => "mock-coordinator-key";

const createMockSnapshot = () => ({
  artifact: createMockArtifact(),
  elements: {},
  generation: 0,
  createdAt: Date.now(),
  options: createMockOptions(),
});

describe("StateStore", () => {
  it("initializes with options and artifact", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("ready");
    if (snapshot.status === "ready") {
      expect(snapshot.state.options).toBe(options);
      expect(snapshot.state.allArtifacts).toBe(artifact.elements);
    }
    expect(store.getGeneration()).toBe(0);
  });

  it("throws when getting snapshot before initialization", () => {
    const store = createStateStore();

    expect(() => store.getSnapshot()).toThrow("StateStore not initialized");
  });

  it("throws when initializing twice", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());

    expect(() => store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot())).toThrow(
      "StateStore already initialized",
    );
  });

  it("updates artifact and increments generation", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact1 = createMockArtifact();
    const artifact2 = {
      ...createMockArtifact(),
      elements: { "test-id": {} as any },
    };

    store.initialize(options, artifact1, createMockCoordinatorKey(), createMockSnapshot());

    const snapshot1 = store.getSnapshot();
    expect(store.getGeneration()).toBe(0);
    if (snapshot1.status === "ready") {
      expect(Object.keys(snapshot1.state.allArtifacts)).toHaveLength(0);
    }

    store.updateArtifact(artifact2, createMockSnapshot());

    const snapshot2 = store.getSnapshot();
    expect(store.getGeneration()).toBe(1);
    if (snapshot2.status === "ready") {
      expect(Object.keys(snapshot2.state.allArtifacts)).toHaveLength(1);
      expect(snapshot2.state.options).toBe(options); // Options preserved
    }
  });

  it("throws when updating before initialization", () => {
    const store = createStateStore();
    const artifact = createMockArtifact();

    expect(() => store.updateArtifact(artifact, createMockSnapshot())).toThrow("StateStore not initialized");
  });

  it("notifies subscribers on initialization", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let notified = false;

    store.subscribe(() => {
      notified = true;
    });

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());

    expect(notified).toBe(true);
  });

  it("notifies subscribers on artifact update", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let notificationCount = 0;

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());

    store.subscribe(() => {
      notificationCount++;
    });
    // subscribe() immediately notifies with current state
    expect(notificationCount).toBe(1);

    store.updateArtifact(artifact, createMockSnapshot());
    expect(notificationCount).toBe(2);

    store.updateArtifact(artifact, createMockSnapshot());
    expect(notificationCount).toBe(3);
  });

  it("unsubscribes correctly", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let count = 0;

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());

    const unsubscribe = store.subscribe(() => {
      count++;
    });
    // subscribe() immediately notifies with current state
    expect(count).toBe(1);

    store.updateArtifact(artifact, createMockSnapshot());
    expect(count).toBe(2);

    unsubscribe();
    store.updateArtifact(artifact, createMockSnapshot());
    expect(count).toBe(2); // Still 2, not incremented
  });

  it("notifies error subscribers", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let notified = false;

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());

    store.subscribe(() => {
      notified = true;
    });

    store.setError(new Error("Test error"));

    expect(notified).toBe(true);
  });

  it("preserves options across updates", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact1 = createMockArtifact();
    const artifact2 = createMockArtifact();

    store.initialize(options, artifact1, createMockCoordinatorKey(), createMockSnapshot());
    store.updateArtifact(artifact2, createMockSnapshot());

    const snapshot = store.getSnapshot();
    if (snapshot.status === "ready") {
      expect(snapshot.state.options).toBe(options);
    }
  });

  it("returns error snapshot when error is set", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    const error = new Error("Test error");

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());
    store.setError(error);

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("error");
    if (snapshot.status === "error") {
      expect(snapshot.error).toBe(error);
      expect(snapshot.lastValidState).not.toBeNull();
      expect(snapshot.lastValidState?.options).toBe(options);
    }
  });

  it("getState() throws when error is set", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    const error = new Error("Test error");

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());
    store.setError(error);

    expect(() => store.getState()).toThrow(error);
  });

  it("hasError() returns true when error is set", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());
    expect(store.hasError()).toBe(false);

    store.setError(new Error("Test error"));
    expect(store.hasError()).toBe(true);
  });

  it("clears error and returns ready snapshot after updateArtifact", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact1 = createMockArtifact();
    const artifact2 = createMockArtifact();

    store.initialize(options, artifact1, createMockCoordinatorKey(), createMockSnapshot());
    store.setError(new Error("Test error"));
    expect(store.hasError()).toBe(true);

    store.updateArtifact(artifact2, createMockSnapshot());
    expect(store.hasError()).toBe(false);

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("ready");
  });

  it("clearError() clears error state", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());
    store.setError(new Error("Test error"));
    expect(store.hasError()).toBe(true);

    store.clearError();
    expect(store.hasError()).toBe(false);

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("ready");
  });

  it("notifies subscribers with snapshot", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    const snapshots: any[] = [];

    const unsubscribe = store.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });
    // subscribe() immediately notifies, but store is not initialized yet (throws)
    // so initial notification is skipped
    expect(snapshots).toHaveLength(0);

    store.initialize(options, artifact, createMockCoordinatorKey(), createMockSnapshot());
    expect(snapshots).toHaveLength(1);

    store.setError(new Error("Test"));
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].status).toBe("error");

    unsubscribe();
  });
});
