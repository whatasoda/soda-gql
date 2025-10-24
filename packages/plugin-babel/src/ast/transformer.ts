import type { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { PluginError } from "@soda-gql/plugin-common";
import { err, ok, type Result } from "neverthrow";
import type { ArtifactLookup, BabelGqlCall } from "./analysis";
import { extractGqlCall, findGqlBuilderCall } from "./analysis";
import type { GqlDefinitionMetadataMap } from "./metadata";
import {
  buildComposedOperationRuntimeComponents,
  buildInlineOperationRuntimeComponents,
  buildModelRuntimeCall,
  buildSliceRuntimeCall,
} from "./runtime";

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
}: TransformCallExpressionArgs): Result<TransformCallExpressionResult, PluginError> => {
  const builderCall = findGqlBuilderCall(callPath);
  if (!builderCall) {
    return ok({ transformed: false });
  }

  const gqlCallResult = extractGqlCall({
    nodePath: callPath,
    filename,
    metadata,
    builderCall,
    getArtifact,
  });

  if (gqlCallResult.isErr()) {
    return err(gqlCallResult.error);
  }

  const gqlCall = gqlCallResult.value;

  return replaceWithRuntimeCall(callPath, gqlCall, filename);
};

const replaceWithRuntimeCall = (
  callPath: NodePath<t.CallExpression>,
  gqlCall: BabelGqlCall,
  filename: string,
): Result<TransformCallExpressionResult, PluginError> => {
  if (gqlCall.type === "model") {
    const result = buildModelRuntimeCall({ ...gqlCall, filename });
    if (result.isErr()) {
      return err(result.error);
    }
    callPath.replaceWith(result.value);
    return ok({ transformed: true });
  }

  if (gqlCall.type === "slice") {
    const result = buildSliceRuntimeCall({ ...gqlCall, filename });
    if (result.isErr()) {
      return err(result.error);
    }
    callPath.replaceWith(result.value);
    return ok({ transformed: true });
  }

  if (gqlCall.type === "operation") {
    const result = buildComposedOperationRuntimeComponents({ ...gqlCall, filename });
    if (result.isErr()) {
      return err(result.error);
    }
    const { referenceCall, runtimeCall } = result.value;
    callPath.replaceWith(referenceCall);
    return ok({ transformed: true, runtimeCall });
  }

  if (gqlCall.type === "inlineOperation") {
    const result = buildInlineOperationRuntimeComponents({ ...gqlCall, filename });
    if (result.isErr()) {
      return err(result.error);
    }
    const { referenceCall, runtimeCall } = result.value;
    callPath.replaceWith(referenceCall);
    return ok({ transformed: true, runtimeCall });
  }

  return ok({ transformed: false });
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
