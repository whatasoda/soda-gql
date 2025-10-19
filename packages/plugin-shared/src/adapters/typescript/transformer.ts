import { formatPluginError } from "@soda-gql/plugin-shared";
import type * as ts from "typescript";
import type { ArtifactLookup, GqlCall } from "./analysis";
import { extractGqlCall, findGqlBuilderCall } from "./analysis";
import type { GqlDefinitionMetadataMap } from "./metadata";
import { buildModelRuntimeCall, buildOperationRuntimeComponents, buildSliceRuntimeCall } from "./runtime";

type TransformCallExpressionArgs = {
  readonly callNode: ts.CallExpression;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly getArtifact: ArtifactLookup;
  readonly factory: ts.NodeFactory;
  readonly typescript: typeof ts;
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
  typescript,
}: TransformCallExpressionArgs): TransformCallExpressionResult => {
  const builderCall = findGqlBuilderCall(callNode, typescript);
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

  return replaceWithRuntimeCall(gqlCall, factory, typescript);
};

const replaceWithRuntimeCall = (
  gqlCall: GqlCall,
  factory: ts.NodeFactory,
  typescript: typeof ts,
): TransformCallExpressionResult => {
  if (gqlCall.type === "model") {
    const replacement = buildModelRuntimeCall(gqlCall, factory, typescript);
    return { transformed: true, replacement };
  }

  if (gqlCall.type === "slice") {
    const replacement = buildSliceRuntimeCall(gqlCall, factory, typescript);
    return { transformed: true, replacement };
  }

  if (gqlCall.type === "operation") {
    const { referenceCall, runtimeCall } = buildOperationRuntimeComponents(gqlCall, factory, typescript);
    return { transformed: true, replacement: referenceCall, runtimeCall };
  }

  return { transformed: false };
};
