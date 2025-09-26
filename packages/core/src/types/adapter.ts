import type { PseudoTypeAnnotation } from "./utility";

/**
 * Defines the runtime surface that the typed layer depends on. Implementations
 * adapt framework-specific error payloads without leaking those types into the
 * generated code.
 */
export type GraphqlRuntimeAdapter = {
  nonGraphqlErrorType?: PseudoTypeAnnotation<unknown>;
  /** Convert a raw error coming from the execution environment into a stable shape. */
  createError: (raw: unknown) => unknown;
};

/**
 * Backwards-compatible alias retained for generated projects that still
 * reference the old `GraphqlAdapter` name.
 */
export type GraphqlAdapter = GraphqlRuntimeAdapter;
