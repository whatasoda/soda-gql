import type { PluginError } from "@soda-gql/builder/plugin";
import { err, ok, type Result } from "neverthrow";
import type * as ts from "typescript";
import type { ArtifactLookup, TsGqlCall } from "./analysis";
import { extractGqlCall } from "./analysis";
import type { GqlDefinitionMetadataMap } from "./metadata";
import { buildFragmentRuntimeCall, buildOperationRuntimeComponents } from "./runtime";

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
}: TransformCallExpressionArgs): Result<TransformCallExpressionResult, PluginError> => {
  // Skip if this call doesn't have GQL metadata
  if (!metadata.has(callNode)) {
    return ok({ transformed: false });
  }

  const gqlCallResult = extractGqlCall({
    callNode,
    filename,
    metadata,
    getArtifact,
  });

  if (gqlCallResult.isErr()) {
    return err(gqlCallResult.error);
  }

  const gqlCall = gqlCallResult.value;

  return replaceWithRuntimeCall({ gqlCall, factory, isCJS, filename });
};

const replaceWithRuntimeCall = ({
  gqlCall,
  factory,
  isCJS,
  filename,
}: {
  gqlCall: TsGqlCall;
  factory: ts.NodeFactory;
  isCJS: boolean;
  filename: string;
}): Result<TransformCallExpressionResult, PluginError> => {
  if (gqlCall.type === "fragment") {
    const result = buildFragmentRuntimeCall({ gqlCall, factory, isCJS, filename });
    if (result.isErr()) {
      return err(result.error);
    }
    return ok({ transformed: true, replacement: result.value as ts.Expression });
  }

  if (gqlCall.type === "operation") {
    const result = buildOperationRuntimeComponents({ gqlCall, factory, isCJS });
    if (result.isErr()) {
      return err(result.error);
    }
    const { referenceCall, runtimeCall } = result.value;
    return ok({ transformed: true, replacement: referenceCall, runtimeCall });
  }

  return ok({ transformed: false });
};
