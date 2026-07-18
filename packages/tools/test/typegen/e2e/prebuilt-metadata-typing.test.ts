/**
 * E2E tests for metadata-builder typing on generated prebuilt operations and fragments.
 *
 * Validates that the trailing options call of a generated operation/fragment types its
 * `metadata` builder: `({ $, $var }) => ...` receives `$` keyed by the element's
 * variables, selector proxies navigate object payloads while scalars are terminal,
 * `getValue`/`getValueAt` reject compose-time operation variable refs while fragment
 * refs allow them, and static metadata still works.
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
      sourceFiles: [
        "operation-with-name.ts",
        "fragment-with-variable.ts",
        "shared-var-types.ts",
        "operation-with-object-var.ts",
        "operation-with-branded-scalar.ts",
      ],
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

// Object-payload variable: getPath navigates the input object's fields, including
// through a nullable input-object field (GraphQL's default nullability).
export const objectVarNav = gql.default(({ query }) =>
  query("SearchUsers")\`($filter: UserFilter!) { searchUsers(filter: $filter) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        filterNamePath: $var.getPath($.filter, (p) => p.name),
        filterCityPath: $var.getPath($.filter, (p) => p.address.city),
      },
    }),
  }),
);

// Fragment metadata callback: $ is keyed by the fragment's variables; getName/getPath
// work but getValue/getValueAt are rejected (a spread may pass an operation variable ref).
export const fragmentWithCallback = gql.default(({ fragment }) =>
  fragment("UserByIdFields", "Query")\`($id: ID!) { user(id: $id) { id name } }\`({
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

export const invalidOperationAccess = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        // @ts-expect-error - "missing" is not a declared variable on this operation
        missing: $var.getName($.missing),
        // @ts-expect-error - getValueAt rejects compose-time operation variable refs (no runtime const value)
        noConstValue: $var.getValueAt($.id, (p) => p),
        // @ts-expect-error - a scalar payload is a terminal leaf, so navigating it is rejected
        scalarTerminal: $var.getPath($.id, (p) => p.length),
      },
    }),
  }),
);

// A branded custom-scalar variable ($uuid: UUID! -> \`string & { __brand: "UUID" }\`) must be
// terminal through the full pipeline: varTypes emits \`$uuid: ScalarInput_default<"UUID">\`, and the
// selector proxy keeps branded primitives terminal — a regression of #383 would let \`.length\`
// compile and fabricate a runtime path. Identity access on the ref stays valid.
export const brandedScalarTerminal = gql.default(({ query }) =>
  query("GetByUuid")\`($uuid: UUID!) { userByUuid(uuid: $uuid) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        uuidName: $var.getName($.uuid),
        uuidIdentity: $var.getPath($.uuid, (p) => p),
        // @ts-expect-error - "notAVar" is undeclared: proves \`$\` is keyed from the scanned
        // GetByUuid op, not the permissive stale-types fallback (which would accept any name and
        // make the terminal-leaf assertion below pass vacuously on a never payload)
        notDeclared: $var.getName($.notAVar),
        // @ts-expect-error - a branded string scalar payload is a terminal leaf (no \`.length\`)
        uuidBogus: $var.getPath($.uuid, (p) => p.length),
      },
    }),
  }),
);

export const invalidObjectVarAccess = gql.default(({ query }) =>
  query("SearchUsers")\`($filter: UserFilter!) { searchUsers(filter: $filter) { id } }\`({
    metadata: ({ $, $var }) => ({
      custom: {
        // @ts-expect-error - "nope" is not a field on the variable's object payload
        badField: $var.getPath($.filter, (p) => p.nope),
        // @ts-expect-error - getNameAt navigation throws on a compose-time variable ref (identity only)
        nameAtNav: $var.getNameAt($.filter, (p) => p.name),
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
        // @ts-expect-error - getValueAt is rejected on a fragment ref (a spread may pass through an operation variable)
        noConstValue: $var.getValueAt($.id, (p) => p),
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
    // Balanced-brace extraction: a simple \\{[^}]*\\} regex truncates at the first inner
    // brace, so a nested/input-object payload would false-pass on a prefix match.
    const extractVarTypes = (key: string): string => {
      const line = prebuilt.split("\n").find((l) => l.includes(`readonly "${key}":`));
      if (!line) throw new Error(`entry for ${key} not found`);
      const marker = "readonly varTypes: ";
      const start = line.indexOf(marker);
      if (start === -1 || line[start + marker.length] !== "{") throw new Error(`varTypes for ${key} not found`);
      const from = start + marker.length;
      let depth = 0;
      for (let i = from; i < line.length; i++) {
        if (line[i] === "{") depth++;
        else if (line[i] === "}" && --depth === 0) return line.slice(from, i + 1);
      }
      throw new Error(`unbalanced varTypes for ${key}`);
    };

    // The operation (TypeNode-based) and fragment (specifier-based) varTypes generators
    // must produce identical payload maps for the same GraphQL variable declarations,
    // including the input-object variable ($filter) that exercises brace nesting.
    const operationVarTypes = extractVarTypes("SharedVarsOperation");
    expect(extractVarTypes("SharedVarsFragment")).toBe(operationVarTypes);

    // Guard against a vacuous pass where both generators drop the same variable: assert the
    // divergence-prone shapes are actually present. `$matrix: [[Int!]!]!` must produce a
    // nested (doubly-bracketed) array payload, and `$roles: [Role!]` an enum-union list.
    expect(operationVarTypes).toContain("readonly matrix:");
    expect(operationVarTypes).toMatch(/matrix:[^;]*\)\[\]\)\[\]/); // two list levels
    expect(operationVarTypes).toContain("readonly roles:");
    expect(operationVarTypes).toMatch(/roles:[^;]*"ADMIN"[^;]*"MEMBER"/); // enum members
  });
});
