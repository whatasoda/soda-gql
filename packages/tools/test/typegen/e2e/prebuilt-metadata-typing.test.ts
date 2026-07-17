/**
 * E2E tests for metadata-builder typing on generated prebuilt operations and fragments.
 *
 * Validates that the trailing options call of a generated operation/fragment types its
 * `metadata` builder: `({ $, $var }) => ...` receives `$` keyed by the element's
 * variables, `getValue`/`getValueAt` reject compose-time operation variable refs while
 * fragment refs allow them, and static metadata still works.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AnyVarRef, MetadataBuilderTools, VarRefTools } from "@soda-gql/core";
import { runTypegen } from "../../../src/typegen/runner";
import { createTestWorkspace, type WorkspaceSetup } from "./utils/workspace";

const fixtureDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const projectRoot = resolve(fileURLToPath(import.meta.url), "../../../../../..");
const tscPath = join(projectRoot, "node_modules/.bin/tsc");

describe("prebuilt operation/fragment metadata typing E2E", () => {
  let workspace: WorkspaceSetup;

  beforeEach(async () => {
    workspace = await createTestWorkspace({
      fixtureDir,
      sourceFiles: ["operation-with-name.ts", "fragment-with-variable.ts", "shared-var-types.ts"],
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  test("generated index types the trailing options call from per-element varTypes", () => {
    const indexContent = readFileSync(join(workspace.workspaceRoot, "graphql-system", "index.ts"), "utf-8");

    expect(indexContent).toContain("type ResolveVarTypes_default<TName extends string>");
    expect(indexContent).toContain("type ResolveFragmentVarTypes_default<TKey extends string>");
    expect(indexContent).toContain("PrebuiltOperationOptions<ResolveVarTypes_default<TName>, TMetadata");
    expect(indexContent).toContain("PrebuiltFragmentOptions<ResolveFragmentVarTypes_default<TKey>, TMetadata>");
    expect(indexContent).not.toContain("(...args: unknown[]) => ResolveOperationAtBuilder_default");
    expect(indexContent).not.toContain("(...args: unknown[]) => ResolveFragmentAtBuilder_default");
    // varTypes is read defensively so a stale types.prebuilt.ts degrades instead of erroring
    expect(indexContent).toContain("extends { varTypes: infer V } ? V : Record<string, never>");
  });

  test(
    "typed callbacks, static metadata, and no-options compile; invalid access is rejected",
    async () => {
      const result = await runTypegen({ config: workspace.config });
      expect(result.isOk()).toBe(true);

      const typeCheckFile = join(workspace.workspaceRoot, "src", "metadata-usage.ts");
      const typeCheckContent = `
import { gql } from "../graphql-system";

// Operation metadata callback: $ is keyed by the operation's variables; getName reads
// the variable name and getPath accepts an identity selector.
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

// Fragment metadata callback: $ is keyed by the fragment's variables. Unlike operation
// refs, fragment refs are value-bearing at spread time, so getValueAt is allowed here.
export const fragmentWithCallback = gql.default(({ fragment }) =>
  fragment("UserByIdFields", "Query")\`($id: ID!) { user(id: $id) { id name } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        idName: $var.getName($.id),
        idValue: $var.getValueAt($.id, (p) => p),
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

export const invalidOperationAccess = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        // @ts-expect-error - "missing" is not a declared variable on this operation
        missing: $var.getName($.missing),
        // @ts-expect-error - getValueAt rejects compose-time operation variable refs (no runtime const value)
        noConstValue: $var.getValueAt($.id, (p) => p),
        // @ts-expect-error - the selector proxy defaults to unknown, so navigating it is rejected
        badField: $var.getNameAt($.id, (p) => p.nope),
      },
    }),
  }),
);

export const invalidFragmentAccess = gql.default(({ fragment }) =>
  fragment("UserByIdFields", "Query")\`($id: ID!) { user(id: $id) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        // @ts-expect-error - "missing" is not a declared variable on this fragment
        missing: $var.getName($.missing),
      },
    }),
  }),
);
`;

      await writeFile(typeCheckFile, typeCheckContent, "utf-8");

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
    type ElementResult = { readonly metadata?: unknown };
    type TaggedTemplate = (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => (options: { metadata: (tools: MetadataBuilderTools<{ id: AnyVarRef }>) => unknown }) => ElementResult;
    type Composer = (build: (ctx: { query: (name: string) => TaggedTemplate }) => ElementResult) => ElementResult;

    const mod = (await import(pathToFileURL(join(workspace.workspaceRoot, "graphql-system", "index.ts")).href)) as {
      gql: { default: Composer };
    };

    const operation = mod.gql.default(({ query }) =>
      query("GetUser")`($id: ID!) { user(id: $id) { id name } }`({
        metadata: ({ $, $var }) => {
          const tools: VarRefTools = $var;
          return { custom: { idName: tools.getName($.id) } };
        },
      }),
    );

    expect(operation.metadata).toEqual({ custom: { idName: "id" } });
  });

  test("operation and fragment varTypes stay in sync for identical variable declarations", async () => {
    const result = await runTypegen({ config: workspace.config });
    expect(result.isOk()).toBe(true);

    const prebuilt = readFileSync(join(workspace.workspaceRoot, "graphql-system", "types.prebuilt.ts"), "utf-8");
    const extractVarTypes = (key: string): string => {
      const line = prebuilt.split("\n").find((l) => l.includes(`readonly "${key}":`));
      if (!line) throw new Error(`entry for ${key} not found`);
      const varTypes = line.match(/readonly varTypes: (\{[^}]*\})/)?.[1];
      if (!varTypes) throw new Error(`varTypes for ${key} not found`);
      return varTypes;
    };

    // The operation (TypeNode-based) and fragment (specifier-based) varTypes generators
    // must produce identical payload maps for the same GraphQL variable declarations.
    expect(extractVarTypes("SharedVarsFragment")).toBe(extractVarTypes("SharedVarsOperation"));
  });
});
