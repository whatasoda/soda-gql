import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createCanonicalId } from "@soda-gql/builder";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";
import { assertTransformRemovesGql, createTestSource, runBabelTransform } from "../../utils/transform";

describe("gql.querySlice characterization tests", () => {
  const testFilePath = join(process.cwd(), "tests/characterization/plugin-babel/test-slice.ts");

  it("transforms top-level exported slice definition", async () => {
    const source = createTestSource(`
export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    { variables: { ...$("id").scalar("ID:!") } },
    ({ f, $ }) => ({ ...f.user({ id: $.id }, ({ f }) => ({ ...f.id(), ...f.name() })) }),
    ({ select }) => select(["$.user"], (result) => result.map((user) => user))
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "userSlice");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "slice",
          id: canonicalId,
          prebuild: { operationType: "query" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock current behavior
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain("gqlRuntime.slice(");
    expect(transformed).toContain('operationType: "query"');
    expect(transformed).toContain("buildProjection:");
    // Verify projection builder (third argument) is cloned
    expect(transformed).toContain('({ select }) => select(["$.user"]');
  });

  it("transforms slice with mutation operation type", async () => {
    const source = createTestSource(`
export const updateUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    { variables: { ...$("id").scalar("ID:!"), ...$("name").scalar("String:!") } },
    ({ f, $ }) => ({ ...f.updateUser({ id: $.id, name: $.name }, ({ f }) => ({ ...f.id() })) }),
    ({ select }) => select(["$.updateUser"], (result) => result)
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "updateUserSlice");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "slice",
          id: canonicalId,
          prebuild: { operationType: "mutation" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock mutation operation type handling
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("gqlRuntime.slice(");
    expect(transformed).toContain('operationType: "mutation"');
  });

  it("transforms nested slice definition", async () => {
    const source = createTestSource(`
export const slices = {
  byId: gql.default(({ slice }, { $ }) =>
    slice.query(
      { variables: { ...$("id").scalar("ID:!") } },
      ({ f, $ }) => ({ ...f.user({ id: $.id }, ({ f }) => ({ ...f.id() })) }),
      ({ select }) => select(["$.user"], (result) => result)
    )
  ),
};
`);

    const canonicalId = createCanonicalId(testFilePath, "slices.byId");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "slice",
          id: canonicalId,
          prebuild: { operationType: "query" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock nested slice canonical ID resolution
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("gqlRuntime.slice(");
    expect(transformed).toContain('operationType: "query"');
  });

  it("throws error when projection builder is missing", async () => {
    const source = createTestSource(`
export const brokenSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    { variables: { ...$("id").scalar("ID:!") } },
    ({ f, $ }) => ({ ...f.user({ id: $.id }, ({ f }) => ({ ...f.id() })) })
    // Missing projection builder
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "brokenSlice");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "slice",
          id: canonicalId,
          prebuild: { operationType: "query" },
        },
      ],
    ]);

    // Lock error message format
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "slice requires a projection builder",
    );
  });

  it("handles slice in non-exported object property", async () => {
    const source = createTestSource(`
const sliceCollection = {
  userSlice: gql.default(({ slice }) =>
    slice.query(
      {},
      ({ f }) => ({ ...f.users(({ f }) => ({ ...f.id() })) }),
      ({ select }) => select(["$.users"], (result) => result)
    )
  ),
};

export default sliceCollection;
`);

    const canonicalId = createCanonicalId(testFilePath, "sliceCollection.userSlice");
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          type: "slice",
          id: canonicalId,
          prebuild: { operationType: "query" },
        },
      ],
    ]);

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock nested object property canonical ID resolution
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("gqlRuntime.slice(");
  });
});
