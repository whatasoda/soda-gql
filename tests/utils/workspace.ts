/**
 * Utilities for creating and managing test workspaces.
 * Provides reusable workspace setup/teardown logic for integration tests.
 */

import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { copyDefaultInject } from "../fixtures/inject-module";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export type WorkspaceConfig = {
  /** Source fixture directory to copy from */
  fixtureRoot: string;
  /** Filter function for copying files (default: exclude graphql-system) */
  copyFilter?: (src: string) => boolean;
  /** Whether to symlink node_modules (default: true) */
  symlinkNodeModules?: boolean;
};

/**
 * Creates a temporary workspace for testing.
 * Workspace is isolated in OS temp directory with unique timestamp.
 */
export const createWorkspace = (config: WorkspaceConfig): string => {
  const { fixtureRoot, copyFilter = (src) => !src.includes("graphql-system"), symlinkNodeModules = true } = config;

  const tmpRoot = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
  const workspaceRoot = resolve(tmpRoot, `workspace-${Date.now()}`);

  // Clean and copy fixture
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixtureRoot, workspaceRoot, {
    recursive: true,
    filter: copyFilter,
  });

  // Symlink node_modules for module resolution
  if (symlinkNodeModules) {
    const nodeModulesSrc = join(projectRoot, "node_modules");
    const nodeModulesDest = join(workspaceRoot, "node_modules");
    if (!existsSync(nodeModulesDest)) {
      symlinkSync(nodeModulesSrc, nodeModulesDest, "dir");
    }
  }

  return workspaceRoot;
};

/**
 * Sets up GraphQL system for a workspace by running codegen.
 * Returns paths to the generated TS and CJS files.
 */
export const setupGraphqlSystem = async (workspace: string) => {
  const schemaPath = join(workspace, "schema.graphql");
  const graphqlSystemEntry = join(workspace, "graphql-system", "index.ts");
  const injectPath = join(workspace, "graphql-inject.ts");

  // Copy default inject file
  copyDefaultInject(injectPath);

  // Run codegen
  const codegenResult = await runMultiSchemaCodegen({
    schemas: { default: schemaPath },
    outPath: graphqlSystemEntry,
    format: "json",
    injectFromPath: injectPath,
  });

  if (codegenResult.isErr()) {
    throw new Error(`codegen failed: ${codegenResult.error.code}`);
  }

  return {
    tsPath: graphqlSystemEntry,
    cjsPath: codegenResult.value.cjsPath,
  };
};

/**
 * Cleans up a workspace directory.
 */
export const cleanupWorkspace = (workspace: string) => {
  const tmpRoot = dirname(workspace);
  rmSync(tmpRoot, { recursive: true, force: true });
};
