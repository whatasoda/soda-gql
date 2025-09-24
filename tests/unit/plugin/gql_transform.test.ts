import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { transformAsync } from "@babel/core";

import createPlugin from "../../../packages/plugin-babel/src/index.ts";
import {
  createCanonicalId,
  createRuntimeBindingName,
  type BuilderArtifact,
  type CanonicalId,
} from "../../../packages/builder/src/index.ts";

const withArtifactFile = async (artifact: BuilderArtifact): Promise<string> => {
  const artifactFile = join(process.cwd(), "tests", ".tmp", `babel-plugin-artifact-${randomUUID()}.json`);
  await Bun.write(artifactFile, JSON.stringify(artifact));
  return artifactFile;
};

const writeTransformedOutput = async (label: string, contents: string) => {
  const outputDir = join(process.cwd(), "tests", ".tmp", "unit-plugin-transforms");
  mkdirSync(outputDir, { recursive: true });
  const fileName = `${label}-${Date.now()}-${randomUUID()}.ts`;
  const filePath = join(outputDir, fileName);
  await Bun.write(filePath, contents);
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

    const modelRuntimeName = createRuntimeBindingName(modelId, "userModel");
    const sliceRuntimeName = createRuntimeBindingName(sliceId, "userSlice");
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
        UserSliceDocument: {
          name: "UserSliceDocument",
          text: "fragment UserSliceDocument on Query { viewer { id } }",
          variables: {},
          sourcePath,
          ast: {
            kind: "Document",
            definitions: [],
          },
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
    await writeTransformedOutput(`${queryRuntimeName}-profile`, transformed);

    expect(transformed).not.toContain("gql.model");
    expect(transformed).not.toContain("gql.querySlice");
    expect(transformed).not.toContain("gql.query");
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain(`const ${queryRuntimeName}Document = {`);
    expect(transformed).toContain(`export const userModel = gqlRuntime.model({`);
    expect(transformed).toContain(`export const userSlice = gqlRuntime.querySlice({`);
    expect(transformed).toContain(`export const profileQuery = gqlRuntime.query({`);
    expect(transformed).toContain(`document: ${queryRuntimeName}Document`);
    expect(transformed).not.toMatch(/import\s+{\s*gql\b/);
  });

  it("replaces nested gql helpers exposed via object properties", async () => {
    const sourcePath = join(process.cwd(), "tests/fixtures/plugin/entities/user.ts");
    const nestedModelId: CanonicalId = createCanonicalId(sourcePath, "userRemote.forIterate");
    const nestedSliceId: CanonicalId = createCanonicalId(sourcePath, "userSliceCatalog.byId");

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
    await writeTransformedOutput(`${nestedSliceRuntimeName}-nested`, transformed);

    expect(transformed).not.toContain("gql.model");
    expect(transformed).not.toContain("gql.querySlice");
    expect(transformed).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
    expect(transformed).toContain(`forIterate: gqlRuntime.model({`);
    expect(transformed).toContain(`byId: gqlRuntime.querySlice({`);
    expect(transformed).not.toMatch(/import\s+{\s*gql\b/);
  });
});
