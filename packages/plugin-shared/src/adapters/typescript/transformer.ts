import type { CanonicalId } from "@soda-gql/builder";
import * as ts from "typescript";
import type { GqlDefinitionMetadataMap } from "./metadata.js";

// Artifact lookup function type
type ArtifactLookup = (id: CanonicalId) => unknown;

type TransformCallExpressionArgs = {
  readonly callNode: ts.CallExpression;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly getArtifact: ArtifactLookup;
  readonly factory: ts.NodeFactory;
  readonly typescript: typeof ts;
  readonly runtimeAccessor?: ts.Expression;
};

type TransformCallExpressionResult =
  | { readonly transformed: false }
  | { readonly transformed: true; readonly replacement: ts.Expression; readonly runtimeCall?: ts.Expression };

export const transformCallExpression = ({
  callNode,
  typescript,
}: TransformCallExpressionArgs): TransformCallExpressionResult => {
  // Check if this is a gql definition call
  const builderCall = findGqlBuilderCall(callNode, typescript);
  if (!builderCall) {
    return { transformed: false };
  }

  // For now, return a placeholder transformation
  // The actual transformation logic would need to be implemented here
  // based on the builder artifact and metadata
  return { transformed: false };
};

const findGqlBuilderCall = (node: ts.CallExpression, typescript: typeof ts): string | null => {
  if (!typescript.isPropertyAccessExpression(node.expression)) {
    return null;
  }

  const propertyName = typescript.isIdentifier(node.expression.name) ? node.expression.name.text : null;
  if (!propertyName) {
    return null;
  }

  // Check if it's a builder method (default, model, operation, slice, etc.)
  const builderMethods = ["default", "model", "operation", "slice", "query", "mutation", "subscription"];
  if (!builderMethods.includes(propertyName)) {
    return null;
  }

  return propertyName;
};
