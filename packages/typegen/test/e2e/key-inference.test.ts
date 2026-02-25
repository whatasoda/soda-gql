/**
 * E2E tests for typegen key inference.
 *
 * These tests validate the complete codegen → typegen flow,
 * ensuring that fragment keys and operation names are correctly
 * included in the generated PrebuiltTypes.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runTypegen } from "../../src/runner";
import { createTestWorkspace, type WorkspaceSetup } from "./utils/workspace";

const fixtureDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const projectRoot = resolve(fileURLToPath(import.meta.url), "../../../../..");
const tscPath = join(projectRoot, "node_modules/.bin/tsc");

describe("typegen key inference E2E", () => {
  describe("fragment with key", () => {
    let workspace: WorkspaceSetup;

    beforeEach(async () => {
      workspace = await createTestWorkspace({
        fixtureDir,
        sourceFiles: ["fragment-with-key.ts"],
      });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    test("generates PrebuiltTypes with keyed fragment", async () => {
      const result = await runTypegen({ config: workspace.config });

      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      const { fragmentCount, operationCount } = result.value;
      expect(fragmentCount).toBe(1);
      expect(operationCount).toBe(0);

      // Verify types.prebuilt.ts contains the fragment key
      const typesPath = join(workspace.config.outdir, "types.prebuilt.ts");
      expect(existsSync(typesPath)).toBe(true);

      const typesContent = readFileSync(typesPath, "utf-8");
      expect(typesContent).toContain('"UserFields"');
      expect(typesContent).toContain("readonly fragments:");
    });

    test(
      "generated types pass tsc --noEmit",
      async () => {
        const result = await runTypegen({ config: workspace.config });
        expect(result.isOk()).toBe(true);

        // Run tsc --noEmit on the generated types
        // Use project's tsc to ensure consistent TypeScript version
        const proc = Bun.spawn([tscPath, "--noEmit"], {
          cwd: workspace.workspaceRoot,
          stdout: "pipe",
          stderr: "pipe",
        });

        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          const stdout = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();
          console.error("tsc errors:", stdout || stderr);
        }

        expect(exitCode).toBe(0);
      },
      { timeout: 30_000 },
    );
  });

  describe("fragment without key", () => {
    let workspace: WorkspaceSetup;

    beforeEach(async () => {
      workspace = await createTestWorkspace({
        fixtureDir,
        sourceFiles: ["fragment-without-key.ts"],
      });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    test("tagged template fragments always have a key (fragment name)", async () => {
      const result = await runTypegen({ config: workspace.config });

      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      const { fragmentCount, operationCount } = result.value;
      // Tagged template fragments always have a key (the GraphQL fragment name)
      expect(fragmentCount).toBe(1);
      expect(operationCount).toBe(0);
    });
  });

  describe("operation with name", () => {
    let workspace: WorkspaceSetup;

    beforeEach(async () => {
      workspace = await createTestWorkspace({
        fixtureDir,
        sourceFiles: ["operation-with-name.ts"],
      });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    test("generates PrebuiltTypes with named operation", async () => {
      const result = await runTypegen({ config: workspace.config });

      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      const { fragmentCount, operationCount } = result.value;
      expect(fragmentCount).toBe(0);
      expect(operationCount).toBe(1);

      // Verify types.prebuilt.ts contains the operation name
      const typesPath = join(workspace.config.outdir, "types.prebuilt.ts");
      const typesContent = readFileSync(typesPath, "utf-8");
      expect(typesContent).toContain('"GetUser"');
      expect(typesContent).toContain("readonly operations:");
    });
  });

  describe("mixed keyed and named elements", () => {
    let workspace: WorkspaceSetup;

    beforeEach(async () => {
      workspace = await createTestWorkspace({
        fixtureDir,
        sourceFiles: ["mixed-elements.ts"],
      });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    test("generates PrebuiltTypes for keyed fragments and named operations", async () => {
      const result = await runTypegen({ config: workspace.config });

      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      const { fragmentCount, operationCount } = result.value;
      expect(fragmentCount).toBe(1);
      expect(operationCount).toBe(1);

      const typesPath = join(workspace.config.outdir, "types.prebuilt.ts");
      const typesContent = readFileSync(typesPath, "utf-8");
      expect(typesContent).toContain('"KeyedUserFields"');
      expect(typesContent).toContain('"GetUsers"');
    });
  });

  describe("type-level verification", () => {
    let workspace: WorkspaceSetup;

    beforeEach(async () => {
      workspace = await createTestWorkspace({
        fixtureDir,
        sourceFiles: ["fragment-with-key.ts", "operation-with-name.ts"],
      });
    });

    afterEach(async () => {
      await workspace.cleanup();
    });

    // This test verifies that prebuilt type inference works correctly.
    // Codegen generates PrebuiltContext types in index.ts that preserve
    // TKey for fragments and TOperationName for operations.
    test.skip(
      "prebuilt module compiles with correct type resolution",
      async () => {
        const result = await runTypegen({ config: workspace.config });
        expect(result.isOk()).toBe(true);

        // Create a type-check file in src directory (covered by tsconfig.json)
        const typeCheckFile = join(workspace.workspaceRoot, "src", "type-check.ts");
        const typeCheckContent = `
import { gql, type PrebuiltContext_default } from "../graphql-system";

// Test 1: Fragment with key should resolve to prebuilt types
const userFragment = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{ id name }\`()
);

// Type assertion: output should be an object type (not PrebuiltEntryNotFound)
type FragmentOutput = typeof userFragment.$infer.output;
const _testFragmentOutput: FragmentOutput extends { __error: string } ? never : true = true;

// Test 2: Operation with name should resolve to prebuilt types
const getUser = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`()
);

// Type assertion: output should be an object type (not PrebuiltEntryNotFound)
type OperationOutput = typeof getUser.$infer.output;
const _testOperationOutput: OperationOutput extends { __error: string } ? never : true = true;
`;

        const fs = await import("node:fs/promises");
        await fs.writeFile(typeCheckFile, typeCheckContent, "utf-8");

        // Run tsc with --project to use workspace tsconfig.json
        // Use project's tsc to ensure consistent TypeScript version
        const proc = Bun.spawn([tscPath, "--noEmit", "--project", workspace.workspaceRoot], {
          cwd: workspace.workspaceRoot,
          stdout: "pipe",
          stderr: "pipe",
        });

        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          const stdout = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();
          console.error("tsc errors:", stdout || stderr);
        }

        expect(exitCode).toBe(0);
      },
      { timeout: 30_000 },
    );
  });
});
