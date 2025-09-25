import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { transformAsync } from "@babel/core";

import createPlugin from "../../../packages/plugin-babel/src/index.ts";
import {
  createCanonicalId,
  createRuntimeBindingName,
  type BuilderArtifact,
} from "../../../packages/builder/src/index.ts";

const withArtifactFile = async (artifact: BuilderArtifact): Promise<string> => {
  const artifactDir = join(process.cwd(), "tests", ".tmp");
  mkdirSync(artifactDir, { recursive: true });
  const artifactFile = join(artifactDir, "babel-plugin-artifact.json");
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
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/pages/profile.query.ts");
    const queryId = createCanonicalId(sourcePath, "profileQuery");
    const queryRuntimeName = createRuntimeBindingName(queryId, "profileQuery");

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
            dependencies: [],
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

    const transformed = await runTransform(source, sourcePath, artifact);
    expect(transformed).not.toContain("gql.query(");
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain(`const ${queryRuntimeName}Document = {`);
    expect(transformed).toContain(`export const profileQuery = gqlRuntime.query({`);
    expect(transformed).toContain(`document: ${queryRuntimeName}Document`);
  });

  it("replaces nested gql helpers exposed via object properties", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts");
    const nestedModelId = createCanonicalId(sourcePath, "userRemote.forIterate");
    const nestedSliceId = createCanonicalId(sourcePath, "userSliceCatalog.byId");

    const nestedModelRuntimeName = createRuntimeBindingName(nestedModelId, "userRemote.forIterate");
    const nestedSliceRuntimeName = createRuntimeBindingName(nestedSliceId, "userSliceCatalog.byId");

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

    const transformed = await runTransform(source, sourcePath, artifact);
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain(`forIterate: gqlRuntime.model({`);
    expect(transformed).toContain(`byId: gqlRuntime.querySlice({`);
  });

  it("hydrates runtime-module placeholders using original source definitions", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/runtime-app/src/entities/user.ts");
    const modelId = createCanonicalId(sourcePath, "userModel");
    const sliceId = createCanonicalId(sourcePath, "userSlice");

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

    const runtimeModulePath = join(process.cwd(), "tests/fixtures/runtime-module/user.runtime.ts");
    const expectedPath = join(process.cwd(), "tests/fixtures/runtime-module/user.runtime.transformed.ts");
    const source = await Bun.file(runtimeModulePath).text();
    const transformed = await runTransform(source, runtimeModulePath, artifact);
    const expected = await Bun.file(expectedPath).text();

    expect(transformed.trim()).toBe(expected.trim());
  });
});
