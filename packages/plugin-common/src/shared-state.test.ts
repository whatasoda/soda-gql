import { describe, expect, it } from "bun:test";
import type { BuilderService } from "@soda-gql/builder";
import { getSharedBuilderService, getSharedState, getStateKey, setSharedBuilderService } from "./shared-state";

describe("shared-state", () => {
  // Generate unique test key to avoid test interference
  const testKey = () => `test-key-${Date.now()}-${Math.random()}`;

  describe("getStateKey", () => {
    it("should return config path when provided", () => {
      const configPath = "/path/to/config.ts";
      expect(getStateKey(configPath)).toBe(configPath);
    });

    it("should return cwd when config path is undefined", () => {
      expect(getStateKey(undefined)).toBe(process.cwd());
    });
  });

  describe("getSharedState", () => {
    it("should initialize state with null builderService", () => {
      const key = testKey();
      const state = getSharedState(key);
      expect(state.builderService).toBeNull();
    });

    it("should return same state for same key", () => {
      const key = testKey();
      const state1 = getSharedState(key);
      const state2 = getSharedState(key);
      expect(state1).toBe(state2);
    });

    it("should return different state for different keys", () => {
      const key1 = testKey();
      const key2 = testKey();
      const state1 = getSharedState(key1);
      const state2 = getSharedState(key2);
      expect(state1).not.toBe(state2);
    });
  });

  describe("BuilderService caching", () => {
    it("should return null when no BuilderService is set", () => {
      const key = testKey();
      expect(getSharedBuilderService(key)).toBeNull();
    });

    it("should store and retrieve BuilderService", () => {
      const key = testKey();
      const mockService = { build: () => {}, buildAsync: () => {} } as unknown as BuilderService;

      setSharedBuilderService(key, mockService);
      expect(getSharedBuilderService(key)).toBe(mockService);
    });

    it("should return same BuilderService for same key", () => {
      const key = testKey();
      const mockService = { build: () => {}, buildAsync: () => {} } as unknown as BuilderService;

      setSharedBuilderService(key, mockService);
      const retrieved1 = getSharedBuilderService(key);
      const retrieved2 = getSharedBuilderService(key);

      expect(retrieved1).toBe(retrieved2);
      expect(retrieved1).toBe(mockService);
    });

    it("should allow clearing BuilderService by setting null", () => {
      const key = testKey();
      const mockService = { build: () => {}, buildAsync: () => {} } as unknown as BuilderService;

      setSharedBuilderService(key, mockService);
      expect(getSharedBuilderService(key)).toBe(mockService);

      setSharedBuilderService(key, null);
      expect(getSharedBuilderService(key)).toBeNull();
    });

    it("should isolate BuilderService by key", () => {
      const key1 = testKey();
      const key2 = testKey();
      const service1 = { id: 1 } as unknown as BuilderService;
      const service2 = { id: 2 } as unknown as BuilderService;

      setSharedBuilderService(key1, service1);
      setSharedBuilderService(key2, service2);

      expect(getSharedBuilderService(key1)).toBe(service1);
      expect(getSharedBuilderService(key2)).toBe(service2);
    });
  });
});
