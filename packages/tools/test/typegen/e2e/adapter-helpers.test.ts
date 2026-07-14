/**
 * E2E tests for adapter helper typing on the generated context.
 *
 * Validates that helpers declared via `defineAdapter({ helpers })` are
 * typed on `PrebuiltContext_*` — call sites can use `ctx.<helper>`
 * without a type assertion.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runTypegen } from "../../../src/typegen/runner";
import { createTestWorkspace, type WorkspaceSetup } from "./utils/workspace";

const fixtureDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const projectRoot = resolve(fileURLToPath(import.meta.url), "../../../../../..");
const tscPath = join(projectRoot, "node_modules/.bin/tsc");

describe("adapter helpers on PrebuiltContext E2E", () => {
  let workspace: WorkspaceSetup;

  beforeEach(async () => {
    workspace = await createTestWorkspace({
      fixtureDir,
      sourceFiles: ["operation-with-name.ts"],
      adapterFixture: "adapter.ts",
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  test("generated index intersects PrebuiltContext with adapter helpers", () => {
    const indexContent = readFileSync(join(workspace.workspaceRoot, "graphql-system", "index.ts"), "utf-8");

    expect(indexContent).toContain("type AdapterHelpers_default = Omit<Context_default,");
    expect(indexContent).toContain("export type PrebuiltContext_default = AdapterHelpers_default & {");
    expect(indexContent).toContain('import type { Context_default } from "./_internal"');
  });

  test(
    "helper access on ctx compiles without a type assertion",
    async () => {
      const result = await runTypegen({ config: workspace.config });
      expect(result.isOk()).toBe(true);

      const typeCheckFile = join(workspace.workspaceRoot, "src", "helper-usage.ts");
      const typeCheckContent = `
import { gql } from "../graphql-system";

// Helpers declared via defineAdapter({ helpers: { auth } }) must be typed on ctx
export const getUser = gql.default(({ query, auth }) => {
  const spec: { permission: string } = auth.spec({ permission: "view_user" });
  const login: { requiresAuth: true } = auth.requiresLogin();
  void spec;
  void login;
  return query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`();
});
`;

      const fs = await import("node:fs/promises");
      await fs.writeFile(typeCheckFile, typeCheckContent, "utf-8");

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
    { timeout: 120_000 },
  );
});
