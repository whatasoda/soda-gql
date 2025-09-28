import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { type BuilderArtifact, createCanonicalId } from "../../../packages/builder/src/index.ts";
import { assertTransformContainsRuntimeCall, assertTransformRemovesGql, runBabelTransform } from "../../utils/transform";

describe("@soda-gql/plugin-babel zero-runtime transforms", () => {
  it("replaces gql helpers with runtime bindings", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/pages/profile.query.ts");
    const queryId = createCanonicalId(sourcePath, "profileQuery", "default");

    const userSliceId = createCanonicalId(join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts"), "userSlice");
    const userSliceCatalogId = createCanonicalId(
      join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts"),
      "userSliceCatalog.byId",
    );
    const userCatalogCollectionId = createCanonicalId(
      join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.catalog.ts"),
      "collections.byCategory",
    );

    const artifact: BuilderArtifact = {
      operations: {
        [queryId]: {
          id: queryId,
          prebuild: {
            name: "ProfilePageQuery",
            document: {
              kind: "Document",
              definitions: [],
            },
            variableNames: [],
            projectionPathGraph: {
              matches: [],
              children: {},
            },
          },
          dependencies: [userSliceId, userSliceCatalogId, userCatalogCollectionId],
        },
      },
      slices: {
        [userSliceId]: {
          id: userSliceId,
          prebuild: null,
          dependencies: [],
        },
        [userSliceCatalogId]: {
          id: userSliceCatalogId,
          prebuild: null,
          dependencies: [],
        },
        [userCatalogCollectionId]: {
          id: userCatalogCollectionId,
          prebuild: null,
          dependencies: [],
        },
      },
      models: {},
      report: {
        operations: 1,
        models: 0,
        slices: 3,
        durationMs: 0,
        warnings: [],
        cache: {
          hits: 0,
          misses: 1,
        },
      },
    };

    const source = await Bun.file(sourcePath).text();

    const transformed = await runBabelTransform(source, sourcePath, artifact, {
      importIdentifier: "@/graphql-runtime",
      skipTypeCheck: true, // Skip type check as this file imports untransformed dependencies
    });
    assertTransformRemovesGql(transformed);
    // Note: The plugin overrides the importIdentifier in some cases
    expect(transformed).toContain("import { gqlRuntime, type graphql } from ");
    // In the new implementation, the operation is directly called with gqlRuntime.query
    expect(transformed).toContain("gqlRuntime.query({");
    expect(transformed).toContain("prebuild:");
    expect(transformed).toContain('name: "ProfilePageQuery"');
    expect(transformed).toContain("document:");
    expect(transformed).toContain("variableNames:");
    expect(transformed).toContain("projectionPathGraph:");
    expect(transformed).toContain("runtime:");
    expect(transformed).toContain("getSlices:");
    // The export should use gqlRuntime.getOperation
    expect(transformed).toContain('export const profileQuery = gqlRuntime.getOperation("ProfilePageQuery")');
    expect(transformed).toContain("users:");
    expect(transformed).toContain("remoteUsers:");
  });

  it.skip("transforms intermediate-module placeholders", async () => {
    const artifact: BuilderArtifact = {
      operations: {},
      slices: {},
      models: {},
      report: {
        operations: 0,
        models: 0,
        slices: 0,
        durationMs: 0,
        warnings: [],
        cache: {
          hits: 0,
          misses: 0,
        },
      },
    };

    const entityPath = join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts").replace(/\\/g, "/");
    const canonicalModel = `${entityPath}::userModel`;
    const canonicalSlice = `${entityPath}::userSlice`;

    const source = `import { gql } from "@/graphql-system";

export const models = {
  "${canonicalModel}": (() =>
    gql.model(
      ["User", { categoryId: gql.scalar(["ID", ""]) }],
      ({ f, $ }) => ({
        ...f.id(),
        ...f.name(),
        ...f.posts({ categoryId: $.categoryId }, ({ f }) => ({
          ...f.id(),
          ...f.title(),
        })),
      }),
      () => {
        /* runtime function */
        return {};
      },
    ))(),
} as const;

export const slices = {
  "${canonicalSlice}": (() =>
    gql.querySlice(
      [
        {
          id: gql.scalar(["ID", "!"]),
          categoryId: gql.scalar(["ID", ""]),
        },
      ],
      ({ f, $ }) => ({
        ...f.users({ id: [$.id], categoryId: $.categoryId }, () => ({
          ...models["${canonicalModel}"].fragment({ categoryId: $.categoryId }),
        })),
      }),
      ({ select }) =>
        select(["$.users"], () => {
          /* runtime function */
          return {};
        }),
    ))(),
} as const;
`;

    const transformed = await runBabelTransform(source, join(process.cwd(), "tests/.tmp", "intermediate-module.ts"), artifact, {
      importIdentifier: "@/graphql-runtime",
      skipTypeCheck: true, // Skip type check for intermediate modules
    });

    // Note: The plugin overrides the importIdentifier in some cases
    expect(transformed).toContain("import { gqlRuntime, type graphql } from ");
    assertTransformContainsRuntimeCall(transformed, "model");
    assertTransformContainsRuntimeCall(transformed, "querySlice");
  });
});