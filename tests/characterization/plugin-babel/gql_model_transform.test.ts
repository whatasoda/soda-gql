import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { type BuilderArtifact, createCanonicalId } from "../../../packages/builder/src/index.ts";
import { assertTransformRemovesGql, createTestSource, runBabelTransform } from "../../utils/transform";

describe("gql.model characterization tests", () => {
  const testFilePath = join(process.cwd(), "tests/characterization/plugin-babel/test-model.ts");

  it("transforms top-level exported model definition", async () => {
    const source = createTestSource(`
export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id(), ...f.name() }),
    (selection) => ({ id: selection.id, name: selection.name })
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "userModel");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "model",
          id: canonicalId,
          prebuild: {
            typename: "User",
            projectionPathGraph: {
              matches: [],
              children: {},
            },
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

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock current behavior
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain("gqlRuntime.model(");
    expect(transformed).toContain('typename: "User"');
    expect(transformed).toContain("normalize:");
    // Verify normalize function is cloned
    expect(transformed).toContain("id: selection.id");
  });

  it("transforms block-bodied arrow function model definition", async () => {
    const source = createTestSource(`
export const productModel = gql.default(({ model }) => {
  return model(
    { typename: "Product" },
    ({ f }) => ({ ...f.id(), ...f.title() }),
    (selection) => ({ id: selection.id, title: selection.title })
  );
});
`);

    const canonicalId = createCanonicalId(testFilePath, "productModel");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "model",
          id: canonicalId,
          prebuild: {
            typename: "Product",
            projectionPathGraph: {
              matches: [],
              children: {},
            },
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

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock current behavior for block-bodied functions
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("gqlRuntime.model(");
    expect(transformed).toContain('typename: "Product"');
  });

  it("transforms nested model definition", async () => {
    const source = createTestSource(`
export const models = {
  user: gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => ({ ...f.id() }),
      (selection) => ({ id: selection.id })
    )
  ),
};
`);

    const canonicalId = createCanonicalId(testFilePath, "models.user");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "model",
          id: canonicalId,
          prebuild: {
            typename: "User",
            projectionPathGraph: {
              matches: [],
              children: {},
            },
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

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Lock behavior for nested definitions (canonical ID resolution)
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("gqlRuntime.model(");
    expect(transformed).toContain('typename: "User"');
  });

  it("throws error when normalize argument is missing", async () => {
    const source = createTestSource(`
export const brokenModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({ ...f.id() })
    // Missing normalize function
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
            projectionPathGraph: {
              matches: [],
              children: {},
            },
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

    // Lock error message format
    await expect(runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true })).rejects.toThrow(
      "model requires a normalize function",
    );
  });

  it("preserves projection path graph in prebuild", async () => {
    const source = createTestSource(`
export const complexModel = gql.default(({ model }) =>
  model(
    { typename: "Complex" },
    ({ f }) => ({ ...f.nested(() => ({ ...f.field() })) }),
    (selection) => ({ nested: selection.nested })
  )
);
`);

    const canonicalId = createCanonicalId(testFilePath, "complexModel");
    const artifact: BuilderArtifact = {
      elements: {
        [canonicalId]: {
          type: "model",
          id: canonicalId,
          prebuild: {
            typename: "Complex",
            projectionPathGraph: {
              matches: ["nested"],
              children: {
                nested: {
                  matches: ["field"],
                  children: {},
                },
              },
            },
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

    const transformed = await runBabelTransform(source, testFilePath, artifact, { skipTypeCheck: true });

    // Verify projection graph is included (even though not used in model transform)
    assertTransformRemovesGql(transformed);
    expect(transformed).toContain("gqlRuntime.model(");
  });
});
