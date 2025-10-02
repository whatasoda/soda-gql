import { types as t } from "@babel/core";
import type { RuntimeModelInput } from "../../../core/src/runtime/model";
import type { RuntimeOperationInput } from "../../../core/src/runtime/operation";
import type { RuntimeSliceInput } from "../../../core/src/runtime/slice";
import type { GqlCallModel, GqlCallOperation, GqlCallSlice } from "../analysis/gql-call";
import { buildObjectExpression, clone } from "./ast-builders";

export const buildModelRuntimeCall = ({ artifact, builderCall }: GqlCallModel): t.Expression => {
  const [, , normalize] = builderCall.arguments;
  if (!normalize || !t.isExpression(normalize)) {
    throw new Error("gql.model requires a transform");
  }

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")), [
    buildObjectExpression({
      prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>({
        typename: t.stringLiteral(artifact.prebuild.typename),
      }),
      runtime: buildObjectExpression<keyof RuntimeModelInput["runtime"]>({
        normalize: clone(normalize),
      }),
    }),
  ]);
};

export const buildSliceRuntimeCall = ({ artifact, builderCall }: GqlCallSlice): t.Expression => {
  const [, , projectionBuilder] = builderCall.arguments;
  if (!projectionBuilder || !t.isExpression(projectionBuilder)) {
    throw new Error("gql.querySlice requires a projection builder");
  }

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("slice")), [
    buildObjectExpression({
      prebuild: buildObjectExpression<keyof RuntimeSliceInput["prebuild"]>({
        operationType: t.stringLiteral(artifact.prebuild.operationType),
      }),
      runtime: buildObjectExpression<keyof RuntimeSliceInput["runtime"]>({
        buildProjection: clone(projectionBuilder),
      }),
    }),
  ]);
};

export const buildOperationRuntimeComponents = ({ artifact, builderCall }: GqlCallOperation) => {
  const [, slicesBuilder] = builderCall.arguments;
  if (!slicesBuilder || !t.isExpression(slicesBuilder)) {
    throw new Error("gql.query requires a name, variables, and slices builder");
  }

  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("operation")), [
    buildObjectExpression({
      prebuild: t.callExpression(t.memberExpression(t.identifier("JSON"), t.identifier("parse")), [
        t.stringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression<keyof RuntimeOperationInput["runtime"]>({
        getSlices: clone(slicesBuilder),
      }),
    }),
  ]);

  const referenceCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("getOperation")), [
    t.stringLiteral(artifact.prebuild.operationName),
  ]);

  return {
    referenceCall,
    runtimeCall,
  };
};
