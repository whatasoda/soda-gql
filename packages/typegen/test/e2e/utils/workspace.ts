/**
 * Test workspace utilities for E2E tests.
 *
 * Creates isolated workspaces with codegen already run,
 * following the pattern from packages/sdk/test/integration/prebuild.test.ts.
 *
 * @module
 */

import { cpSync, mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * Result of creating a test workspace.
 */
export type WorkspaceSetup = {
  /** Absolute path to the workspace root directory. */
  readonly workspaceRoot: string;
  /** Resolved config for the workspace. */
  readonly config: ResolvedSodaGqlConfig;
  /** Cleanup function to remove the workspace after test. */
  readonly cleanup: () => Promise<void>;
};

/**
 * Options for creating a test workspace.
 */
export type CreateTestWorkspaceOptions = {
  /** Directory containing fixture files (schema.graphql, scalars.ts). */
  readonly fixtureDir: string;
  /** Source files to copy from fixtures/sources/ to the workspace. */
  readonly sourceFiles: readonly string[];
};

/**
 * Create an isolated test workspace with codegen already run.
 *
 * This function:
 * 1. Creates a temp directory
 * 2. Copies schema and scalars from fixtures
 * 3. Copies and rewrites source files
 * 4. Runs codegen to generate graphql-system
 * 5. Returns a config ready for typegen
 */
export const createTestWorkspace = async (options: CreateTestWorkspaceOptions): Promise<WorkspaceSetup> => {
  const { fixtureDir, sourceFiles } = options;

  // Create temp directory
  const tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-typegen-e2e-"));
  const workspaceRoot = path.join(tmpRoot, `workspace-${Date.now()}`);
  await fs.mkdir(workspaceRoot, { recursive: true });

  // Copy schema and scalars
  const schemaPath = path.join(workspaceRoot, "schema.graphql");
  const scalarsDir = path.join(workspaceRoot, "inject");
  const scalarsPath = path.join(scalarsDir, "scalars.ts");

  cpSync(path.join(fixtureDir, "schema.graphql"), schemaPath);
  await fs.mkdir(scalarsDir, { recursive: true });
  cpSync(path.join(fixtureDir, "scalars.ts"), scalarsPath);

  // Copy and rewrite source files
  const srcDir = path.join(workspaceRoot, "src");
  await fs.mkdir(srcDir, { recursive: true });

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.join(fixtureDir, "sources", sourceFile);
    const destPath = path.join(srcDir, sourceFile);
    await copyAndRewriteImports(sourcePath, destPath, workspaceRoot);
  }

  // Run codegen
  const outPath = path.join(workspaceRoot, "graphql-system", "index.ts");
  const codegenResult = await runCodegen({
    schemas: {
      default: {
        schema: [schemaPath],
        inject: { scalars: scalarsPath },
      },
    },
    outPath,
    format: "json",
  });

  if (codegenResult.isErr()) {
    // Clean up on error
    await fs.rm(tmpRoot, { recursive: true, force: true });
    throw new Error(`codegen failed: ${codegenResult.error.code}`);
  }

  // Create cache directory
  await fs.mkdir(path.join(workspaceRoot, "node_modules/.cache/soda-gql/builder"), { recursive: true });

  // Construct resolved config
  const config: ResolvedSodaGqlConfig = {
    analyzer: "ts",
    outdir: path.join(workspaceRoot, "graphql-system"),
    graphqlSystemAliases: [],
    include: [path.join(workspaceRoot, "src/**/*.ts")],
    exclude: [],
    schemas: {
      default: {
        schema: [schemaPath],
        inject: { scalars: scalarsPath },
        defaultInputDepth: 3,
        inputDepthOverrides: {},
      },
    },
    styles: { importExtension: false },
    plugins: {},
  };

  return {
    workspaceRoot,
    config,
    cleanup: async () => {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    },
  };
};

/**
 * Copy a source file and rewrite its graphql-system imports.
 *
 * Transforms `from "../graphql-system"` to the correct relative path
 * based on the destination file location.
 */
const copyAndRewriteImports = async (srcPath: string, destPath: string, workspaceRoot: string): Promise<void> => {
  let content = await fs.readFile(srcPath, "utf-8");

  // Calculate relative path from dest file to graphql-system
  const fileDir = path.dirname(destPath);
  const graphqlSystemPath = path.join(workspaceRoot, "graphql-system");
  let relativePath = path.relative(fileDir, graphqlSystemPath).replace(/\\/g, "/");

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  // Rewrite imports
  content = content.replace(/from\s+["']\.\.\/graphql-system["']/g, `from "${relativePath}"`);

  await fs.writeFile(destPath, content, "utf-8");
};
