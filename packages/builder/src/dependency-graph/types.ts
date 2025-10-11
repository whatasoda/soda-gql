import type { ModuleDefinition, ModuleImport } from "../ast";
import type { CanonicalId } from "../canonical-id/canonical-id";

/**
 * Per-file metadata for module-level dependency analysis.
 * Tracks imports and gql exports without analyzing expression ASTs.
 */
export type ModuleSummary = {
  readonly filePath: string;
  /** All import statements from this module */
  readonly runtimeImports: readonly ModuleImport[];
  /** Canonical IDs of all gql definitions exported from this module */
  readonly gqlExports: readonly CanonicalId[];
};

export type DependencyGraphNode = {
  readonly id: CanonicalId;
  /** Absolute file path of the module containing this definition */
  readonly filePath: string;
  /** Local path within the module (e.g., "userModel" or "foo.bar" for nested exports) */
  readonly localPath: string;
  /** Whether this definition is exported from its module */
  readonly isExported: boolean;
  readonly definition: ModuleDefinition;
  readonly dependencies: readonly CanonicalId[];
  /** Module summary for the file containing this node */
  readonly moduleSummary: ModuleSummary;
};

export type DependencyGraph = Map<CanonicalId, DependencyGraphNode>;

export type DependencyGraphError =
  | {
      readonly code: "GRAPH_CIRCULAR_DEPENDENCY";
      readonly chain: readonly CanonicalId[];
    }
  | {
      readonly code: "MISSING_IMPORT";
      readonly chain: readonly string[]; // [importing file, import specifier]
    };
