import type { DependencyGraph } from "../dependency-graph";
import type { ModuleLoadStats } from "../discovery/discovery-pipeline";

export type BuildArtifactInput = {
  readonly graph: DependencyGraph;
  readonly cache: ModuleLoadStats;
  readonly intermediateModulePath: string;
};
