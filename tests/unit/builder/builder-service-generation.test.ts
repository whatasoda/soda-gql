import { describe, expect, it } from "bun:test";
import { createBuilderService } from "@soda-gql/builder";
import { makeMockResolvedConfig } from "../../utils/mocks";

/**
 * Unit tests for BuilderService generation tracking.
 * These tests verify the generation tracking API exists and behaves correctly.
 *
 * Note: Full build tests are in integration tests since they require real file fixtures.
 */
describe("BuilderService generation tracking API", () => {
  it("has getGeneration method", () => {
    const service = createBuilderService({
      config: makeMockResolvedConfig({
        outdir: ".cache",
        include: [],
        analyzer: "ts",
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
      }),
      entrypointsOverride: [],
    });

    expect(typeof service.getGeneration).toBe("function");
  });

  it("has getCurrentArtifact method", () => {
    const service = createBuilderService({
      config: makeMockResolvedConfig({
        outdir: ".cache",
        include: [],
        analyzer: "ts",
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
      }),
      entrypointsOverride: [],
    });

    expect(typeof service.getCurrentArtifact).toBe("function");
  });

  it("starts with generation 0", () => {
    const service = createBuilderService({
      config: makeMockResolvedConfig({
        outdir: ".cache",
        include: [],
        analyzer: "ts",
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
      }),
      entrypointsOverride: [],
    });

    expect(service.getGeneration?.()).toBe(0);
  });

  it("returns null before first build", () => {
    const service = createBuilderService({
      config: makeMockResolvedConfig({
        outdir: ".cache",
        include: [],
        analyzer: "ts",
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
      }),
      entrypointsOverride: [],
    });

    expect(service.getCurrentArtifact?.()).toBeNull();
  });

  it("does not increment generation on build error", async () => {
    const service = createBuilderService({
      config: makeMockResolvedConfig({
        outdir: ".cache",
        include: [],
        analyzer: "ts",
        corePath: "@soda-gql/core",
        configDir: "/test",
        configPath: "/test/config.ts",
        configHash: "hash",
        configMtime: 0,
      }),
      entrypointsOverride: [], // Empty entrypoints causes ENTRY_NOT_FOUND error
    });

    const result = await service.build();

    expect(result.isErr()).toBe(true);
    expect(service.getGeneration?.()).toBe(0);
    expect(service.getCurrentArtifact?.()).toBeNull();
  });
});
