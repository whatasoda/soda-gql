/**
 * AST analysis for gql calls in SWC.
 *
 * Provides functions for detecting, extracting, and classifying gql calls.
 */

import type { BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type {
  GqlCallInlineOperation,
  GqlCallModel,
  GqlCallOperation,
  GqlCallSlice,
  PluginAnalysisArtifactMissingError,
  PluginAnalysisMetadataMissingError,
  PluginAnalysisUnsupportedArtifactTypeError,
  PluginError,
} from "@soda-gql/plugin-common";
import { resolveCanonicalId } from "@soda-gql/plugin-common";
import type {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Expression,
  Identifier,
  MemberExpression,
} from "@swc/types";
import { err, ok, type Result } from "neverthrow";
import type { GqlDefinitionMetadataMap } from "./metadata";

export type ArtifactLookup = (canonicalId: CanonicalId) => BuilderArtifactElement | undefined;

// SWC-specific GqlCall types
export type SwcGqlCallModel = GqlCallModel<CallExpression>;
export type SwcGqlCallSlice = GqlCallSlice<CallExpression>;
export type SwcGqlCallOperation = GqlCallOperation<CallExpression>;
export type SwcGqlCallInlineOperation = GqlCallInlineOperation<CallExpression>;

export type SwcGqlCall = SwcGqlCallModel | SwcGqlCallSlice | SwcGqlCallOperation | SwcGqlCallInlineOperation;

export type ExtractGqlCallArgs = {
  readonly callExpr: CallExpression;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly builderCall: CallExpression;
  readonly getArtifact: ArtifactLookup;
};

/**
 * Extract and classify a gql call.
 */
export const extractGqlCall = ({
  callExpr,
  filename,
  metadata,
  builderCall,
  getArtifact,
}: ExtractGqlCallArgs): Result<SwcGqlCall, PluginError> => {
  const meta = metadata.get(callExpr);
  if (!meta) {
    return err(createMetadataMissingError({ filename }));
  }

  const canonicalId = resolveCanonicalId(filename, meta.astPath);
  const artifact = getArtifact(canonicalId);

  if (!artifact) {
    return err(createArtifactMissingError({ filename, canonicalId }));
  }

  if (artifact.type === "model") {
    return ok({ canonicalId, builderCall, type: "model", artifact });
  }

  if (artifact.type === "slice") {
    return ok({ canonicalId, builderCall, type: "slice", artifact });
  }

  if (artifact.type === "operation") {
    return ok({ canonicalId, builderCall, type: "operation", artifact });
  }

  if (artifact.type === "inlineOperation") {
    return ok({ canonicalId, builderCall, type: "inlineOperation", artifact });
  }

  return err(
    createUnsupportedArtifactTypeError({
      filename,
      canonicalId,
      artifactType: (artifact as { type: string }).type,
    }),
  );
};

type MetadataErrorInput = { readonly filename: string };
type ArtifactMissingErrorInput = { readonly filename: string; readonly canonicalId: CanonicalId };
type UnsupportedArtifactTypeInput = {
  readonly filename: string;
  readonly canonicalId: CanonicalId;
  readonly artifactType: string;
};

const createMetadataMissingError = ({ filename }: MetadataErrorInput): PluginAnalysisMetadataMissingError => ({
  type: "PluginError",
  stage: "analysis",
  code: "SODA_GQL_METADATA_NOT_FOUND",
  message: `No GraphQL metadata found for ${filename}`,
  cause: { filename },
  filename,
});

const createArtifactMissingError = ({
  filename,
  canonicalId,
}: ArtifactMissingErrorInput): PluginAnalysisArtifactMissingError => ({
  type: "PluginError",
  stage: "analysis",
  code: "SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND",
  message: `Artifact missing for ${canonicalId}`,
  cause: { filename, canonicalId },
  filename,
  canonicalId,
});

const createUnsupportedArtifactTypeError = ({
  filename,
  canonicalId,
  artifactType,
}: UnsupportedArtifactTypeInput): PluginAnalysisUnsupportedArtifactTypeError => ({
  type: "PluginError",
  stage: "analysis",
  code: "SODA_GQL_UNSUPPORTED_ARTIFACT_TYPE",
  message: `Unsupported artifact type: ${artifactType}`,
  cause: { filename, canonicalId, artifactType },
  filename,
  canonicalId,
  artifactType,
});

/**
 * Find the builder call within a gql.default() call expression.
 *
 * Matches pattern: gql.default(({ operation }, { $ }) => operation.query(...))
 */
export const findGqlBuilderCall = (call: CallExpression): CallExpression | null => {
  return resolveBuilderCall(call);
};

/**
 * Resolve the builder call from a gql.default() call.
 */
const resolveBuilderCall = (call: CallExpression): CallExpression | null => {
  if (!isExpressionNode(call.callee) || !isGqlMemberExpression(call.callee)) {
    return null;
  }

  if (call.arguments.length !== 1) {
    return null;
  }

  const factoryArg = call.arguments[0];
  if (!factoryArg || factoryArg.expression.type !== "ArrowFunctionExpression") {
    return null;
  }

  return extractBuilderCall(factoryArg.expression);
};

/**
 * Check if a callee is a member expression on gql.
 */
const isGqlMemberExpression = (callee: Expression): callee is MemberExpression => {
  if (callee.type !== "MemberExpression") {
    return false;
  }
  if (!isSimpleProperty(callee.property)) {
    return false;
  }
  if (!isExpressionNode(callee.object)) {
    return false;
  }
  return isGqlReference(callee.object);
};

/**
 * Check if a property is a simple identifier.
 */
const isSimpleProperty = (property: MemberExpression["property"]): property is Identifier => {
  return property.type === "Identifier";
};

/**
 * Check if an expression is a reference to `gql`.
 */
const isGqlReference = (expr: Expression): boolean => {
  if (expr.type === "Identifier" && expr.value === "gql") {
    return true;
  }
  if (expr.type !== "MemberExpression") {
    return false;
  }
  if (expr.property.type === "Computed") {
    return false;
  }
  if (expr.property.type === "Identifier" && expr.property.value === "gql") {
    return true;
  }
  // Check if object is also an Expression before recursing
  if (!isExpressionNode(expr.object)) {
    return false;
  }
  return isGqlReference(expr.object);
};

/**
 * Type guard for Expression nodes.
 */
const isExpressionNode = (node: unknown): node is Expression => {
  return typeof node === "object" && node !== null && "type" in node;
};

/**
 * Extract the builder call from a factory arrow function.
 *
 * Handles:
 * - Arrow function with expression body: ({ operation }) => operation.query(...)
 * - Arrow function with block body: ({ operation }) => { return operation.query(...); }
 */
const extractBuilderCall = (factory: ArrowFunctionExpression): CallExpression | null => {
  // Direct call expression body
  if (factory.body.type === "CallExpression") {
    return factory.body;
  }

  // Block statement body with return
  if (factory.body.type === "BlockStatement") {
    return extractBuilderCallFromBlock(factory.body);
  }

  return null;
};

/**
 * Extract builder call from a block statement.
 */
const extractBuilderCallFromBlock = (block: BlockStatement): CallExpression | null => {
  for (const statement of block.stmts) {
    if (statement.type === "ReturnStatement" && statement.argument && statement.argument.type === "CallExpression") {
      return statement.argument;
    }
  }
  return null;
};
