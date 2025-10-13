import { describe, expect, it } from "bun:test";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { NormalizedOptions } from "@soda-gql/plugin-shared";
import { createStateStore } from "@soda-gql/plugin-babel/dev";

const createMockOptions = (): NormalizedOptions => ({
  mode: "zero-runtime",
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
  artifact: {
    type: "builder",
    config: {
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
  },
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

describe("StateStore", () => {
  it("initializes with options and artifact", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();

    store.initialize(options, artifact);

    const snapshot = store.getSnapshot();
    expect(snapshot.options).toBe(options);
    expect(snapshot.allArtifacts).toBe(artifact.elements);
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

    store.initialize(options, artifact);

    expect(() => store.initialize(options, artifact)).toThrow("StateStore already initialized");
  });

  it("updates artifact and increments generation", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact1 = createMockArtifact();
    const artifact2 = {
      ...createMockArtifact(),
      elements: { "test-id": {} as any },
    };

    store.initialize(options, artifact1);

    const snapshot1 = store.getSnapshot();
    expect(store.getGeneration()).toBe(0);
    expect(Object.keys(snapshot1.allArtifacts)).toHaveLength(0);

    store.updateArtifact(artifact2);

    const snapshot2 = store.getSnapshot();
    expect(store.getGeneration()).toBe(1);
    expect(Object.keys(snapshot2.allArtifacts)).toHaveLength(1);
    expect(snapshot2.options).toBe(options); // Options preserved
  });

  it("throws when updating before initialization", () => {
    const store = createStateStore();
    const artifact = createMockArtifact();

    expect(() => store.updateArtifact(artifact)).toThrow("StateStore not initialized");
  });

  it("notifies subscribers on initialization", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let notified = false;

    store.subscribe(() => {
      notified = true;
    });

    store.initialize(options, artifact);

    expect(notified).toBe(true);
  });

  it("notifies subscribers on artifact update", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let notificationCount = 0;

    store.initialize(options, artifact);

    store.subscribe(() => {
      notificationCount++;
    });

    store.updateArtifact(artifact);
    expect(notificationCount).toBe(1);

    store.updateArtifact(artifact);
    expect(notificationCount).toBe(2);
  });

  it("unsubscribes correctly", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let count = 0;

    store.initialize(options, artifact);

    const unsubscribe = store.subscribe(() => {
      count++;
    });

    store.updateArtifact(artifact);
    expect(count).toBe(1);

    unsubscribe();
    store.updateArtifact(artifact);
    expect(count).toBe(1); // Still 1, not incremented
  });

  it("notifies error subscribers", () => {
    const store = createStateStore();
    const options = createMockOptions();
    const artifact = createMockArtifact();
    let notified = false;

    store.initialize(options, artifact);

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

    store.initialize(options, artifact1);
    store.updateArtifact(artifact2);

    const snapshot = store.getSnapshot();
    expect(snapshot.options).toBe(options);
  });
});
