import { describe, expect, test } from "bun:test";
import { getCoreImportPath, getGqlImportPath, resolveImportPath } from "@soda-gql/config/path-resolver";
import { makeMockResolvedConfig } from "../../utils/mocks";

describe("path-resolver.ts", () => {
  describe("resolveImportPath", () => {
    test("resolves relative path with extension mapping", () => {
      const result = resolveImportPath("/project/.cache", "/project/src/graphql-system/index.ts", true);

      expect(result).toBe("../src/graphql-system/index.js");
    });

    test("returns package name as-is", () => {
      const result = resolveImportPath("/project/.cache", "@soda-gql/core", false);

      expect(result).toBe("@soda-gql/core");
    });

    test("handles .mts to .mjs mapping", () => {
      const result = resolveImportPath("/project/.cache", "/project/src/module.mts", true);

      expect(result).toBe("../src/module.mjs");
    });

    test("handles .cts to .cjs mapping", () => {
      const result = resolveImportPath("/project/.cache", "/project/src/module.cts", true);

      expect(result).toBe("../src/module.cjs");
    });

    test("handles .tsx to .js mapping", () => {
      const result = resolveImportPath("/project/.cache", "/project/src/component.tsx", true);

      expect(result).toBe("../src/component.js");
    });

    test("preserves extension when emitted=false", () => {
      const result = resolveImportPath("/project/.cache", "/project/src/module.ts", false);

      expect(result).toBe("../src/module.ts");
    });

    test("adds ./ prefix for relative paths", () => {
      const result = resolveImportPath("/project", "/project/src/module.ts", true);

      expect(result).toBe("./src/module.js");
    });

    test("handles absolute toPath", () => {
      const result = resolveImportPath("/project/.cache", "/project/src/index.ts", true);

      expect(result).toBe("../src/index.js");
    });

    test("handles relative toPath (resolved from fromDir)", () => {
      const result = resolveImportPath("/project/.cache", "../src/index.ts", true);

      expect(result).toBe("../src/index.js");
    });

    test("normalizes Windows-style separators", () => {
      const result = resolveImportPath("/project/.cache", "/project/src\\module.ts", true);

      expect(result).toContain("module.js");
    });
  });

  describe("getGqlImportPath", () => {
    test("resolves gql import path from config", () => {
      const config = makeMockResolvedConfig({
        outdir: "/project/graphql-system",
      });

      const result = getGqlImportPath(config);

      expect(result).toBe("./index.js");
    });

    test("handles different outDir depths", () => {
      const config = makeMockResolvedConfig({
        outdir: "/project/dist",
      });

      const result = getGqlImportPath(config);

      expect(result).toBe("./index.js");
    });
  });

  describe("getCoreImportPath", () => {
    test("resolves core import path without extension mapping", () => {
      const config = makeMockResolvedConfig({
        outdir: "/project/graphql-system",
        corePath: "@soda-gql/core",
      });

      const result = getCoreImportPath(config);

      expect(result).toBe("@soda-gql/core");
    });

    test("handles custom core path", () => {
      const config = makeMockResolvedConfig({
        outdir: "/project/dist",
        corePath: "/project/custom-core",
      });

      const result = getCoreImportPath(config);

      expect(result).toBe("../custom-core");
    });
  });
});
