/**
 * E2E test for adapter metadata-callback typing on generated prebuilt operations.
 *
 * Validates that a configured adapter's `aggregateFragmentMetadata` return type and `schemaLevel`
 * value type FLOW into the operation metadata builder — i.e. `metadata: ({ fragmentMetadata,
 * schemaLevel }) => ...` sees the adapter's distinctive types, not the no-adapter defaults. This
 * covers the residual gap noted when retracting the F3 finding (#387): the adapter branch of the
 * generated options is typechecked for well-formedness, but no test exercised the callback-side
 * type flow under a real adapter aggregate.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runTypegen } from "../../../src/typegen/runner";
import { createTestWorkspace, type WorkspaceSetup } from "./utils/workspace";

const fixtureDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const projectRoot = resolve(fileURLToPath(import.meta.url), "../../../../../..");
const tscPath = join(projectRoot, "node_modules/.bin/tsc");

describe("adapter metadata-callback typing E2E", () => {
  let workspace: WorkspaceSetup;

  beforeEach(async () => {
    workspace = await createTestWorkspace({
      fixtureDir,
      sourceFiles: ["operation-with-name.ts"],
      adapterFixture: "adapter-metadata.ts",
    });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  test(
    "adapter aggregate + schemaLevel types flow into the operation metadata callback",
    async () => {
      const result = await runTypegen({ config: workspace.config });
      expect(result.isOk()).toBe(true);

      const typeCheckFile = join(workspace.workspaceRoot, "src", "adapter-metadata-usage.ts");
      const typeCheckContent = `
import { gql } from "../graphql-system";

// Positive (load-bearing): fragmentMetadata is typed as the adapter's aggregate return
// ({ aggregatedCount: number } | undefined) and schemaLevel as its schemaLevel value
// ({ apiVersion: "v2" } | undefined). These annotated assignments only compile if the adapter
// types actually flowed — the no-adapter default (readonly (OperationMetadata | undefined)[]) or a
// fallback to unknown would make .aggregatedCount / .apiVersion a type error.
export const adapterMetaFlow = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`({
    metadata: ({ fragmentMetadata, schemaLevel }) => {
      const count: number | undefined = fragmentMetadata?.aggregatedCount;
      const version: "v2" | undefined = schemaLevel?.apiVersion;
      return { custom: { count, version } };
    },
  }),
);

// Negative: fields absent from the adapter's types are rejected.
export const adapterMetaFlowInvalid = gql.default(({ query }) =>
  query("GetUser")\`($id: ID!) { user(id: $id) { id } }\`({
    metadata: ({ fragmentMetadata, schemaLevel }) => ({
      custom: {
        // @ts-expect-error - the adapter's aggregate type has no "nope" field
        badAggregate: fragmentMetadata?.nope,
        // @ts-expect-error - the adapter's schemaLevel type has no "nope" field
        badSchemaLevel: schemaLevel?.nope,
      },
    }),
  }),
);
`;

      const { writeFile } = await import("node:fs/promises");
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
});
