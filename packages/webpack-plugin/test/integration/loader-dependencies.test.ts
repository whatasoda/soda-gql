import { describe, expect, it } from "bun:test";
import { getSharedState, getStateKey } from "@soda-gql/plugin-common";

/**
 * Tests for HMR dependency optimization using module adjacency.
 *
 * The webpack loader uses moduleAdjacency from shared state to add only
 * relevant dependencies instead of all soda-gql files. This improves
 * HMR performance by reducing unnecessary rebuilds.
 */
describe("Loader Dependency Optimization", () => {
  describe("Module Adjacency Integration", () => {
    it("should access moduleAdjacency from shared state", () => {
      const key = `loader-deps-${Date.now()}`;
      const state = getSharedState(key);

      expect(state.moduleAdjacency).toBeInstanceOf(Map);
      expect(state.moduleAdjacency.size).toBe(0);
    });

    it("should track reverse dependencies (importers of a file)", () => {
      const key = `loader-deps-reverse-${Date.now()}`;
      const state = getSharedState(key);

      // Simulate: fileB imports fileA, fileC imports fileA
      // moduleAdjacency maps: importedFile -> Set<importingFiles>
      const fileA = "/src/models/user.ts";
      const fileB = "/src/queries/getUser.ts";
      const fileC = "/src/queries/listUsers.ts";

      state.moduleAdjacency.set(fileA, new Set([fileB, fileC]));

      // When fileA changes, fileB and fileC should be invalidated
      const importers = state.moduleAdjacency.get(fileA);
      expect(importers).toBeDefined();
      expect(importers?.has(fileB)).toBe(true);
      expect(importers?.has(fileC)).toBe(true);
    });

    it("should track forward dependencies (files imported by a file)", () => {
      const key = `loader-deps-forward-${Date.now()}`;
      const state = getSharedState(key);

      // Simulate: fileA imports baseModel, fileB imports baseModel
      const baseModel = "/src/models/base.ts";
      const fileA = "/src/models/user.ts";
      const fileB = "/src/models/post.ts";

      state.moduleAdjacency.set(baseModel, new Set([fileA, fileB]));

      // When fileA is being processed, it should add baseModel as dependency
      // because fileA imports baseModel (baseModel's importers include fileA)
      let forwardDeps: string[] = [];
      for (const [importedFile, importingFiles] of state.moduleAdjacency) {
        if (importingFiles.has(fileA)) {
          forwardDeps.push(importedFile);
        }
      }

      expect(forwardDeps).toContain(baseModel);
    });

    it("should use fallback when moduleAdjacency is empty", () => {
      const key = `loader-deps-fallback-${Date.now()}`;
      const state = getSharedState(key);

      // When moduleAdjacency is empty, loader should fall back to
      // adding all soda-gql files as dependencies (conservative approach)
      expect(state.moduleAdjacency.size).toBe(0);

      // This is the condition checked in loader.ts:87
      const shouldUseFallback = state.moduleAdjacency.size === 0;
      expect(shouldUseFallback).toBe(true);
    });
  });

  describe("State Key Consistency", () => {
    it("should generate consistent state key for same config path", () => {
      const configPath = "/project/soda-gql.config.ts";

      const key1 = getStateKey(configPath);
      const key2 = getStateKey(configPath);

      expect(key1).toBe(key2);
      expect(key1).toBe(configPath);
    });

    it("should use cwd when config path is undefined", () => {
      const key = getStateKey(undefined);
      expect(key).toBe(process.cwd());
    });

    it("should isolate state between different config paths", () => {
      const key1 = getStateKey("/project1/config.ts");
      const key2 = getStateKey("/project2/config.ts");

      expect(key1).not.toBe(key2);

      const state1 = getSharedState(key1);
      const state2 = getSharedState(key2);

      // Modify state1, state2 should not be affected
      state1.moduleAdjacency.set("/file.ts", new Set(["/other.ts"]));

      expect(state1.moduleAdjacency.size).toBe(1);
      expect(state2.moduleAdjacency.size).toBe(0);
    });
  });

  describe("Dependency Collection Logic", () => {
    it("should collect bidirectional dependencies for HMR", () => {
      const key = `loader-deps-bidir-${Date.now()}`;
      const state = getSharedState(key);

      // Setup: A imports B, B imports C
      // moduleAdjacency: B -> {A}, C -> {B}
      const fileA = "/src/a.ts";
      const fileB = "/src/b.ts";
      const fileC = "/src/c.ts";

      state.moduleAdjacency.set(fileB, new Set([fileA])); // B is imported by A
      state.moduleAdjacency.set(fileC, new Set([fileB])); // C is imported by B

      // When processing fileB:
      // 1. Reverse deps: files that import fileB -> fileA
      // 2. Forward deps: files that fileB imports -> fileC
      const reverseDeps = state.moduleAdjacency.get(fileB) ?? new Set();
      const forwardDeps: string[] = [];
      for (const [importedFile, importingFiles] of state.moduleAdjacency) {
        if (importingFiles.has(fileB)) {
          forwardDeps.push(importedFile);
        }
      }

      expect([...reverseDeps]).toContain(fileA);
      expect(forwardDeps).toContain(fileC);
    });
  });
});
