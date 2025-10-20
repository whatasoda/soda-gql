import { describe, expect, it } from "bun:test";
import { createBuilderServiceController } from "@soda-gql/plugin-shared/dev";

/**
 * Unit tests for BuilderServiceController generation tracking.
 * These tests verify the generation tracking API exists and behaves correctly.
 *
 * Note: Full build tests are in integration tests since they require real file fixtures.
 */
describe("BuilderServiceController generation tracking API", () => {
  it("has getGeneration method", () => {
    const controller = createBuilderServiceController({
      config: {
        graphqlSystemPath: "./test.ts",
        graphqlSystemAlias: undefined,
        graphqlSystemAlias: undefined,
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
        builder: { entry: [], analyzer: "ts", outDir: ".cache" },
        codegen: undefined,
        plugins: {},
      },
      entrypointsOverride: [],
    });

    expect(typeof controller.getGeneration).toBe("function");
  });

  it("has getCurrentArtifact method", () => {
    const controller = createBuilderServiceController({
      config: {
        graphqlSystemPath: "./test.ts",
        graphqlSystemAlias: undefined,
        graphqlSystemAlias: undefined,
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
        builder: { entry: [], analyzer: "ts", outDir: ".cache" },
        codegen: undefined,
        plugins: {},
      },
      entrypointsOverride: [],
    });

    expect(typeof controller.getCurrentArtifact).toBe("function");
  });

  it("starts with generation 0", () => {
    const controller = createBuilderServiceController({
      config: {
        graphqlSystemPath: "./test.ts",
        graphqlSystemAlias: undefined,
        graphqlSystemAlias: undefined,
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
        builder: { entry: [], analyzer: "ts", outDir: ".cache" },
        codegen: undefined,
        plugins: {},
      },
      entrypointsOverride: [],
    });

    expect(controller.getGeneration()).toBe(0);
  });

  it("returns null before first build", () => {
    const controller = createBuilderServiceController({
      config: {
        graphqlSystemPath: "./test.ts",
        graphqlSystemAlias: undefined,
        graphqlSystemAlias: undefined,
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
        builder: { entry: [], analyzer: "ts", outDir: ".cache" },
        codegen: undefined,
        plugins: {},
      },
      entrypointsOverride: [],
    });

    expect(controller.getCurrentArtifact()).toBeNull();
  });

  it("does not increment generation on build error", async () => {
    const controller = createBuilderServiceController({
      config: {
        graphqlSystemPath: "./test.ts",
        graphqlSystemAlias: undefined,
        graphqlSystemAlias: undefined,
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
        builder: { entry: [], analyzer: "ts", outDir: ".cache" },
        codegen: undefined,
        plugins: {},
      },
      entrypointsOverride: [], // Empty entrypoints causes ENTRY_NOT_FOUND error
    });

    const result = await controller.build();

    expect(result.isErr()).toBe(true);
    expect(controller.getGeneration()).toBe(0);
    expect(controller.getCurrentArtifact()).toBeNull();
  });

  it("resets generation on reset", async () => {
    const controller = createBuilderServiceController({
      config: {
        graphqlSystemPath: "./test.ts",
        graphqlSystemAlias: undefined,
        graphqlSystemAlias: undefined,
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
        builder: { entry: [], analyzer: "ts", outDir: ".cache" },
        codegen: undefined,
        plugins: {},
      },
      entrypointsOverride: [],
    });

    // Trigger error build to ensure generation stays at 0
    await controller.build();
    expect(controller.getGeneration()).toBe(0);

    controller.reset();
    expect(controller.getGeneration()).toBe(0);
    expect(controller.getCurrentArtifact()).toBeNull();
  });
});
