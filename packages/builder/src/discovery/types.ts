import type { CanonicalId } from "@soda-gql/common";
import type { ModuleAnalysis, ModuleDefinition, SourceLocation } from "../ast";
import type { FileFingerprint } from "./fingerprint";

/**
 * Result of resolving a single import specifier encountered during discovery.
 */
export type DiscoveredDependency = {
  /** Module specifier exactly as it appeared in source. */
  readonly specifier: string;
  /** Absolute, normalized path when the specifier points to a local file; null for bare package imports. */
  readonly resolvedPath: string | null;
  /** True when the specifier targets an external package (i.e. no local snapshot will exist). */
  readonly isExternal: boolean;
};

/**
 * Augments ModuleDefinition with a precomputed canonical ID for downstream consumers.
 */
export type DiscoverySnapshotDefinition = ModuleDefinition & {
  /** Canonical identifier derived from file path and export name. */
  readonly canonicalId: CanonicalId;
};

/**
 * Immutable cacheable record produced by the discovery phase for a single source file.
 * Captures analyzer output, dependency fan-out, and bookkeeping metadata.
 */
export type DiscoverySnapshot = {
  /** Absolute path to the analyzed file (preserves original casing). */
  readonly filePath: string;
  /** Normalized path (POSIX separators) used as a stable cache key. */
  readonly normalizedFilePath: string;
  /** Signature of the source contents used to validate cache entries. */
  readonly signature: string;
  /** File fingerprint for fast cache invalidation. */
  readonly fingerprint: FileFingerprint;
  /** Analyzer type used for this snapshot (for debugging). */
  readonly analyzer: string;
  /** Milliseconds since epoch when this snapshot was created. */
  readonly createdAtMs: number;
  /** Raw analyzer output (imports, exports, definitions, diagnostics). */
  readonly analysis: ModuleAnalysis;
  /** Resolved graph edges for relative imports encountered in the file. */
  readonly dependencies: readonly DiscoveredDependency[];
};

/**
 * Categorization for evaluated definitions. Mirrors OperationRegistry buckets plus helper entries.
 */
export type ModuleEvaluationKind = "model" | "slice" | "operation" | "helper";

/**
 * Issue emitted while evaluating module exports (surfaced in BuilderError).
 */
export type ModuleEvaluationIssue = {
  /** Machine-readable issue code (e.g., DUPLICATE_OPERATION_NAME). */
  readonly code: string;
  /** Human-readable explanation. */
  readonly message: string;
  /** Severity gatekeeping whether the build can continue. */
  readonly severity: "error" | "warning";
  /** Definition associated with the issue, when available. */
  readonly canonicalId?: CanonicalId;
  /** Source location to highlight in tooling. */
  readonly loc?: SourceLocation;
};

/**
 * Successful evaluation record for a single definition.
 */
export type ModuleEvaluationDefinition = {
  /** Definition's canonical identifier (file path + export). */
  readonly canonicalId: CanonicalId;
  /** Export name as declared in source. */
  readonly exportName: string;
  /** Classification used by downstream registries. */
  readonly kind: ModuleEvaluationKind;
  /** Location of the defining call for diagnostics. */
  readonly loc: SourceLocation;
};

/**
 * Aggregated result returned by ModuleEvaluator after processing a snapshot.
 */
export type ModuleEvaluationResult = {
  /** Definitions that were successfully evaluated/categorized. */
  readonly definitions: readonly ModuleEvaluationDefinition[];
  /** Issues raised while evaluating this module. */
  readonly issues: readonly ModuleEvaluationIssue[];
};

/**
 * Execution context provided to evaluators to resolve cross-module data.
 */
export type ModuleEvaluatorContext = {
  /**
   * Retrieve the latest snapshot for a dependency.
   * Returns null when the dependency is external or undiscovered.
   */
  readonly getSnapshot: (filePath: string) => DiscoverySnapshot | null;
  /**
   * Resolve a module specifier relative to a file on disk.
   * Should mirror Node resolution semantics for local modules.
   */
  readonly resolve: (specifier: string, from: string) => string | null;
  /**
   * Dynamically import a discovered module for runtime evaluation.
   * Implementations can stub this in tests or swap loaders in Node vs Bun.
   */
  readonly importModule: (absolutePath: string) => Promise<unknown>;
};

/**
 * Input payload handed to a ModuleEvaluator.
 */
export type ModuleEvaluatorInput = {
  /** Snapshot being evaluated. */
  readonly snapshot: DiscoverySnapshot;
};

/**
 * Injectable evaluation contract invoked during discovery.
 * Allows different strategies (e.g., eager runtime evaluation vs. no-op in dry runs).
 */
export interface ModuleEvaluator {
  /**
   * Evaluate definitions exported by a discovered module.
   * Should never throw; errors must be captured in the returned issues array.
   */
  evaluateModule(
    input: ModuleEvaluatorInput,
    context: ModuleEvaluatorContext,
  ): Promise<ModuleEvaluationResult> | ModuleEvaluationResult;
  /**
   * Optional hook for cleanup (close watchers, dispose VM, etc.).
   */
  dispose?(): Promise<void> | void;
}

/**
 * Cache abstraction for storing and retrieving discovery snapshots.
 * Implementations can back onto disk, memory, or remote stores.
 */
export interface DiscoveryCache {
  /**
   * Look up a snapshot by file path and signature.
   * Returns null when the cache entry is missing or stale.
   */
  load(filePath: string, signature: string): DiscoverySnapshot | null;
  /**
   * Peek at cached snapshot without signature validation.
   * Used for fingerprint-based cache invalidation.
   * Returns null when the cache entry is missing.
   */
  peek(filePath: string): DiscoverySnapshot | null;
  /**
   * Persist the provided snapshot.
   */
  store(snapshot: DiscoverySnapshot): void;
  /**
   * Remove a snapshot when a file is deleted or invalidated.
   */
  delete(filePath: string): void;
  /**
   * Enumerate all cached snapshots (used to seed incremental builds).
   */
  entries(): IterableIterator<DiscoverySnapshot>;
  /**
   * Drop every cached entry (useful when analyzer versions change).
   */
  clear(): void;
  /**
   * Total number of entries currently stored.
   */
  size(): number;
}
