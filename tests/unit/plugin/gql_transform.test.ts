import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { transformAsync } from "@babel/core";

import createPlugin from "../../../packages/plugin-babel/src/index.ts";
import { createCanonicalId, type BuilderArtifact, type CanonicalId } from "../../../packages/builder/src/index.ts";

const withArtifactFile = async (artifact: BuilderArtifact): Promise<string> => {
  const artifactFile = join(process.cwd(), "tests", ".tmp", `babel-plugin-artifact-${randomUUID()}.json`);
  await Bun.write(artifactFile, JSON.stringify(artifact));
  return artifactFile;
};

const runTransform = async (source: string, filename: string, artifact: BuilderArtifact) => {
  const artifactPath = await withArtifactFile(artifact);
  const plugin = createPlugin;

  const result = await transformAsync(source, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: {
      sourceType: "module",
      plugins: ["typescript"],
    },
    plugins: [[plugin, { mode: "zero-runtime", artifactsPath: artifactPath, importIdentifier: "@/graphql-runtime" }]],
  });

  return result?.code ?? "";
};

describe("@soda-gql/plugin-babel zero-runtime transforms", () => {
  it("replaces gql helpers with runtime bindings", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/plugin/pages/profile.ts");
    const modelId: CanonicalId = createCanonicalId(sourcePath, "userModel");
    const sliceId: CanonicalId = createCanonicalId(sourcePath, "userSlice");
    const queryId: CanonicalId = createCanonicalId(sourcePath, "profileQuery");

    const artifact: BuilderArtifact = {
      documents: {
        ProfilePageQuery: {
          name: "ProfilePageQuery",
          text: "query ProfilePageQuery { viewer { id } }",
          variables: {},
          sourcePath,
        },
        UserSliceDocument: {
          name: "UserSliceDocument",
          text: "fragment UserSliceDocument on Query { viewer { id } }",
          variables: {},
          sourcePath,
        },
      },
      refs: {
        [modelId]: {
          kind: "model",
          metadata: {
            hash: "deadbeef",
            dependencies: [],
          },
        },
        [sliceId]: {
          kind: "slice",
          metadata: {
            dependencies: [modelId],
            canonicalDocuments: ["UserSliceDocument"],
          },
        },
        [queryId]: {
          kind: "operation",
          metadata: {
            canonicalDocument: "ProfilePageQuery",
            dependencies: [sliceId],
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

    const source = `\
import { gql } from "@/graphql-system";

export const userModel = gql.model("User", () => ({}), () => ({}));

export const userSlice = gql.querySlice([], () => ({}), () => ({}));

export const profileQuery = gql.query("ProfilePageQuery", {}, () => ({}));
`;

    const transformed = await runTransform(source, sourcePath, artifact);

    expect(transformed).not.toContain("gql.model");
    expect(transformed).not.toContain("gql.querySlice");
    expect(transformed).not.toContain("gql.query");
    expect(transformed).toContain("userModelArtifact");
    expect(transformed).toContain("userSliceArtifact");
    expect(transformed).toContain("profileQueryArtifact");
    expect(transformed).toContain('import { userModel as userModelArtifact');
    expect(transformed).not.toContain('import { gql');
  });

  it("replaces nested gql helpers exposed via object properties", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/plugin/entities/user.ts");
    const nestedModelId: CanonicalId = createCanonicalId(sourcePath, "userRemote.forIterate");
    const nestedSliceId: CanonicalId = createCanonicalId(sourcePath, "userSliceCatalog.byId");

    const artifact: BuilderArtifact = {
      documents: {
        UserSliceCatalogDocument: {
          name: "UserSliceCatalogDocument",
          text: "fragment UserSliceCatalogDocument on Query { users { id } }",
          variables: {},
          sourcePath,
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

    const source = `\
import { gql } from "@/graphql-system";

export const userRemote = {
  forIterate: gql.model("User", () => ({}), () => ({})),
};

export const userSliceCatalog = {
  byId: gql.querySlice([], () => ({}), () => ({})),
};
`;

    const transformed = await runTransform(source, sourcePath, artifact);

    expect(transformed).not.toContain("gql.model");
    expect(transformed).not.toContain("gql.querySlice");
    expect(transformed).toContain("userRemote_forIterateArtifact");
    expect(transformed).toContain("userSliceCatalog_byIdArtifact");
    expect(transformed).toContain("forIterate: userRemote_forIterateArtifact");
    expect(transformed).toContain("byId: userSliceCatalog_byIdArtifact");
    expect(transformed).toContain('import { userRemote_forIterate as userRemote_forIterateArtifact');
    expect(transformed).not.toContain('import { gql');
  });
});
