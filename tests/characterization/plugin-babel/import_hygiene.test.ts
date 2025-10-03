import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createCanonicalId } from "@soda-gql/builder";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";
import { createTestSource, runBabelTransform } from "../../utils/transform";

describe("Import hygiene characterization tests", () => {
  const testFilePath = join(process.cwd(), "tests/characterization/plugin-babel/test-imports.ts");

  it("adds gqlRuntime import when transforming gql calls", async () => {
    const source = createTestSource(`
export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "model",
          id: canonicalId,
          prebuild: { typename: "User" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock import addition behavior
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    // Original gql import should be removed when no longer needed
    expect(transformed).not.toContain('from "@soda-gql/core"');
  });

  it("removes gql import when all gql calls are transformed", async () => {
    const source = `import { gql } from "@soda-gql/core";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  )
);
`;

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "model",
          id: canonicalId,
          prebuild: { typename: "User" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock import removal behavior
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).not.toContain('@soda-gql/core"');
    // Note: "gql" substring appears in "gqlRuntime", so this test needs refinement
    expect(transformed).toContain("gqlRuntime");
  });

  it("preserves gql import when other gql usages remain", async () => {
    const source = `import { gql, type GraphQLSchema } from "@soda-gql/core";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  )
);

// Non-transformed usage of gql
export const schema: GraphQLSchema = gql.schema;
`;

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "model",
          id: canonicalId,
          prebuild: { typename: "User" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock behavior: keep gql import if still referenced
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain('@soda-gql/core"');
    expect(transformed).toContain("gql.schema");
  });

  it("merges with existing @soda-gql/runtime import", async () => {
    const source = `import { gql } from "@soda-gql/core";
import { type graphql } from "@soda-gql/runtime";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  )
);

export type QueryResult = graphql.ExecutionResult;
`;

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "model",
          id: canonicalId,
          prebuild: { typename: "User" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock import merging behavior: should add gqlRuntime to existing import
    expect(transformed).toContain("@soda-gql/runtime");
    expect(transformed).toContain("gqlRuntime");
    expect(transformed).toContain("graphql");

    // Should not duplicate the runtime import
    const runtimeImports = transformed.match(/from "@soda-gql\/runtime"/g);
    expect(runtimeImports?.length).toBe(1);
  });

  it("handles multiple transformations without duplicating runtime import", async () => {
    const source = createTestSource(`
export const model1 = gql.default(({ model }) =>
  model({ typename: "User" }, ({ f }) => ({ ...f.id() }), (s) => ({ id: s.id }))
);

export const model2 = gql.default(({ model }) =>
  model({ typename: "Post" }, ({ f }) => ({ ...f.id() }), (s) => ({ id: s.id }))
);
`);

    const model1Id = createCanonicalId(testFilePath, "model1");
    const model2Id = createCanonicalId(testFilePath, "model2");
    const artifact = createBuilderArtifact([
      [
        model1Id,
        {
          type: "model",
          id: model1Id,
          prebuild: { typename: "User" },
        },
      ],
      [
        model2Id,
        {
          type: "model",
          id: model2Id,
          prebuild: { typename: "Post" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock: single runtime import for multiple transformations
    const runtimeImports = transformed.match(/import.*gqlRuntime.*from "@soda-gql\/runtime"/g);
    expect(runtimeImports?.length).toBe(1);

    expect(transformed).toContain("gqlRuntime.model(");
    expect(transformed).toContain('"User"');
    expect(transformed).toContain('"Post"');
  });

  it("removes default gql import when transformed", async () => {
    const source = `import gql from "@soda-gql/core";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  )
);
`;

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "model",
          id: canonicalId,
          prebuild: { typename: "User" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock: Currently default imports are NOT being automatically removed
    // This documents the current behavior which may be refined during refactoring
    expect(transformed).toContain('@soda-gql/core"');
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain("gqlRuntime.model(");
  });
});
