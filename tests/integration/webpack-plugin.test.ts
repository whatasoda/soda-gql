import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SodaGqlWebpackPlugin, getSharedState, getStateKey } from "@soda-gql/webpack-plugin";

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
      const key = "test-key-" + Date.now();
      const state = getSharedState(key);

      expect(state).toBeDefined();
      expect(state.pluginSession).toBeNull();
      expect(state.currentArtifact).toBeNull();
      expect(state.moduleAdjacency).toBeInstanceOf(Map);
      expect(state.generation).toBe(0);
    });

    it("should return same state for same key", () => {
      const key = "test-key-same-" + Date.now();
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
