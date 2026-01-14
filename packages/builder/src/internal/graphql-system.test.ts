import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createGraphqlSystemIdentifyHelper } from "./graphql-system";

/**
 * Helper to write a file, creating parent directories if needed.
 */
const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

/**
 * Create a test config with configurable paths.
 */
const createTestConfig = (options: {
  outdir: string;
  graphqlSystemAliases?: readonly string[];
  scalarsPath: string;
  adapterPath?: string;
}): ResolvedSodaGqlConfig => ({
  analyzer: "ts",
  outdir: options.outdir,
  graphqlSystemAliases: options.graphqlSystemAliases ?? ["@/graphql-system"],
  include: [],
  exclude: [],
  schemas: {
    default: {
      schema: [],
      inject: {
        scalars: options.scalarsPath,
        adapter: options.adapterPath,
      },
      defaultInputDepth: 3,
      inputDepthOverrides: {},
    },
  },
  styles: { importExtension: false },
  plugins: {},
});

describe("createGraphqlSystemIdentifyHelper", () => {
  describe("isInternalModuleFile", () => {
    test("returns true for graphql-system/index.ts", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");

      // Create the files so realpath works
      writeFile(join(outdir, "index.ts"), "export {};");
      writeFile(scalarsPath, "export const scalar = {};");

      const config = createTestConfig({ outdir, scalarsPath });
      const helper = createGraphqlSystemIdentifyHelper(config);

      expect(helper.isInternalModuleFile({ filePath: join(outdir, "index.ts") })).toBe(true);
    });

    test("returns true for scalars file", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");

      writeFile(scalarsPath, "export const scalar = {};");

      const config = createTestConfig({ outdir, scalarsPath });
      const helper = createGraphqlSystemIdentifyHelper(config);

      expect(helper.isInternalModuleFile({ filePath: scalarsPath })).toBe(true);
    });

    test("returns true for adapter file", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");
      const adapterPath = join(tmpDir, "adapter.ts");

      writeFile(scalarsPath, "export const scalar = {};");
      writeFile(adapterPath, "export const adapter = {};");

      const config = createTestConfig({ outdir, scalarsPath, adapterPath });
      const helper = createGraphqlSystemIdentifyHelper(config);

      expect(helper.isInternalModuleFile({ filePath: adapterPath })).toBe(true);
    });

    test("returns false for regular source files", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");
      const sourcePath = join(tmpDir, "source.ts");

      writeFile(scalarsPath, "export const scalar = {};");
      writeFile(sourcePath, "export const foo = 'bar';");

      const config = createTestConfig({ outdir, scalarsPath });
      const helper = createGraphqlSystemIdentifyHelper(config);

      expect(helper.isInternalModuleFile({ filePath: sourcePath })).toBe(false);
    });

    test("handles multiple schemas with different inject paths", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalars1 = join(tmpDir, "schema1", "scalars.ts");
      const scalars2 = join(tmpDir, "schema2", "scalars.ts");
      const adapter2 = join(tmpDir, "schema2", "adapter.ts");

      // Create files
      writeFile(scalars1, "export const scalar = {};");
      writeFile(scalars2, "export const scalar = {};");
      writeFile(adapter2, "export const adapter = {};");

      const config: ResolvedSodaGqlConfig = {
        analyzer: "ts",
        outdir,
        graphqlSystemAliases: ["@/graphql-system"],
        include: [],
        exclude: [],
        schemas: {
          schema1: {
            schema: [],
            inject: { scalars: scalars1 },
            defaultInputDepth: 3,
            inputDepthOverrides: {},
          },
          schema2: {
            schema: [],
            inject: { scalars: scalars2, adapter: adapter2 },
            defaultInputDepth: 3,
            inputDepthOverrides: {},
          },
        },
        styles: { importExtension: false },
        plugins: {},
      };

      const helper = createGraphqlSystemIdentifyHelper(config);

      expect(helper.isInternalModuleFile({ filePath: scalars1 })).toBe(true);
      expect(helper.isInternalModuleFile({ filePath: scalars2 })).toBe(true);
      expect(helper.isInternalModuleFile({ filePath: adapter2 })).toBe(true);
    });
  });

  describe("isGraphqlSystemFile", () => {
    test("returns true only for graphql-system/index.ts, not inject files", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
      const outdir = join(tmpDir, "graphql-system");
      const scalarsPath = join(tmpDir, "scalars.ts");

      writeFile(join(outdir, "index.ts"), "export {};");
      writeFile(scalarsPath, "export const scalar = {};");

      const config = createTestConfig({ outdir, scalarsPath });
      const helper = createGraphqlSystemIdentifyHelper(config);

      // isGraphqlSystemFile should only match graphql-system
      expect(helper.isGraphqlSystemFile({ filePath: join(outdir, "index.ts") })).toBe(true);
      expect(helper.isGraphqlSystemFile({ filePath: scalarsPath })).toBe(false);
    });
  });
});
