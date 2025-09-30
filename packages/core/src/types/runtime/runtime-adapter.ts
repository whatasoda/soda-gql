import type { PseudoTypeAnnotation } from "../shared/utility";

/**
 * Defines the runtime surface that the typed layer depends on. Implementations
 * adapt framework-specific error payloads without leaking those types into the
 * generated code.
 */
export type AnyGraphqlRuntimeAdapter = {
  nonGraphqlErrorType: PseudoTypeAnnotation<any>;
};
