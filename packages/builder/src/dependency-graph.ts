import { ok, type Result } from "neverthrow";

import type { ModuleAnalysis, ModuleDefinition } from "./ast/analyze-module";
import type { CanonicalId } from "./registry";

export type DependencyGraphNode = {
  readonly id: CanonicalId;
  readonly definition: ModuleDefinition;
  readonly dependencies: readonly CanonicalId[];
};

export type DependencyGraph = Map<CanonicalId, DependencyGraphNode>;

export type DependencyGraphError = {
  readonly code: "CIRCULAR_DEPENDENCY";
  readonly chain: readonly CanonicalId[];
};

export const buildDependencyGraph = (
  _modules: readonly ModuleAnalysis[],
): Result<DependencyGraph, DependencyGraphError> => ok(new Map());
