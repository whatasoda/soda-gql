/**
 * Shared utilities for AST traversal and scope tracking.
 * Used by both TypeScript and SWC adapters.
 */

/**
 * Scope frame for tracking AST path segments
 */
export type ScopeFrame = {
  /** Name segment (e.g., "MyComponent", "useQuery", "arrow#1") */
  readonly nameSegment: string;
  /** Kind of scope */
  readonly kind: "function" | "class" | "variable" | "property" | "method" | "expression";
};

/**
 * Build AST path from scope stack
 */
export const buildAstPath = (stack: readonly ScopeFrame[]): string => {
  return stack.map((frame) => frame.nameSegment).join(".");
};

/**
 * Create an occurrence tracker for disambiguating anonymous/duplicate scopes.
 */
export const createOccurrenceTracker = (): {
  getNextOccurrence: (key: string) => number;
} => {
  const occurrenceCounters = new Map<string, number>();

  return {
    getNextOccurrence(key: string): number {
      const current = occurrenceCounters.get(key) ?? 0;
      occurrenceCounters.set(key, current + 1);
      return current;
    },
  };
};

/**
 * Create a path uniqueness tracker to ensure AST paths are unique.
 */
export const createPathTracker = (): {
  ensureUniquePath: (basePath: string) => string;
} => {
  const usedPaths = new Set<string>();

  return {
    ensureUniquePath(basePath: string): string {
      let path = basePath;
      let suffix = 0;
      while (usedPaths.has(path)) {
        suffix++;
        path = `${basePath}$${suffix}`;
      }
      usedPaths.add(path);
      return path;
    },
  };
};

/**
 * Create an export bindings map from module exports.
 * Maps local variable names to their exported names.
 */
export const createExportBindingsMap = <T extends { kind: string; local?: string; exported: string; isTypeOnly?: boolean }>(
  exports: readonly T[],
): Map<string, string> => {
  const exportBindings = new Map<string, string>();
  exports.forEach((exp) => {
    if (exp.kind === "named" && exp.local && !exp.isTypeOnly) {
      exportBindings.set(exp.local, exp.exported);
    }
  });
  return exportBindings;
};
