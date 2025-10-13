/**
 * Library-neutral Intermediate Representation (IR) for GraphQL transformations.
 *
 * These types represent GraphQL calls and runtime payloads using plain data structures,
 * independent of any specific AST library (Babel, SWC, ESTree, esbuild).
 */

import type { CanonicalId } from "@soda-gql/builder";

/**
 * Runtime expression handle - adapter-specific opaque value representing executable code.
 * Adapters store their AST nodes or other representation here.
 */
export type RuntimeExpression = {
  readonly kind: "adapter-expression";
  readonly handle: unknown;
};

/**
 * Helper to create a RuntimeExpression from an adapter-specific handle.
 */
export const makeRuntimeExpression = (handle: unknown): RuntimeExpression => ({
  kind: "adapter-expression",
  handle,
});

/**
 * Runtime descriptor for a GraphQL model.
 */
export type RuntimeModelDescriptor = {
  readonly type: "model";
  readonly canonicalId: CanonicalId;
  readonly typename: string;
  readonly normalize: RuntimeExpression;
};

/**
 * Runtime descriptor for a GraphQL slice.
 */
export type RuntimeSliceDescriptor = {
  readonly type: "slice";
  readonly canonicalId: CanonicalId;
  readonly operationType: "query" | "mutation" | "subscription";
  readonly buildProjection: RuntimeExpression;
};

/**
 * Runtime descriptor for a GraphQL operation.
 */
export type RuntimeOperationDescriptor = {
  readonly type: "operation";
  readonly canonicalId: CanonicalId;
  readonly operationName: string;
  readonly prebuildPayload: unknown; // JSON-serializable
  readonly getSlices: RuntimeExpression;
};

/**
 * Union of all runtime call descriptors.
 */
export type RuntimeCallDescriptor = RuntimeModelDescriptor | RuntimeSliceDescriptor | RuntimeOperationDescriptor;

/**
 * Library-neutral representation of a GraphQL call in source code.
 */
export type GraphQLCallIR = {
  readonly descriptor: RuntimeCallDescriptor;
  readonly sourceFile: string;
};

/**
 * Result of analyzing a GraphQL call.
 */
export type GraphQLCallAnalysis = {
  readonly ir: GraphQLCallIR;
  readonly runtimeInsertion?: RuntimeExpression; // For operations that inject runtime call alongside reference
};

/**
 * Metadata about a GraphQL definition's location in source code.
 * Independent of any specific AST representation.
 */
export type DefinitionMetadata = {
  readonly astPath: string;
  readonly isTopLevel: boolean;
  readonly isExported: boolean;
  readonly exportBinding?: string;
};

/**
 * Map of definition identifiers to their metadata.
 * The key is an adapter-specific stable identifier (e.g., canonical ID).
 */
export type DefinitionMetadataMap = Map<string, DefinitionMetadata>;
