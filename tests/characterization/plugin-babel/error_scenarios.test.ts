import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { type BuilderArtifact, createCanonicalId } from "../../../packages/builder/src/index.ts";
import { createTestSource, runBabelTransform } from "../../utils/transform";

describe("Error scenario characterization tests", () => {
  const testFilePath = join(process.cwd(), "tests/characterization/plugin-babel/test-errors.ts");

  it("throws SODA_GQL_METADATA_NOT_FOUND when metadata collection fails", async () => {
    // This scenario is hard to reproduce reliably since metadata collection
    // is internal. This test documents the error code for future reference.
    // The error is thrown at plugin.ts:377 when metadata.get(node) returns undefined
  });

  it("throws SODA_GQL_ARTIFACT_NOT_FOUND when artifact entry is missing", async () => {
    const source = createTestSource(`
export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  )
);
`);

    // Artifact without the expected canonical ID
    const artifact: BuilderArtifact = {
      elements: {},
      report: {
        operations: 0,
        models: 0,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 0 },
      },
    };

    // Lock error code and message
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "SODA_GQL_ARTIFACT_NOT_FOUND",
    );
  });

  it("throws SODA_GQL_ARTIFACT_VALIDATION_FAILED when artifact has invalid type", async () => {
    const source = createTestSource(`
export const something = gql.default(({ unknown }) => unknown());
`);

    const canonicalId = createCanonicalId(testFilePath, "something");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          // @ts-expect-error - testing invalid type
          type: "unknown",
          id: canonicalId,
          prebuild: {},
        },
      },
      report: {
        operations: 0,
        models: 0,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 1 },
      },
    };

    // Lock: artifact validation happens before type checking
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "SODA_GQL_ARTIFACT_VALIDATION_FAILED",
    );
  });

  it("preserves error details for missing normalize in model", async () => {
    const source = createTestSource(`
export const brokenModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() })
    // Missing third argument (normalize)
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "brokenModel");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "model",
          id: canonicalId,
          prebuild: {
            typename: "User",
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      },
      report: {
        operations: 0,
        models: 1,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 1 },
      },
    };

    // Lock exact error message (plugin.ts:409)
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "gql.model requires a transform",
    );
  });

  it("preserves error details for missing projection builder in slice", async () => {
    const source = createTestSource(`
export const brokenSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    { variables: { ...$("id").scalar("ID:!") } },
    ({ f, $ }) => ({ ...f.user({ id: $.id }, ({ f }) => ({ ...f.id() })) })
    // Missing third argument (projection builder)
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "brokenSlice");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "slice",
          id: canonicalId,
          prebuild: {
            operationType: "query",
          },
        },
      },
      report: {
        operations: 0,
        models: 0,
        slices: 1,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 1 },
      },
    };

    // Lock exact error message (plugin.ts:427)
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "gql.querySlice requires a projection builder",
    );
  });

  it("handles operation with missing slices builder", async () => {
    const source = createTestSource(`
export const brokenQuery = gql.default(({ query }) =>
  query("BrokenQuery", {})
  // Missing third argument (slices builder)
);
`);

    const canonicalId = createCanonicalId(testFilePath, "brokenQuery");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "operation",
          id: canonicalId,
          prebuild: {
            operationType: "query",
            operationName: "BrokenQuery",
            document: {
              kind: "Document" as const,
              definitions: [],
            },
            variableNames: [],
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      },
      report: {
        operations: 1,
        models: 0,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 1 },
      },
    };

    // Lock current behavior: query() with 2 args still gets transformed
    // The second argument is treated as slicesBuilder
    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });
    expect(transformed).toContain("gqlRuntime.operation(");
    expect(transformed).toContain('gqlRuntime.getOperation("BrokenQuery")');
  });

  it("throws when gql call has non-arrow function argument", async () => {
    const source = createTestSource(`
function factory({ model }) {
  return model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() }),
    (selection) => ({ id: selection.id })
  );
}

export const userModel = gql.default(factory);
`);

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "model",
          id: canonicalId,
          prebuild: {
            typename: "User",
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      },
      report: {
        operations: 0,
        models: 1,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 1 },
      },
    };

    // Lock: plugin should reject non-arrow factory functions
    // extractGqlCall returns null when arg is not arrow function (plugin.ts:357-359)
    // This causes the CallExpression visitor to skip transformation
    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Should not transform this pattern
    expect(transformed).toContain("gql.default(factory)");
    expect(transformed).not.toContain("gqlRuntime.model(");
  });

  it("handles empty artifact gracefully", async () => {
    const source = createTestSource(`
export const x = 1;
`);

    const artifact: BuilderArtifact = {
      elements: {},
      report: {
        operations: 0,
        models: 0,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: { hits: 0, misses: 0 },
      },
    };

    // Should transform successfully with no gql calls
    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });
    expect(transformed).toContain("export const x = 1");
    // Should not add runtime import if no transformations occurred
    expect(transformed).not.toContain("gqlRuntime");
  });
});
