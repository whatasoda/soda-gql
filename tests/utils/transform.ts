import { expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { transformAsync } from "@babel/core";
import type { BuilderArtifact } from "@soda-gql/builder";
import { getPortableFS } from "@soda-gql/common";
import { createTempConfigFile } from "@soda-gql/config";
import createPlugin from "@soda-gql/plugin-babel";
import { getProjectRoot, TestTempDir } from ".";
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
    graphqlSystemPath?: string;
    builder?: {
      entry?: string[];
      outDir?: string;
      analyzer?: "ts";
    };
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
  const tempDir = new TestTempDir("babel-transform");

  try {
    const {
      mode = "zero-runtime",
      importIdentifier = "@/graphql-system",
      skipTypeCheck = false,
      additionalFiles = [],
      configOverrides = {},
    } = options;

    const artifactPath = tempDir.join("artifact.json");
    const fs = getPortableFS();
    await fs.writeFile(artifactPath, JSON.stringify(artifact));

    // Create temp config file that references the artifact
    // Use overrides if provided, otherwise use defaults
    const graphqlSystemPath = configOverrides.graphqlSystemPath ?? "./src/graphql-system/index.ts";
    const builderConfig = {
      entry: configOverrides.builder?.entry ?? ["**/*.ts"],
      analyzer: (configOverrides.builder?.analyzer ?? "ts") as "ts",
      outDir: configOverrides.builder?.outDir ?? "./.cache",
    };

    const configPath = createTempConfigFile(tempDir.path, {
      graphqlSystemPath,
      builder: builderConfig,
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
          createPlugin,
          {
            mode,
            configPath,
            artifact: {
              useBuilder: false,
              path: artifactPath,
            },
            importIdentifier,
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
    tempDir.cleanup();
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
