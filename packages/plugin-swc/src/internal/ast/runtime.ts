/**
 * Runtime call generation for SWC transformations.
 *
 * Builds gqlRuntime.model(), gqlRuntime.slice(), gqlRuntime.operation(), etc.
 * from artifact data and builder arguments.
 */

import type { RuntimeComposedOperationInput, RuntimeModelInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import type { PluginError, PluginTransformMissingBuilderArgError } from "@soda-gql/plugin-common";
import type { Expression } from "@swc/types";
import { err, ok, type Result } from "neverthrow";
import type { SwcGqlCallInlineOperation, SwcGqlCallModel, SwcGqlCallOperation, SwcGqlCallSlice } from "./analysis";
import {
  buildObjectExpression,
  clone,
  createCallExpression,
  createIdentifier,
  createMemberExpression,
  createStringLiteral,
} from "./ast";

/**
 * Create a missing builder argument error.
 */
const createMissingBuilderArgError = ({
  filename,
  builderType,
  argName,
}: {
  filename: string;
  builderType: string;
  argName: string;
}): PluginTransformMissingBuilderArgError => ({
  type: "PluginError",
  stage: "transform",
  code: "SODA_GQL_TRANSFORM_MISSING_BUILDER_ARG",
  message: `${builderType} requires a ${argName} argument`,
  cause: { filename, builderType, argName },
  filename,
  builderType,
  argName,
});

/**
 * Build runtime call for model.
 *
 * Generates: gqlRuntime.model({ prebuild: { typename: "..." }, runtime: { normalize: ... } })
 */
export const buildModelRuntimeCall = ({
  artifact,
  builderCall,
  filename,
}: SwcGqlCallModel & { filename: string }): Result<Expression, PluginError> => {
  const [, , normalize] = builderCall.arguments;
  if (!normalize || !isExpression(normalize.expression)) {
    return err(createMissingBuilderArgError({ filename, builderType: "model", argName: "normalize" }));
  }

  return ok(
    createCallExpression(createMemberExpression(createIdentifier("gqlRuntime"), "model"), [
      buildObjectExpression({
        prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>({
          typename: createStringLiteral(artifact.prebuild.typename),
        }),
        runtime: buildObjectExpression<keyof RuntimeModelInput["runtime"]>({
          normalize: clone(normalize.expression),
        }),
      }),
    ]),
  );
};

/**
 * Build runtime call for slice.
 *
 * Generates: gqlRuntime.slice({ prebuild: { operationType: "..." }, runtime: { buildProjection: ... } })
 */
export const buildSliceRuntimeCall = ({
  artifact,
  builderCall,
  filename,
}: SwcGqlCallSlice & { filename: string }): Result<Expression, PluginError> => {
  const [, , projectionBuilder] = builderCall.arguments;
  if (!projectionBuilder || !isExpression(projectionBuilder.expression)) {
    return err(createMissingBuilderArgError({ filename, builderType: "slice", argName: "projectionBuilder" }));
  }

  return ok(
    createCallExpression(createMemberExpression(createIdentifier("gqlRuntime"), "slice"), [
      buildObjectExpression({
        prebuild: buildObjectExpression<keyof RuntimeSliceInput["prebuild"]>({
          operationType: createStringLiteral(artifact.prebuild.operationType),
        }),
        runtime: buildObjectExpression<keyof RuntimeSliceInput["runtime"]>({
          buildProjection: clone(projectionBuilder.expression),
        }),
      }),
    ]),
  );
};

/**
 * Build runtime components for composed operation.
 *
 * Generates:
 * - runtimeCall: gqlRuntime.composedOperation({ prebuild: ..., runtime: { getSlices: ... } })
 * - referenceCall: gqlRuntime.getComposedOperation("operationName")
 */
export const buildComposedOperationRuntimeComponents = ({
  artifact,
  builderCall,
  filename,
}: SwcGqlCallOperation & { filename: string }): Result<{ referenceCall: Expression; runtimeCall: Expression }, PluginError> => {
  const [, slicesBuilder] = builderCall.arguments;
  if (!slicesBuilder || !isExpression(slicesBuilder.expression)) {
    return err(createMissingBuilderArgError({ filename, builderType: "composed operation", argName: "slicesBuilder" }));
  }

  const runtimeCall = createCallExpression(createMemberExpression(createIdentifier("gqlRuntime"), "composedOperation"), [
    buildObjectExpression({
      prebuild: createCallExpression(createMemberExpression(createIdentifier("JSON"), "parse"), [
        createStringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression<keyof RuntimeComposedOperationInput["runtime"]>({
        getSlices: clone(slicesBuilder.expression),
      }),
    }),
  ]);

  const referenceCall = createCallExpression(createMemberExpression(createIdentifier("gqlRuntime"), "getComposedOperation"), [
    createStringLiteral(artifact.prebuild.operationName),
  ]);

  return ok({ referenceCall, runtimeCall });
};

/**
 * Build runtime components for inline operation.
 *
 * Generates:
 * - runtimeCall: gqlRuntime.inlineOperation({ prebuild: ..., runtime: { buildProjection: ... } })
 * - referenceCall: gqlRuntime.getInlineOperation("operationName")
 */
export const buildInlineOperationRuntimeComponents = ({
  artifact,
  builderCall,
  filename,
}: SwcGqlCallInlineOperation & { filename: string }): Result<
  { referenceCall: Expression; runtimeCall: Expression },
  PluginError
> => {
  const [, , projectionBuilder] = builderCall.arguments;
  if (!projectionBuilder || !isExpression(projectionBuilder.expression)) {
    return err(createMissingBuilderArgError({ filename, builderType: "inline operation", argName: "projectionBuilder" }));
  }

  const runtimeCall = createCallExpression(createMemberExpression(createIdentifier("gqlRuntime"), "inlineOperation"), [
    buildObjectExpression({
      prebuild: createCallExpression(createMemberExpression(createIdentifier("JSON"), "parse"), [
        createStringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression({
        buildProjection: clone(projectionBuilder.expression),
      }),
    }),
  ]);

  const referenceCall = createCallExpression(createMemberExpression(createIdentifier("gqlRuntime"), "getInlineOperation"), [
    createStringLiteral(artifact.prebuild.operationName),
  ]);

  return ok({ referenceCall, runtimeCall });
};

/**
 * Type guard for Expression.
 */
const isExpression = (node: unknown): node is Expression => {
  return typeof node === "object" && node !== null && "type" in node;
};
