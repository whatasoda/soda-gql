/**
 * Canonical path tracker for AST traversal.
 *
 * This module provides a stateful helper that tracks scope information during
 * AST traversal to generate canonical IDs. It's designed to integrate with
 * existing plugin visitor patterns (Babel, SWC, TypeScript) without requiring
 * a separate AST traversal.
 *
 * Usage pattern:
 * 1. Plugin creates tracker at file/program entry
 * 2. Plugin calls enterScope/exitScope during its traversal
 * 3. Plugin calls registerDefinition when discovering GQL definitions
 * 4. Tracker provides canonical ID information
 */

import type { CanonicalId } from "../utils/canonical-id";
import { createCanonicalId } from "../utils/canonical-id";

/**
 * Scope frame for tracking AST path segments
 */
export type ScopeFrame = {
  /** Name segment (e.g., "MyComponent", "useQuery", "arrow#1") */
  readonly nameSegment: string;
  /** Kind of scope */
  readonly kind: "function" | "class" | "variable" | "property" | "method" | "expression";
  /** Occurrence index for disambiguation */
  readonly occurrence: number;
};

/**
 * Opaque handle for scope tracking
 */
export type ScopeHandle = {
  readonly __brand: "ScopeHandle";
  readonly depth: number;
};

/**
 * Canonical path tracker interface
 */
export interface CanonicalPathTracker {
  /**
   * Enter a new scope during traversal
   * @param options Scope information
   * @returns Handle to use when exiting the scope
   */
  enterScope(options: {
    segment: string;
    kind: ScopeFrame["kind"];
    stableKey?: string;
  }): ScopeHandle;

  /**
   * Exit a scope during traversal
   * @param handle Handle returned from enterScope
   */
  exitScope(handle: ScopeHandle): void;

  /**
   * Register a definition discovered during traversal
   * @returns Definition metadata including astPath and canonical ID information
   */
  registerDefinition(): {
    astPath: string;
    isTopLevel: boolean;
    exportBinding?: string;
  };

  /**
   * Resolve a canonical ID from an astPath
   * @param astPath AST path string
   * @returns Canonical ID
   */
  resolveCanonicalId(astPath: string): CanonicalId;

  /**
   * Register an export binding
   * @param local Local variable name
   * @param exported Exported name
   */
  registerExportBinding(local: string, exported: string): void;

  /**
   * Get current scope depth
   * @returns Current depth (0 = top level)
   */
  currentDepth(): number;
}

/**
 * Build AST path from scope stack (internal helper)
 */
const _buildAstPath = (stack: readonly ScopeFrame[]): string => {
  return stack.map((frame) => frame.nameSegment).join(".");
};

/**
 * Create a canonical path tracker
 *
 * @param options Configuration options
 * @returns Tracker instance
 *
 * @example
 * ```typescript
 * // In a Babel plugin
 * const tracker = createCanonicalTracker({ filePath: state.filename });
 *
 * const visitor = {
 *   FunctionDeclaration: {
 *     enter(path) {
 *       const handle = tracker.enterScope({
 *         segment: path.node.id.name,
 *         kind: 'function'
 *       });
 *     },
 *     exit(path) {
 *       tracker.exitScope(handle);
 *     }
 *   }
 * };
 * ```
 */
export const createCanonicalTracker = (options: {
  filePath: string;
  getExportName?: (localName: string) => string | undefined;
}): CanonicalPathTracker => {
  const { filePath, getExportName } = options;

  // Scope stack
  const scopeStack: ScopeFrame[] = [];

  // Occurrence counters for disambiguating duplicate names
  const occurrenceCounters = new Map<string, number>();

  // Used paths for ensuring uniqueness
  const usedPaths = new Set<string>();

  // Export bindings map
  const exportBindings = new Map<string, string>();

  const getNextOccurrence = (key: string): number => {
    const current = occurrenceCounters.get(key) ?? 0;
    occurrenceCounters.set(key, current + 1);
    return current;
  };

  const ensureUniquePath = (basePath: string): string => {
    let path = basePath;
    let suffix = 0;
    while (usedPaths.has(path)) {
      suffix++;
      path = `${basePath}$${suffix}`;
    }
    usedPaths.add(path);
    return path;
  };

  return {
    enterScope({ segment, kind, stableKey }): ScopeHandle {
      const key = stableKey ?? `${kind}:${segment}`;
      const occurrence = getNextOccurrence(key);

      const frame: ScopeFrame = {
        nameSegment: segment,
        kind,
        occurrence,
      };

      scopeStack.push(frame);

      return {
        __brand: "ScopeHandle",
        depth: scopeStack.length - 1,
      } as ScopeHandle;
    },

    exitScope(handle: ScopeHandle): void {
      // Validate handle depth matches current stack
      if (handle.depth !== scopeStack.length - 1) {
        throw new Error(
          `Invalid scope exit: expected depth ${scopeStack.length - 1}, got ${handle.depth}`,
        );
      }
      scopeStack.pop();
    },

    registerDefinition(): {
      astPath: string;
      isTopLevel: boolean;
      exportBinding?: string;
    } {
      const basePath = _buildAstPath(scopeStack);
      const astPath = ensureUniquePath(basePath);
      const isTopLevel = scopeStack.length === 0;

      // Check export binding if provided
      let exportBinding: string | undefined;
      if (getExportName && isTopLevel) {
        // For top-level definitions, try to get export name
        // This is a simplified version - real logic depends on how the definition is bound
        exportBinding = undefined;
      }

      return {
        astPath,
        isTopLevel,
        exportBinding,
      };
    },

    resolveCanonicalId(astPath: string): CanonicalId {
      return createCanonicalId(filePath, astPath);
    },

    registerExportBinding(local: string, exported: string): void {
      exportBindings.set(local, exported);
    },

    currentDepth(): number {
      return scopeStack.length;
    },
  };
};

/**
 * Helper to create occurrence tracker (for backward compatibility)
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
 * Helper to create path tracker (for backward compatibility)
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
 * Build AST path from scope stack (for backward compatibility)
 */
export const buildAstPath = (stack: readonly ScopeFrame[]): string => {
  return stack.map((frame) => frame.nameSegment).join(".");
};
