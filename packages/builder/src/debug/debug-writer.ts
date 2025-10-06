import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getPortableFS } from "@soda-gql/common";
import type { BuilderArtifact } from "../artifact/types";
import type { ModuleAnalysis } from "../ast";
import type { DependencyGraph } from "../dependency-graph";

export type DebugWriter = {
  writeDiscoverySnapshot(modules: readonly ModuleAnalysis[], graph: DependencyGraph): Promise<void>;
  writeIntermediateModule(input: { sourceCode: string; transpiledPath: string }): Promise<void>;
  writeArtifact(artifact: BuilderArtifact): Promise<void>;
};

const createNoOpWriter = (): DebugWriter => ({
  writeDiscoverySnapshot: async () => {},
  writeIntermediateModule: async () => {},
  writeArtifact: async () => {},
});

const createRealWriter = (debugDir: string): DebugWriter => {
  const debugPath = resolve(debugDir);
  mkdirSync(debugPath, { recursive: true });
  const fs = getPortableFS();

  return {
    async writeDiscoverySnapshot(modules: readonly ModuleAnalysis[], graph: DependencyGraph): Promise<void> {
      await fs.writeFile(resolve(debugPath, "modules.json"), JSON.stringify(modules, null, 2));
      await fs.writeFile(resolve(debugPath, "graph.json"), JSON.stringify(Array.from(graph.entries()), null, 2));
    },

    async writeIntermediateModule({ sourceCode, transpiledPath }: { sourceCode: string; transpiledPath: string }): Promise<void> {
      await fs.writeFile(resolve(debugPath, "intermediate-module.ts"), sourceCode);
      const transpiledContent = await fs.readFile(transpiledPath);
      await fs.writeFile(resolve(debugPath, "intermediate-module.mjs"), transpiledContent);
    },

    async writeArtifact(artifact: BuilderArtifact): Promise<void> {
      await fs.writeFile(resolve(debugPath, "artifact.json"), JSON.stringify(artifact, null, 2));
    },
  };
};

/**
 * Create a debug writer helper.
 * Returns a no-op writer when debugDir is falsy, otherwise returns a real writer.
 */
export const createDebugWriter = (debugDir?: string): DebugWriter => {
  return debugDir ? createRealWriter(debugDir) : createNoOpWriter();
};
