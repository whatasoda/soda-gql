/**
 * Utilities for creating and managing test workspaces.
 * Provides reusable workspace setup/teardown logic for integration tests.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
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
 * Rewrite graphql-system imports to use the local graphql-system in the workspace.
 * Converts imports like "../../../../codegen-fixture/graphql-system" to relative paths
 * that work within the temp workspace.
 */
const rewriteGraphqlSystemImports = (content: string, filePath: string, workspaceRoot: string): string => {
  // Match imports from codegen-fixture/graphql-system
  const importPattern = /from\s+["']([^"']*codegen-fixture\/graphql-system)["']/g;

  return content.replace(importPattern, (_match, _importPath) => {
    // Calculate relative path from file to workspace's graphql-system
    const fileDir = dirname(filePath);
    const graphqlSystemPath = join(workspaceRoot, "graphql-system");
    const relativePath = relative(fileDir, graphqlSystemPath);

    // Ensure forward slashes for import paths
    const normalizedPath = relativePath.split(sep).join("/");
    return `from "${normalizedPath}"`;
  });
};

/**
 * Copy directory recursively with import rewriting for TypeScript files.
 */
const copyDirWithRewrite = (src: string, dest: string, workspaceRoot: string, filter?: (src: string) => boolean): void => {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    // Apply filter
    if (filter && !filter(srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Skip node_modules and .cache
      if (entry.name === "node_modules" || entry.name === ".cache") {
        continue;
      }
      copyDirWithRewrite(srcPath, destPath, workspaceRoot, filter);
    } else if (entry.name.endsWith(".ts")) {
      // For TypeScript files, rewrite graphql-system imports
      const content = readFileSync(srcPath, "utf-8");
      const rewritten = rewriteGraphqlSystemImports(content, destPath, workspaceRoot);
      writeFileSync(destPath, rewritten, "utf-8");
    } else {
      // Copy other files directly
      const content = readFileSync(srcPath);
      writeFileSync(destPath, content);
    }
  }
};

/**
 * Creates a temporary workspace for testing.
 * Workspace is isolated in OS temp directory with unique timestamp.
 */
export const createWorkspace = (config: WorkspaceConfig): string => {
  const { fixtureRoot, copyFilter = (src) => !src.includes("graphql-system"), symlinkNodeModules = true } = config;

  const tmpRoot = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
  const workspaceRoot = resolve(tmpRoot, `workspace-${Date.now()}`);

  // Clean and copy fixture with import rewriting
  rmSync(workspaceRoot, { recursive: true, force: true });
  copyDirWithRewrite(fixtureRoot, workspaceRoot, workspaceRoot, copyFilter);

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
