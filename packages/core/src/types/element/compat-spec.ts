/**
 * TemplateCompatSpec type for storing operation specifications from tagged template compat.
 * @module
 */

import type { OperationType } from "../schema";
import type { MinimalSchema } from "../schema/schema";

/**
 * Specification for a tagged template compat operation.
 * Stores raw GraphQL source string instead of fieldsBuilder callback.
 * Created by `query.compat\`...\``, `mutation.compat\`...\``, `subscription.compat\`...\``.
 *
 * This type is not generic — tagged template compat
 * does not carry type-level field or variable information. Types come from typegen.
 *
 * The graphqlSource is stored raw (unparsed). Parsing happens inside extend()
 * at extend-time, preserving the deferred execution model.
 */
export type TemplateCompatSpec = {
  readonly schema: MinimalSchema;
  readonly operationType: OperationType;
  readonly operationName: string;
  readonly graphqlSource: string;
};
