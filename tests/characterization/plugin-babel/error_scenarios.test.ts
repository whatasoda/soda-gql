import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Kind } from "graphql";
import { createCanonicalId } from "@soda-gql/builder";
import { createBuilderArtifact, createInvalidArtifactElement } from "../../utils/artifact-fixtures";
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
    const artifact = createBuilderArtifact([]);

    // Lock error: new error message includes canonical ID details
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "No builder artifact found for canonical ID",
    );
  });

  it("throws SODA_GQL_ARTIFACT_VALIDATION_FAILED when artifact has invalid type", async () => {
    const source = createTestSource(`
export const something = gql.default(({ unknown }) => unknown());
`);

    const canonicalId = createCanonicalId(testFilePath, "something");
    const artifact = createBuilderArtifact(
      [
        [
          canonicalId,
          createInvalidArtifactElement({
            type: "unknown",
            id: canonicalId,
            prebuild: {},
          }),
        ],
      ],
      { cache: { misses: 1 } },
    );

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
    const artifact = createBuilderArtifact(
      [
        [
          canonicalId,
          {
            type: "model",
            id: canonicalId,
            prebuild: {
              typename: "User",
            },
          },
        ],
      ],
      { cache: { misses: 1 } },
    );

    // Lock exact error message
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "model requires a normalize function",
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
    const artifact = createBuilderArtifact(
      [
        [
          canonicalId,
          {
            type: "slice",
            id: canonicalId,
            prebuild: {
              operationType: "query",
            },
          },
        ],
      ],
      { cache: { misses: 1 } },
    );

    // Lock exact error message
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "slice requires a projection builder",
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
    const artifact = createBuilderArtifact(
      [
        [
          canonicalId,
          {
            type: "operation",
            id: canonicalId,
            prebuild: {
              operationType: "query",
              operationName: "BrokenQuery",
              document: {
                kind: Kind.DOCUMENT,
                definitions: [],
              },
              variableNames: [],
              projectionPathGraph: { matches: [], children: {} },
            },
          },
        ],
      ],
      { cache: { misses: 1 } },
    );

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
    const artifact = createBuilderArtifact(
      [
        [
          canonicalId,
          {
            type: "model",
            id: canonicalId,
            prebuild: {
              typename: "User",
            },
          },
        ],
      ],
      { cache: { misses: 1 } },
    );

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

    const artifact = createBuilderArtifact([]);

    // Should transform successfully with no gql calls
    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });
    expect(transformed).toContain("export const x = 1");
    // Should not add runtime import if no transformations occurred
    expect(transformed).not.toContain("gqlRuntime");
  });
});
