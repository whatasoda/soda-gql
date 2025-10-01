/**
 * Build-time issue registry for collecting warnings and errors during lazy evaluation.
 * This module provides a global context for tracking issues without aborting evaluation.
 */

export type IssueSeverity = "warning" | "error";

export type IssueCode =
  | "DUPLICATE_OPERATION_NAME"
  | "INVALID_MODEL"
  | "INVALID_SLICE"
  | "INVALID_OPERATION"
  | "TOO_MANY_SLICES_WARNING"
  | "TOO_MANY_SLICES_ERROR";

export interface Issue {
  readonly severity: IssueSeverity;
  readonly code: IssueCode;
  readonly message: string;
  readonly canonicalId: string;
  readonly related?: readonly string[];
}

export interface IssueRegistry {
  /**
   * Add an issue to the registry
   */
  addIssue(issue: Issue): void;

  /**
   * Register an operation name with its canonical ID
   * Returns true if successfully registered, false if duplicate detected
   */
  registerOperationName(operationName: string, canonicalId: string): boolean;

  /**
   * Get a snapshot of all accumulated issues
   */
  getIssues(): readonly Issue[];

  /**
   * Check if there are any errors (not just warnings)
   */
  hasErrors(): boolean;
}

export const createIssueRegistry = (): IssueRegistry => {
  const issues: Issue[] = [];
  const operationNameIndex = new Map<string, string>();

  return {
    addIssue(issue: Issue): void {
      issues.push(issue);
    },

    registerOperationName(operationName: string, canonicalId: string): boolean {
      const existing = operationNameIndex.get(operationName);
      if (existing !== undefined && existing !== canonicalId) {
        // Duplicate detected
        this.addIssue({
          severity: "error",
          code: "DUPLICATE_OPERATION_NAME",
          message: `Duplicate operation name "${operationName}"`,
          canonicalId,
          related: [existing],
        });
        return false;
      }
      operationNameIndex.set(operationName, canonicalId);
      return true;
    },

    getIssues(): readonly Issue[] {
      return issues;
    },

    hasErrors(): boolean {
      return issues.some((issue) => issue.severity === "error");
    },
  };
};

/**
 * Global evaluation context singleton
 */
let _activeRegistry: IssueRegistry | null = null;

/**
 * Set the active issue registry for the current evaluation context
 */
export const setActiveRegistry = (registry: IssueRegistry | null): void => {
  _activeRegistry = registry;
};

/**
 * Get the currently active issue registry, if any
 */
export const getActiveRegistry = (): IssueRegistry | null => {
  return _activeRegistry;
};

/**
 * Thresholds for slice count validation
 */
const SLICE_COUNT_WARNING_THRESHOLD = 8;
const SLICE_COUNT_ERROR_THRESHOLD = 16;

/**
 * Callback when an operation is evaluated
 */
export const onOperationEvaluated = (params: { canonicalId: string; operationName: string; sliceCount: number }): void => {
  const registry = getActiveRegistry();
  if (registry === null) {
    return;
  }

  registry.registerOperationName(params.operationName, params.canonicalId);

  // Check slice count thresholds
  if (params.sliceCount >= SLICE_COUNT_ERROR_THRESHOLD) {
    registry.addIssue({
      severity: "error",
      code: "TOO_MANY_SLICES_ERROR",
      message: `Operation has too many slices (${params.sliceCount}). Maximum allowed is ${SLICE_COUNT_ERROR_THRESHOLD - 1}.`,
      canonicalId: params.canonicalId,
    });
  } else if (params.sliceCount >= SLICE_COUNT_WARNING_THRESHOLD) {
    registry.addIssue({
      severity: "warning",
      code: "TOO_MANY_SLICES_WARNING",
      message: `Operation has many slices (${params.sliceCount}). Consider reducing to below ${SLICE_COUNT_WARNING_THRESHOLD}.`,
      canonicalId: params.canonicalId,
    });
  }
};
