import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { ensureGraphqlSystemBundle } from "../helpers/graphql-system";
import { createTestConfig } from "../helpers/test-config";
import { getProjectRoot } from "./index";

export type LoadedPluginBabelFixture = {
  sourcePath: string;
  sourceCode: string;
  artifact: BuilderArtifact;
};

const FIXTURE_ROOT = join(getProjectRoot(), "tests/fixtures/plugin-babel");
const SCHEMA_PATH = join(getProjectRoot(), "tests/fixtures/runtime-app/schema.graphql");
const TMP_ROOT = join(getProjectRoot(), "tests/.tmp/plugin-babel-fixtures");

/**
 * Load a plugin-babel fixture by running the builder to generate artifact.
 * This ensures tests use naturally generated artifacts, not hardcoded ones.
 */
export const loadPluginBabelFixture = async (name: string): Promise<LoadedPluginBabelFixture> => {
  const fixtureDir = join(FIXTURE_ROOT, name);
  const sourcePath = join(fixtureDir, "source.ts");
  const sourceFile = Bun.file(sourcePath);

  if (!(await sourceFile.exists())) {
    throw new Error(`Fixture source missing: ${sourcePath}`);
  }

  // Create temporary workspace for this fixture
  const workspaceRoot = join(TMP_ROOT, name.replace(/\//g, "-"), `${Date.now()}`);
  mkdirSync(workspaceRoot, { recursive: true });

  try {
    // Setup workspace structure
    const srcDir = join(workspaceRoot, "src");
    mkdirSync(srcDir, { recursive: true });

    // Copy source file to src/
    const destSourcePath = join(srcDir, "fixture.ts");
    cpSync(sourcePath, destSourcePath);

    // Generate GraphQL system
    const graphqlSystemDir = join(workspaceRoot, "graphql-system");
    await ensureGraphqlSystemBundle({
      outFile: join(graphqlSystemDir, "index.ts"),
      schemaPath: SCHEMA_PATH,
    });

    // Create builder service
    const config = createTestConfig(workspaceRoot, {
      graphqlSystemAliases: ["@/graphql-system"],
    });

    const service = createBuilderService({
      config: {
        ...config,
        outdir: graphqlSystemDir,
        include: [join(srcDir, "**/*.ts")],
      },
    });

    // Build artifact
    const buildResult = service.build();
    if (buildResult.isErr()) {
      throw new Error(`Builder failed for ${name}: ${buildResult.error.code}`);
    }

    const artifact = buildResult.value;
    const sourceCode = await sourceFile.text();

    // Rewrite canonical IDs to use original fixture path instead of workspace path
    // This allows the artifact to be used with the original source file during transformation
    const rewrittenElements: typeof artifact.elements = {};
    for (const [oldId, element] of Object.entries(artifact.elements)) {
      // Replace workspace path with original fixture path
      // oldId format: /path/to/workspace/src/fixture.ts::exportName
      // newId format: /path/to/fixture/source.ts::exportName
      const exportName = oldId.split("::")[1];
      const newId = `${sourcePath}::${exportName}`;
      rewrittenElements[newId as any] = {
        ...element,
        id: newId as any,
      };
    }

    return {
      sourcePath,
      sourceCode,
      artifact: {
        ...artifact,
        elements: rewrittenElements,
      },
    };
  } finally {
    // Cleanup workspace
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
};
