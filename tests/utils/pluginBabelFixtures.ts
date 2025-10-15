import { join } from "node:path";
import type { BuilderArtifact, BuilderArtifactElement } from "@soda-gql/builder";
import { createCanonicalId } from "@soda-gql/builder";
import { createBuilderArtifact, createInvalidArtifactElement } from "./artifact-fixtures";
import { getProjectRoot } from "./index";

type FixtureElementSpec = {
  export: string;
  type?: "operation" | "model" | "slice";
  kind?: "invalid";
  prebuild?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

type FixtureSpec = {
  source: string;
  elements: FixtureElementSpec[];
  artifactOverrides?: {
    durationMs?: number;
    warnings?: readonly string[];
    cache?: { hits?: number; misses?: number; skips?: number };
  };
};

export type LoadedPluginBabelFixture = {
  sourcePath: string;
  sourceCode: string;
  artifact: BuilderArtifact;
  elements: readonly FixtureElementSpec[];
};

const FIXTURE_ROOT = join(getProjectRoot(), "tests/fixtures/plugin-babel");

const readJson = async <T>(path: string): Promise<T> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Fixture metadata missing: ${path}`);
  }
  return (await file.json()) as T;
};

export const loadPluginBabelFixture = async (name: string): Promise<LoadedPluginBabelFixture> => {
  const fixtureDir = join(FIXTURE_ROOT, name);
  const spec = await readJson<FixtureSpec>(join(fixtureDir, "fixture.json"));
  const sourcePath = join(fixtureDir, spec.source);
  const sourceFile = Bun.file(sourcePath);
  if (!(await sourceFile.exists())) {
    throw new Error(`Fixture source missing: ${sourcePath}`);
  }

  const elements: Array<[string, BuilderArtifactElement]> = [];
  for (const entry of spec.elements) {
    const canonicalId = createCanonicalId(sourcePath, entry.export);
    if (entry.kind === "invalid") {
      const invalid = createInvalidArtifactElement({
        id: canonicalId,
        type: entry.type ?? "unknown",
        prebuild: entry.data ?? {},
      });
      elements.push([canonicalId, invalid]);
      continue;
    }

    if (!entry.type) {
      throw new Error(`Fixture ${name} element ${entry.export} is missing "type"`);
    }

    elements.push([
      canonicalId,
      {
        id: canonicalId,
        type: entry.type,
        prebuild: entry.prebuild ?? {},
      } as BuilderArtifactElement,
    ]);
  }

  const artifact = createBuilderArtifact(elements as any, spec.artifactOverrides);
  const sourceCode = await sourceFile.text();

  return {
    sourcePath,
    sourceCode,
    artifact,
    elements: spec.elements,
  };
};
