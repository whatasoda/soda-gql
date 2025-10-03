import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Kind } from "graphql";
import { createCanonicalId } from "../../../packages/builder/src/index.ts";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";
import { assertTransformRemovesGql, createTestSource, runBabelTransform } from "../../utils/transform";

describe("gql.query characterization tests", () => {
  const testFilePath = join(process.cwd(), "tests/characterization/plugin-babel/test-query.ts");

  it("transforms query with getOperation reference and operation registration", async () => {
    const source = createTestSource(`
export const profileQuery = gql.default(({ query }, { $ }) =>
  query(
    "ProfileQuery",
    { variables: { ...$("userId").scalar("ID:!") } },
    ({ $, getSlice }) => ({
      ...getSlice(userSlice, { id: $.userId }),
    })
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "profileQuery");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "operation",
          id: canonicalId,
          prebuild: {
            operationType: "query",
            operationName: "ProfileQuery",
            document: { kind: Kind.DOCUMENT, definitions: [] },
            variableNames: ["userId"],
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock current behavior: two-part transformation
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');

    // 1. Reference call: gqlRuntime.getOperation("ProfileQuery")
    expect(transformed).toContain('export const profileQuery = gqlRuntime.getOperation("ProfileQuery")');

    // 2. Operation registration: gqlRuntime.operation({ prebuild: JSON.parse(...), runtime: { getSlices } })
    expect(transformed).toContain("gqlRuntime.operation(");
    expect(transformed).toContain("prebuild: JSON.parse(");
    expect(transformed).toContain('"operationName":"ProfileQuery"');
    expect(transformed).toContain('"operationType":"query"');
    expect(transformed).toContain('"variableNames":["userId"]');
    expect(transformed).toContain("getSlices:");
  });

  it("transforms mutation operation", async () => {
    const source = createTestSource(`
export const updateProfileMutation = gql.default(({ query }, { $ }) =>
  query(
    "UpdateProfile",
    { variables: { ...$("userId").scalar("ID:!"), ...$("name").scalar("String:!") } },
    ({ $, getSlice }) => ({
      ...getSlice(updateUserSlice, { id: $.userId, name: $.name }),
    })
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "updateProfileMutation");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "operation",
          id: canonicalId,
          prebuild: {
            operationType: "mutation",
            operationName: "UpdateProfile",
            document: { kind: Kind.DOCUMENT, definitions: [] },
            variableNames: ["userId", "name"],
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock mutation operation handling
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain('gqlRuntime.getOperation("UpdateProfile")');
    expect(transformed).toContain('"operationType":"mutation"');
    expect(transformed).toContain('"variableNames":["userId","name"]');
  });

  it("transforms multiple queries in same file", async () => {
    const source = createTestSource(`
export const query1 = gql.default(({ query }) =>
  query("Query1", {}, ({ getSlice }) => ({}))
);

export const query2 = gql.default(({ query }) =>
  query("Query2", {}, ({ getSlice }) => ({}))
);
`);

    const query1Id = createCanonicalId(testFilePath, "query1");
    const query2Id = createCanonicalId(testFilePath, "query2");
    const artifact = createBuilderArtifact([
      [
        query1Id,
        {
          type: "operation",
          id: query1Id,
          prebuild: {
            operationType: "query",
            operationName: "Query1",
            document: { kind: Kind.DOCUMENT, definitions: [] },
            variableNames: [],
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      ],
      [
        query2Id,
        {
          type: "operation",
          id: query2Id,
          prebuild: {
            operationType: "query",
            operationName: "Query2",
            document: { kind: Kind.DOCUMENT, definitions: [] },
            variableNames: [],
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock behavior for multiple operations
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain('gqlRuntime.getOperation("Query1")');
    expect(transformed).toContain('gqlRuntime.getOperation("Query2")');

    // Each should have its own runtime registration
    const operationCalls = transformed.match(/gqlRuntime\.operation\(/g);
    expect(operationCalls).not.toBeNull();
    expect(operationCalls?.length).toBe(2);
  });

  it("handles query with 2 args (second arg becomes slices builder)", async () => {
    const source = createTestSource(`
export const queryWith2Args = gql.default(({ query }) =>
  query("Query2Args", {})
);
`);

    const canonicalId = createCanonicalId(testFilePath, "queryWith2Args");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "operation",
          id: canonicalId,
          prebuild: {
            operationType: "query",
            operationName: "Query2Args",
            document: { kind: Kind.DOCUMENT, definitions: [] },
            variableNames: [],
            projectionPathGraph: { matches: [], children: {} },
          },
        },
      ],
    ]);

    // Lock current behavior: second argument treated as slices builder
    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });
    expect(transformed).toContain("gqlRuntime.operation(");
    expect(transformed).toContain('gqlRuntime.getOperation("Query2Args")');
  });

  it("includes projection path graph in serialized prebuild", async () => {
    const source = createTestSource(`
export const complexQuery = gql.default(({ query }, { $ }) =>
  query(
    "ComplexQuery",
    {},
    ({ getSlice }) => ({
      ...getSlice(nestedSlice, {}),
    })
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "complexQuery");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "operation",
          id: canonicalId,
          prebuild: {
            operationType: "query",
            operationName: "ComplexQuery",
            document: { kind: Kind.DOCUMENT, definitions: [] },
            variableNames: [],
            projectionPathGraph: {
              matches: [],
              children: {},
            },
          },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Verify projection graph is serialized in JSON.parse
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("projectionPathGraph");
  });
});
