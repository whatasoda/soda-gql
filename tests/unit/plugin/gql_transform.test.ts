import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { type BuilderArtifact, createCanonicalId, createRuntimeBindingName } from "../../../packages/builder/src/index.ts";
import { assertTransformContainsRuntimeCall, assertTransformRemovesGql, runBabelTransform } from "../../utils/transform";

describe("@soda-gql/plugin-babel zero-runtime transforms", () => {
  it("replaces gql helpers with runtime bindings", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/pages/profile.query.ts");
    const queryId = createCanonicalId(sourcePath, "profileQuery", "default");
    const queryRuntimeName = createRuntimeBindingName(queryId, "profileQuery");

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
      documents: {
        ProfilePageQuery: {
          name: "ProfilePageQuery",
          text: "query ProfilePageQuery { viewer { id } }",
          variables: {},
          sourcePath,
          ast: {
            kind: "Document",
            definitions: [],
          },
        },
      },
      refs: {
        [queryId]: {
          kind: "operation",
          metadata: {
            canonicalDocument: "ProfilePageQuery",
            dependencies: [userSliceId, userSliceCatalogId, userCatalogCollectionId],
          },
        },
        [userSliceId]: {
          kind: "slice",
          metadata: {
            dependencies: [],
            canonicalDocuments: ["ProfilePageQuery"],
          },
        },
        [userSliceCatalogId]: {
          kind: "slice",
          metadata: {
            dependencies: [],
            canonicalDocuments: ["ProfilePageQuery"],
          },
        },
        [userCatalogCollectionId]: {
          kind: "slice",
          metadata: {
            dependencies: [],
            canonicalDocuments: ["ProfilePageQuery"],
          },
        },
      },
      report: {
        documents: 2,
        models: 1,
        slices: 1,
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
    expect(transformed).toContain(`const ${queryRuntimeName}Document = {`);
    assertTransformContainsRuntimeCall(transformed, "query");
    expect(transformed).toContain("variableNames: [");
    expect(transformed).toContain(`document: ${queryRuntimeName}Document`);
    expect(transformed).toContain("getSlices:");
    expect(transformed).toContain("users:");
    expect(transformed).toContain("remoteUsers:");
  });

  it("replaces nested gql helpers exposed via object properties", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts");
    const nestedModelId = createCanonicalId(sourcePath, "userRemote.forIterate");
    const nestedSliceId = createCanonicalId(sourcePath, "userSliceCatalog.byId");

    // const _nestedModelRuntimeName = createRuntimeBindingName(nestedModelId, "userRemote.forIterate");
    // const _nestedSliceRuntimeName = createRuntimeBindingName(nestedSliceId, "userSliceCatalog.byId");

    const artifact: BuilderArtifact = {
      documents: {
        UserSliceCatalogDocument: {
          name: "UserSliceCatalogDocument",
          text: "fragment UserSliceCatalogDocument on Query { users { id } }",
          variables: {},
          sourcePath,
          ast: {
            kind: "Document",
            definitions: [],
          },
        },
      },
      refs: {
        [nestedModelId]: {
          kind: "model",
          metadata: {
            hash: "feedface",
            dependencies: [],
          },
        },
        [nestedSliceId]: {
          kind: "slice",
          metadata: {
            dependencies: [nestedModelId],
            canonicalDocuments: ["UserSliceCatalogDocument"],
          },
        },
      },
      report: {
        documents: 1,
        models: 1,
        slices: 1,
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
    });
    expect(transformed).toContain('import { gqlRuntime, type graphql } from "@soda-gql/runtime"');
    expect(transformed).toContain(`forIterate: gqlRuntime.model({`);
    expect(transformed).toContain(`byId: gqlRuntime.querySlice({`);
  });

  it("hydrates intermediate-module placeholders using original source definitions", async () => {
    // const _sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts");
    // const _modelId = createCanonicalId(_sourcePath, "userModel");
    // const _sliceId = createCanonicalId(_sourcePath, "userSlice");

    const artifact: BuilderArtifact = {
      documents: {},
      refs: {},
      report: {
        documents: 0,
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
        select("$.users", () => {
          /* runtime function */
          return {};
        }),
    ))(),
} as const;
`;

    const transformed = await runBabelTransform(source, join(process.cwd(), "tests/.tmp", "intermediate-module.ts"), artifact, {
      importIdentifier: "@/graphql-runtime",
    });

    // Note: The plugin overrides the importIdentifier in some cases
    expect(transformed).toContain("import { gqlRuntime, type graphql } from ");
    assertTransformContainsRuntimeCall(transformed, "model");
    assertTransformContainsRuntimeCall(transformed, "querySlice");
  });
});
