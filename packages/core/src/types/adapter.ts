/**
 * Defines the runtime surface that the typed layer depends on. Implementations
 * adapt framework-specific error payloads without leaking those types into the
 * generated code.
 */
export type GraphqlAdapter = {
  /** Convert a raw error coming from the execution environment into a stable shape. */
  createError: (raw: unknown) => unknown;
};
