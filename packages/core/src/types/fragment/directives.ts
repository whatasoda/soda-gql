import type { AnyDirectiveRef } from "../type-foundation/directive-ref";

/**
 * Field-level directive attachments as an array of DirectiveRef.
 * Directives are applied in order and validated at build time.
 */
export type AnyDirectiveAttachments = readonly AnyDirectiveRef[];
