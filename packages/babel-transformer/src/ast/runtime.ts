import { types as t } from "@babel/core";
import type { RuntimeComposedOperationInput, RuntimeModelInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import type { PluginError, PluginTransformMissingBuilderArgError } from "@soda-gql/plugin-common";
import { err, ok, type Result } from "neverthrow";
import type { BabelGqlCallInlineOperation, BabelGqlCallModel, BabelGqlCallOperation, BabelGqlCallSlice } from "./analysis";
import { buildObjectExpression, clone } from "./ast";

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

export const buildModelRuntimeCall = ({
  artifact,
}: BabelGqlCallModel & { filename: string }): Result<t.Expression, PluginError> => {
  return ok(
    t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")), [
      buildObjectExpression({
        prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>({
          typename: t.stringLiteral(artifact.prebuild.typename),
        }),
      }),
    ]),
  );
};

export const buildSliceRuntimeCall = ({
  artifact,
  builderCall,
  filename,
}: BabelGqlCallSlice & { filename: string }): Result<t.Expression, PluginError> => {
  const [, , projectionBuilder] = builderCall.arguments;
  if (!projectionBuilder || !t.isExpression(projectionBuilder)) {
    return err(createMissingBuilderArgError({ filename, builderType: "slice", argName: "projectionBuilder" }));
  }

  return ok(
    t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("slice")), [
      buildObjectExpression({
        prebuild: buildObjectExpression<keyof RuntimeSliceInput["prebuild"]>({
          operationType: t.stringLiteral(artifact.prebuild.operationType),
        }),
        runtime: buildObjectExpression<keyof RuntimeSliceInput["runtime"]>({
          buildProjection: clone(projectionBuilder),
        }),
      }),
    ]),
  );
};

export const buildComposedOperationRuntimeComponents = ({
  artifact,
  builderCall,
  filename,
}: BabelGqlCallOperation & { filename: string }): Result<
  { referenceCall: t.Expression; runtimeCall: t.Expression },
  PluginError
> => {
  const [, slicesBuilder] = builderCall.arguments;
  if (!slicesBuilder || !t.isExpression(slicesBuilder)) {
    return err(createMissingBuilderArgError({ filename, builderType: "composed operation", argName: "slicesBuilder" }));
  }

  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("composedOperation")), [
    buildObjectExpression({
      prebuild: t.callExpression(t.memberExpression(t.identifier("JSON"), t.identifier("parse")), [
        t.stringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression<keyof RuntimeComposedOperationInput["runtime"]>({
        getSlices: clone(slicesBuilder),
      }),
    }),
  ]);

  const referenceCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("getComposedOperation")), [
    t.stringLiteral(artifact.prebuild.operationName),
  ]);

  return ok({
    referenceCall,
    runtimeCall,
  });
};

export const buildInlineOperationRuntimeComponents = ({
  artifact,
}: BabelGqlCallInlineOperation & { filename: string }): Result<
  { referenceCall: t.Expression; runtimeCall: t.Expression },
  PluginError
> => {
  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("inlineOperation")), [
    buildObjectExpression({
      prebuild: t.callExpression(t.memberExpression(t.identifier("JSON"), t.identifier("parse")), [
        t.stringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression({}),
    }),
  ]);

  const referenceCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("getInlineOperation")), [
    t.stringLiteral(artifact.prebuild.operationName),
  ]);

  return ok({
    referenceCall,
    runtimeCall,
  });
};
