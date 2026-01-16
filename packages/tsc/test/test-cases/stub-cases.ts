/**
 * Test case definitions for internal module stubbing conformance testing.
 *
 * Internal modules (graphql-system, scalars, adapter) should be stubbed to `export {};`
 * during transformation. These test cases define the expected behavior.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * A single stub test case with input and expected output.
 */
export type StubTestCase = {
  /** Unique identifier for the test case */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Source code to transform */
  readonly sourceCode: string;
  /** Source file path */
  readonly sourcePath: string;
  /** Config for transformation */
  readonly config: ResolvedSodaGqlConfig;
  /** Empty artifact for transformation */
  readonly artifact: BuilderArtifact;
  /** Whether this file should be stubbed */
  readonly shouldStub: boolean;
};

/**
 * Result of loading stub test cases, including cleanup function.
 */
export type LoadStubTestCasesResult = {
  readonly testCases: StubTestCase[];
  /** Cleanup function to remove temporary files created for test cases. */
  readonly cleanup: () => void;
};

/**
 * Helper to write a file, creating parent directories if needed.
 */
const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

/**
 * Create a canonical temp directory path.
 * On macOS, /var is a symlink to /private/var, so we use realpathSync
 * to get the canonical path that matches what resolveCanonicalPath produces.
 */
const createCanonicalTempDir = (prefix: string): string => {
  const tmpDir = mkdtempSync(join(tmpdir(), prefix));
  return realpathSync(tmpDir);
};

/**
 * Create a test config with configurable paths.
 */
const createStubTestConfig = (options: { outdir: string; scalarsPath: string; adapterPath?: string }): ResolvedSodaGqlConfig => ({
  analyzer: "ts",
  outdir: options.outdir,
  graphqlSystemAliases: ["@/graphql-system"],
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
  codegen: { chunkSize: 100 },
  plugins: {},
});

/**
 * Create an empty artifact for testing.
 */
const createEmptyArtifact = (): BuilderArtifact => ({
  elements: {},
  report: {
    durationMs: 0,
    warnings: [],
    stats: { hits: 0, misses: 0, skips: 0 },
  },
});

/**
 * Load stub test cases for conformance testing.
 *
 * This creates test cases for:
 * - graphql-system/index.ts → should be stubbed
 * - scalars file → should be stubbed
 * - adapter file → should be stubbed
 * - regular files → should NOT be stubbed
 *
 * All transformers (tsc, babel, swc) should produce `export {};` for internal modules.
 *
 * @returns Test cases and a cleanup function to remove temporary files.
 */
export const loadStubTestCases = (): LoadStubTestCasesResult => {
  const tmpDir = createCanonicalTempDir("stub-conformance-test-");
  const outdir = join(tmpDir, "graphql-system");
  const scalarsPath = join(tmpDir, "scalars.ts");
  const adapterPath = join(tmpDir, "adapter.ts");
  const graphqlSystemPath = join(outdir, "index.ts");
  const regularPath = join(tmpDir, "regular.ts");

  // Create files so realpath works correctly
  writeFile(graphqlSystemPath, "export const gql = { default: () => {} };");
  writeFile(scalarsPath, "export const scalar = { ID: {}, String: {} };");
  writeFile(adapterPath, "export const adapter = { fetch: () => {} };");
  writeFile(regularPath, "export const foo = 'bar';");

  const config = createStubTestConfig({ outdir, scalarsPath, adapterPath });
  const artifact = createEmptyArtifact();

  return {
    testCases: [
      {
        id: "stub/graphql-system",
        description: "Stubs graphql-system/index.ts to export {}",
        sourceCode: "export const gql = { default: () => {} };",
        sourcePath: graphqlSystemPath,
        config,
        artifact,
        shouldStub: true,
      },
      {
        id: "stub/scalars",
        description: "Stubs scalars file to export {}",
        sourceCode: "export const scalar = { ID: {}, String: {} };",
        sourcePath: scalarsPath,
        config,
        artifact,
        shouldStub: true,
      },
      {
        id: "stub/adapter",
        description: "Stubs adapter file to export {}",
        sourceCode: "export const adapter = { fetch: () => {} };",
        sourcePath: adapterPath,
        config,
        artifact,
        shouldStub: true,
      },
      {
        id: "stub/regular-file",
        description: "Does not stub regular source files",
        sourceCode: "export const foo = 'bar';",
        sourcePath: regularPath,
        config,
        artifact,
        shouldStub: false,
      },
    ],
    cleanup: () => {
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
};
