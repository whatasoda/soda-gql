import { formatPluginError } from "@soda-gql/plugin-common";
import * as ts from "typescript";
import type { ArtifactLookup, TsGqlCall } from "./analysis";
import { extractGqlCall, findGqlBuilderCall } from "./analysis";
import type { GqlDefinitionMetadataMap } from "./metadata";
import {
  buildComposedOperationRuntimeComponents,
  buildInlineOperationRuntimeComponents,
  buildModelRuntimeCall,
  buildSliceRuntimeCall,
} from "./runtime";

type TransformCallExpressionArgs = {
  readonly callNode: ts.CallExpression;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly getArtifact: ArtifactLookup;
  readonly factory: ts.NodeFactory;
  readonly isCJS: boolean;
};

type TransformCallExpressionResult =
  | { readonly transformed: false }
  | { readonly transformed: true; readonly replacement: ts.Expression; readonly runtimeCall?: ts.Expression };

export const transformCallExpression = ({
  callNode,
  filename,
  metadata,
  getArtifact,
  factory,
  isCJS,
}: TransformCallExpressionArgs): TransformCallExpressionResult => {
  const builderCall = findGqlBuilderCall(callNode, ts);
  if (!builderCall) {
    return { transformed: false };
  }

  const gqlCallResult = extractGqlCall({
    callNode,
    filename,
    metadata,
    builderCall,
    getArtifact,
  });

  if (gqlCallResult.isErr()) {
    throw new Error(formatPluginError(gqlCallResult.error));
  }

  const gqlCall = gqlCallResult.value;

  return replaceWithRuntimeCall({ gqlCall, factory, isCJS });
};

const replaceWithRuntimeCall = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: TsGqlCall;
  factory: ts.NodeFactory;
  isCJS: boolean;
}): TransformCallExpressionResult => {
  if (gqlCall.type === "model") {
    const replacement = buildModelRuntimeCall({ gqlCall, factory, isCJS });
    return { transformed: true, replacement: replacement as ts.Expression };
  }

  if (gqlCall.type === "slice") {
    const replacement = buildSliceRuntimeCall({ gqlCall, factory, isCJS });
    return { transformed: true, replacement };
  }

  if (gqlCall.type === "operation") {
    const { referenceCall, runtimeCall } = buildComposedOperationRuntimeComponents({ gqlCall, factory, isCJS });
    return { transformed: true, replacement: referenceCall, runtimeCall };
  }

  if (gqlCall.type === "inlineOperation") {
    const { referenceCall, runtimeCall } = buildInlineOperationRuntimeComponents({ gqlCall, factory, isCJS });
    return { transformed: true, replacement: referenceCall, runtimeCall };
  }

  return { transformed: false };
};
