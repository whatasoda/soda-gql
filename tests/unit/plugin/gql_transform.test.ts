import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createCanonicalId } from "@soda-gql/builder";
import { Kind } from "graphql";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";
import { assertTransformRemovesGql, runBabelTransform } from "../../utils/transform";

describe("@soda-gql/plugin-babel zero-runtime transforms", () => {
  it("replaces gql helpers with runtime bindings", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/pages/profile.query.ts");
    const queryId = createCanonicalId(sourcePath, "profileQuery");

    const userSliceId = createCanonicalId(join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts"), "userSlice");
    const userSliceCatalogId = createCanonicalId(
      join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts"),
      "userSliceCatalog.byId",
    );
    const userCatalogCollectionId = createCanonicalId(
      join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.catalog.ts"),
      "collections.byCategory",
    );

    const artifact = createBuilderArtifact(
      [
        [
          queryId,
          {
            type: "operation",
            id: queryId,
            prebuild: {
              operationType: "query",
              operationName: "ProfilePageQuery",
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
          },
        ],
        [
          userSliceId,
          {
            type: "slice",
            id: userSliceId,
            prebuild: {
              operationType: "query",
            },
          },
        ],
        [
          userSliceCatalogId,
          {
            type: "slice",
            id: userSliceCatalogId,
            prebuild: {
              operationType: "query",
            },
          },
        ],
        [
          userCatalogCollectionId,
          {
            type: "slice",
            id: userCatalogCollectionId,
            prebuild: {
              operationType: "query",
            },
          },
        ],
      ],
      { cache: { misses: 1 } },
    );

    const source = await Bun.file(sourcePath).text();

    const transformed = await runBabelTransform(source, sourcePath, artifact, {
      importIdentifier: "@/graphql-runtime",
      skipTypeCheck: true, // Skip type check as this file imports untransformed dependencies
    });
    assertTransformRemovesGql(transformed);
    // Verify gqlRuntime API usage
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain("gqlRuntime.operation({");
    expect(transformed).toContain("prebuild: JSON.parse(");
    expect(transformed).toContain("operationType");
    expect(transformed).toContain("query");
    expect(transformed).toContain("ProfilePageQuery");
    expect(transformed).toContain('export const profileQuery = gqlRuntime.getOperation("ProfilePageQuery")');
  });
});
