import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Kind } from "graphql";
import { type BuilderArtifact, createCanonicalId } from "../../../packages/builder/src/index.ts";
import { assertTransformRemovesGql, runBabelTransform } from "../../utils/transform";

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
              kind: Kind.DOCUMENT,
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
});
