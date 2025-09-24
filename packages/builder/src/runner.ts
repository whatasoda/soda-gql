import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { err } from "neverthrow";

import { buildArtifact } from "./artifact";
import { buildDependencyGraph } from "./dependency-graph";
import { loadModules } from "./module-loader";
import { createRuntimeModule } from "./runtime-module";
import type { BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

export const runBuilder = async (options: BuilderOptions): Promise<BuilderResult> => {
  const modules = loadModules({ entry: options.entry, analyzer: options.analyzer });
  if (modules.isErr()) {
    return modules;
  }

  const { stats, modules: analyses } = modules.value;

  const dependencyGraph = buildDependencyGraph(analyses);
  if (dependencyGraph.isErr()) {
    return err({
      code: "CIRCULAR_DEPENDENCY",
      chain: dependencyGraph.error.chain,
    });
  }

  const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");
  const runtimeModule = await createRuntimeModule({
    graph: dependencyGraph.value,
    outDir: runtimeDir,
  });

  if (runtimeModule.isErr()) {
    return runtimeModule;
  }

  if (options.debugDir) {
    const debugPath = resolve(options.debugDir);
    mkdirSync(debugPath, { recursive: true });
    await Bun.write(
      resolve(debugPath, "modules.json"),
      JSON.stringify(analyses, null, 2),
    );
    await Bun.write(
      resolve(debugPath, "graph.json"),
      JSON.stringify(Array.from(dependencyGraph.value.entries()), null, 2),
    );
    await Bun.write(
      resolve(debugPath, "runtime-module.ts"),
      await Bun.file(runtimeModule.value).text(),
    );
  }

  const artifactResult = await buildArtifact({
    graph: dependencyGraph.value,
    cache: stats,
    runtimeModulePath: runtimeModule.value,
  });

  if (artifactResult.isErr()) {
    return artifactResult;
  }

  if (options.debugDir) {
    const debugPath = resolve(options.debugDir);
    await Bun.write(
      resolve(debugPath, "artifact.json"),
      JSON.stringify(artifactResult.value, null, 2),
    );
  }

  return writeArtifact(resolve(options.outPath), artifactResult.value);
};
