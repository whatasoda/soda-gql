import { expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { transformAsync } from "@babel/core";
import type { BuilderArtifact } from "@soda-gql/builder";
import { getPortableFS } from "@soda-gql/common";
import { createTempConfigFile } from "@soda-gql/config";
import { createSodaGqlPlugin } from "@soda-gql/plugin-babel";
import { getProjectRoot } from ".";
import { typeCheckFiles } from "./type-check";

const resolveBiomeBinary = (): string => {
  const projectRoot = getProjectRoot();
  const binaryName = process.platform === "win32" ? "biome.cmd" : "biome";
  return join(projectRoot, "node_modules", ".bin", binaryName);
};

const formatWithBiome = (code: string, filePath: string): string => {
  const biomeBinary = resolveBiomeBinary();
  const result = spawnSync(biomeBinary, ["format", "--stdin-file-path", filePath], {
    cwd: getProjectRoot(),
    input: code,
    encoding: "utf-8",
    maxBuffer: 5 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Failed to spawn Biome CLI at ${biomeBinary}`, { cause: result.error });
  }

  if (typeof result.status === "number" && result.status !== 0) {
    const details = (result.stderr ?? result.stdout ?? "").trim();
    throw new Error(`Biome formatting failed for ${filePath} (exit ${result.status}).\n${details}`);
  }

  if (!result.stdout) {
    return code;
  }

  return result.stdout.length > 0 ? result.stdout : code;
};

export type TransformOptions = {
  mode?: "zero-runtime" | "runtime";
  importIdentifier?: string;
  skipTypeCheck?: boolean;
  additionalFiles?: Array<{ path: string; content: string }>; // Additional files for type checking context
  configOverrides?: {
    outdir?: string;
    include?: string[];
    analyzer?: "ts";
  };
};

/**
 * Run Babel transform with the soda-gql plugin
 */
export const runBabelTransform = async (
  source: string,
  filename: string,
  artifact: BuilderArtifact,
  options: TransformOptions = {},
): Promise<string> => {
  const projectRoot = getProjectRoot();
  const tempDirPath = join(projectRoot, "tests/.tmp/babel-transform", `${Date.now()}`);
  mkdirSync(tempDirPath, { recursive: true });

  try {
    const {
      mode: _mode = "zero-runtime",
      importIdentifier: _importIdentifier = "@/graphql-system",
      skipTypeCheck = false,
      additionalFiles = [],
      configOverrides = {},
    } = options;

    const artifactPath = join(tempDirPath, "artifact.json");
    const fs = getPortableFS();
    await fs.writeFile(artifactPath, JSON.stringify(artifact));

    // Create temp config file that references the artifact
    // Config is created in project directory so it can resolve @soda-gql/config
    const configPath = createTempConfigFile(tempDirPath, {
      outdir: configOverrides.outdir ?? join(projectRoot, "graphql-system"),
      include: configOverrides.include ?? [join(projectRoot, "**/*.ts")],
      analyzer: configOverrides.analyzer ?? "ts",
      schemas: {
        default: {
          schema: join(projectRoot, "tests/fixtures/runtime-app/schema.graphql"),
          runtimeAdapter: join(projectRoot, "tests/fixtures/inject-module/default-runtime-adapter.ts"),
          scalars: join(projectRoot, "tests/fixtures/inject-module/default-scalar.ts"),
        },
      },
    });

    const result = await transformAsync(source, {
      filename,
      configFile: false,
      babelrc: false,
      parserOpts: {
        sourceType: "module",
        plugins: ["typescript"],
      },
      plugins: [
        [
          createSodaGqlPlugin,
          {
            configPath,
            artifact: {
              useBuilder: false,
              path: artifactPath,
            },
          },
        ],
      ],
    });

    const transformed = result?.code ?? "";
    const formatted = formatWithBiome(transformed, filename);

    // Type-check unless explicitly skipped
    if (!skipTypeCheck) {
      try {
        // Include the main file and any additional files for comprehensive type checking
        const allFiles = [{ path: filename, content: formatted }, ...additionalFiles];
        await typeCheckFiles(allFiles);
      } catch (error) {
        console.error(`Type check failed for ${filename}.\n-----\n${formatted}\n-----`);
        throw error;
      }
    }

    return formatted;
  } finally {
    rmSync(tempDirPath, { recursive: true, force: true });
  }
};

/**
 * Assert that transform removes gql calls
 */
export const assertTransformRemovesGql = (transformed: string): void => {
  expect(transformed).not.toContain("gql.query(");
  expect(transformed).not.toContain("gql.model(");
  expect(transformed).not.toContain("gql.querySlice(");
  expect(transformed).not.toContain("gql.fragment(");
};

/**
 * Assert that transform adds runtime import
 */
export const assertTransformAddsRuntimeImport = (transformed: string, identifier = "@soda-gql/runtime"): void => {
  expect(transformed).toContain(`import { gqlRuntime, type graphql } from "${identifier}"`);
};

/**
 * Assert that transform uses runtime calls
 */
export const assertTransformUsesRuntime = (transformed: string): void => {
  const hasRuntimeCall = /gqlRuntime\.(query|model|querySlice|fragment)\(/.test(transformed);
  expect(hasRuntimeCall).toBe(true);
};

/**
 * Assert complete zero-runtime transformation
 */
export const assertZeroRuntimeTransform = (transformed: string, importIdentifier = "@soda-gql/runtime"): void => {
  assertTransformRemovesGql(transformed);
  assertTransformAddsRuntimeImport(transformed, importIdentifier);
  assertTransformUsesRuntime(transformed);
};

/**
 * Assert that transform preserves imports
 */
export const assertTransformPreservesImports = (transformed: string, imports: string[]): void => {
  for (const importStr of imports) {
    expect(transformed).toContain(importStr);
  }
};

/**
 * Assert that transform contains specific runtime call
 */
export const assertTransformContainsRuntimeCall = (
  transformed: string,
  method: "query" | "model" | "querySlice" | "fragment",
  expectedArgs?: string,
): void => {
  const pattern = expectedArgs ? `gqlRuntime.${method}(${expectedArgs})` : `gqlRuntime.${method}(`;
  expect(transformed).toContain(pattern);
};

/**
 * Create a simple source code for testing transforms
 */
export const createTestSource = (content: string, imports = 'import { gql } from "@soda-gql/core";'): string => {
  return `${imports}

${content}`;
};

/**
 * Parse transformed code and extract runtime calls
 */
export const extractRuntimeCalls = (transformed: string): Array<{ method: string; args: string }> => {
  const calls: Array<{ method: string; args: string }> = [];
  const regex = /gqlRuntime\.(\w+)\(([\s\S]*?)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(transformed)) !== null) {
    calls.push({
      method: match[1] ?? "",
      args: match[2]?.trim() ?? "",
    });
  }

  return calls;
};
