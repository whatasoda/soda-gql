import type { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { ArtifactLookup, GqlCall } from "../analysis/gql-call";
import { extractGqlCall, findGqlBuilderCall } from "../analysis/gql-call";
import type { GqlDefinitionMetadataMap } from "../metadata/collector";
import { buildModelRuntimeCall, buildOperationRuntimeComponents, buildSliceRuntimeCall } from "./runtime-builders";

type TransformCallExpressionArgs = {
  readonly callPath: NodePath<t.CallExpression>;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly getArtifact: ArtifactLookup;
};

type TransformCallExpressionResult =
  | { readonly transformed: false }
  | { readonly transformed: true; readonly runtimeCall?: t.Expression };

export const transformCallExpression = ({
  callPath,
  filename,
  metadata,
  getArtifact,
}: TransformCallExpressionArgs): TransformCallExpressionResult => {
  const builderCall = findGqlBuilderCall(callPath);
  if (!builderCall) {
    return { transformed: false };
  }

  const gqlCallResult = extractGqlCall({
    nodePath: callPath,
    filename,
    metadata,
    builderCall,
    getArtifact,
  });

  if (gqlCallResult.isErr()) {
    throw new Error(gqlCallResult.error.message);
  }

  const gqlCall = gqlCallResult.value;

  return replaceWithRuntimeCall(callPath, gqlCall);
};

const replaceWithRuntimeCall = (callPath: NodePath<t.CallExpression>, gqlCall: GqlCall): TransformCallExpressionResult => {
  if (gqlCall.type === "model") {
    const replacement = buildModelRuntimeCall(gqlCall);
    callPath.replaceWith(replacement);
    return { transformed: true };
  }

  if (gqlCall.type === "slice") {
    const replacement = buildSliceRuntimeCall(gqlCall);
    callPath.replaceWith(replacement);
    return { transformed: true };
  }

  if (gqlCall.type === "operation") {
    const { referenceCall, runtimeCall } = buildOperationRuntimeComponents(gqlCall);
    callPath.replaceWith(referenceCall);
    return { transformed: true, runtimeCall };
  }

  return { transformed: false };
};

export const insertRuntimeCalls = (programPath: NodePath<t.Program>, runtimeCalls: readonly t.Expression[]): void => {
  if (runtimeCalls.length === 0) {
    return;
  }

  programPath.traverse({
    ImportDeclaration(importDeclPath) {
      if (importDeclPath.node.source.value === "@soda-gql/runtime") {
        importDeclPath.insertAfter([...runtimeCalls]);
      }
    },
  });
};
