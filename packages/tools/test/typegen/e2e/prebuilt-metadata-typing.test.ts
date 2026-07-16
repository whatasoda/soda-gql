/**
 * E2E tests for metadata-builder typing on generated prebuilt operations.
 *
 * Validates that the trailing options call of a generated operation types its
 * `metadata` builder: `({ $, $var }) => ...` receives `$` keyed by the
 * operation's variables, `$var` selectors derive their proxy from the
 * variable's payload type, and static metadata objects still work.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runTypegen } from "../../../src/typegen/runner";
import { createTestWorkspace, type WorkspaceSetup } from "./utils/workspace";

const fixtureDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const projectRoot = resolve(fileURLToPath(import.meta.url), "../../../../../..");
const tscPath = join(projectRoot, "node_modules/.bin/tsc");

describe("prebuilt operation metadata typing E2E", () => {
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

  test("generated index types the trailing options call from per-operation varTypes", () => {
    const indexContent = readFileSync(join(workspace.workspaceRoot, "graphql-system", "index.ts"), "utf-8");

    expect(indexContent).toContain("type ResolveVarTypes_default<TName extends string>");
    expect(indexContent).toContain("type PrebuiltOperationOptions_default<TName extends string, TMetadata>");
    expect(indexContent).toContain("MetadataBuilder<VarRefsFromVarTypes<ResolveVarTypes_default<TName>>, TMetadata>");
    expect(indexContent).not.toContain("(...args: unknown[]) => ResolveOperationAtBuilder_default");
  });

  test(
    "typed metadata callbacks, static metadata, and no-options all compile; invalid access is rejected",
    async () => {
      const result = await runTypegen({ config: workspace.config });
      expect(result.isOk()).toBe(true);

      const typeCheckFile = join(workspace.workspaceRoot, "src", "metadata-usage.ts");
      const typeCheckContent = `
import { gql } from "../graphql-system";

// A metadata builder callback: $ is keyed by the operation's variables and
// $var selectors derive their proxy from the variable's payload type.
export const withCallback = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        idName: $var.getName($.id),
        idPath: $var.getPath($.id, (p) => p),
      },
    }),
  }),
);

// A static metadata object must keep working.
export const withStatic = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id } }\`({
    metadata: { custom: { kind: "static" } },
  }),
);

// No options must keep working.
export const withoutOptions = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id } }\`(),
);

export const invalidAccess = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        // @ts-expect-error - "missing" is not a declared variable on this operation
        missing: $var.getName($.missing),
        // @ts-expect-error - "nope" is not a field on the variable's payload type
        bad: $var.getValueAt($.id, (p) => p.nope),
      },
    }),
  }),
);
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

  test("metadata builder runs through the composer and produces the expected metadata", async () => {
    type VarRefLike = unknown;
    type BuilderTools = { $: Record<string, VarRefLike>; $var: { getName: (varRef: VarRefLike) => string } };
    type MetadataResult = { readonly metadata?: unknown };
    type TaggedTemplate = (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => (options: { metadata: (tools: BuilderTools) => unknown }) => MetadataResult;
    type Composer = (build: (ctx: { query: (name: string) => TaggedTemplate }) => MetadataResult) => MetadataResult;

    const mod = (await import(pathToFileURL(join(workspace.workspaceRoot, "graphql-system", "index.ts")).href)) as {
      gql: { default: Composer };
    };

    const operation = mod.gql.default(({ query }) =>
      query("GetUser")`($id: ID!) { user(id: $id) { id name } }`({
        metadata: ({ $, $var }) => ({
          custom: { idName: $var.getName($.id) },
        }),
      }),
    );

    expect(operation.metadata).toEqual({ custom: { idName: "id" } });
  });
});
