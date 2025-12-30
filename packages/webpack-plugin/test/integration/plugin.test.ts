import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getSharedBuilderService,
  getSharedPluginSession,
  getSharedState,
  getStateKey,
  SodaGqlWebpackPlugin,
  setSharedBuilderService,
  setSharedPluginSession,
} from "@soda-gql/webpack-plugin";

describe("Webpack Plugin", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "webpack-plugin-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("SodaGqlWebpackPlugin", () => {
    it("should create plugin instance with default options", () => {
      const plugin = new SodaGqlWebpackPlugin();
      expect(plugin).toBeDefined();
      expect(typeof plugin.apply).toBe("function");
    });

    it("should create plugin instance with custom options", () => {
      const plugin = new SodaGqlWebpackPlugin({
        configPath: "./soda-gql.config.ts",
        debug: true,
      });
      expect(plugin).toBeDefined();
    });

    it("should expose getArtifact method", () => {
      const plugin = new SodaGqlWebpackPlugin();
      expect(typeof plugin.getArtifact).toBe("function");
      // Initially null before any build
      expect(plugin.getArtifact()).toBeNull();
    });

    it("should expose getPendingInvalidations method", () => {
      const plugin = new SodaGqlWebpackPlugin();
      expect(typeof plugin.getPendingInvalidations).toBe("function");
      // Initially empty
      const invalidations = plugin.getPendingInvalidations();
      expect(invalidations.size).toBe(0);
    });
  });

  describe("Shared State", () => {
    it("should initialize shared state for new key", () => {
      const key = `test-key-${Date.now()}`;
      const state = getSharedState(key);

      expect(state).toBeDefined();
      expect(state.pluginSession).toBeNull();
      expect(state.currentArtifact).toBeNull();
      expect(state.moduleAdjacency).toBeInstanceOf(Map);
      expect(state.generation).toBe(0);
    });

    it("should return same state for same key", () => {
      const key = `test-key-same-${Date.now()}`;
      const state1 = getSharedState(key);
      const state2 = getSharedState(key);

      expect(state1).toBe(state2);
    });

    it("should generate state key from config path", () => {
      const configPath = "/path/to/config.ts";
      const key = getStateKey(configPath);
      expect(key).toBe(configPath);
    });

    it("should use cwd as default state key", () => {
      const key = getStateKey(undefined);
      expect(key).toBe(process.cwd());
    });
  });

  describe("Plugin Configuration", () => {
    it("should accept include patterns", () => {
      const plugin = new SodaGqlWebpackPlugin({
        include: /\.tsx?$/,
      });
      expect(plugin).toBeDefined();
    });

    it("should accept exclude patterns", () => {
      const plugin = new SodaGqlWebpackPlugin({
        exclude: [/node_modules/, /\.test\.ts$/],
      });
      expect(plugin).toBeDefined();
    });

    it("should accept enabled option", () => {
      const plugin = new SodaGqlWebpackPlugin({
        enabled: false,
      });
      expect(plugin).toBeDefined();
    });
  });
});

describe("Webpack Loader", () => {
  // Note: Full loader testing requires actual webpack compilation
  // which is more complex to set up. These are basic import tests.

  it("should export default loader function", async () => {
    const loaderModule = await import("@soda-gql/webpack-plugin/loader");
    expect(typeof loaderModule.default).toBe("function");
  });

  it("should export raw flag as false", async () => {
    const loaderModule = await import("@soda-gql/webpack-plugin/loader");
    expect(loaderModule.raw).toBe(false);
  });
});

describe("Session Reuse (Next.js Multi-Compilation)", () => {
  // Generate unique test key to avoid test interference
  const testKey = () => `session-reuse-${Date.now()}-${Math.random()}`;

  it("should reuse shared PluginSession when available", () => {
    const key = testKey();

    // Simulate first plugin instance setting a session
    const mockSession = {
      config: {} as Parameters<typeof setSharedPluginSession>[1] extends { config: infer C } ? C : never,
      getArtifact: () => null,
      getArtifactAsync: async () => null,
    } as Parameters<typeof setSharedPluginSession>[1];
    setSharedPluginSession(key, mockSession);

    // Verify session is retrievable
    const retrieved = getSharedPluginSession(key);
    expect(retrieved).toBe(mockSession);
  });

  it("should share BuilderService across PluginSession instances", () => {
    const key = testKey();

    // First call should return null
    expect(getSharedBuilderService(key)).toBeNull();

    // Simulate setting a BuilderService
    const mockService = {
      build: () => {},
      buildAsync: async () => {},
      getGeneration: () => 0,
      getCurrentArtifact: () => null,
      dispose: () => {},
    } as unknown as Parameters<typeof setSharedBuilderService>[1];
    setSharedBuilderService(key, mockService);

    // Second call should return the same service
    expect(getSharedBuilderService(key)).toBe(mockService);
  });

  it("should use same state key for plugins with same configPath", () => {
    const configPath = `/tmp/test-config-${Date.now()}.ts`;

    // Both plugins should derive the same state key
    const key1 = getStateKey(configPath);
    const key2 = getStateKey(configPath);

    expect(key1).toBe(key2);
    expect(key1).toBe(configPath);
  });

  it("should use different state keys for different configPaths", () => {
    const configPath1 = `/tmp/config1-${Date.now()}.ts`;
    const configPath2 = `/tmp/config2-${Date.now()}.ts`;

    const key1 = getStateKey(configPath1);
    const key2 = getStateKey(configPath2);

    expect(key1).not.toBe(key2);
  });

  it("should initialize SharedState with null builderService", () => {
    const key = testKey();
    const state = getSharedState(key);

    expect(state.builderService).toBeNull();
  });
});
