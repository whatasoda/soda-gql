import { types as t } from "@babel/core";
import type { RuntimeComposedOperationInput, RuntimeModelInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import type { GqlCallInlineOperation, GqlCallModel, GqlCallOperation, GqlCallSlice } from "./analysis";
import { buildObjectExpression, clone } from "./ast";

export const buildModelRuntimeCall = ({ artifact, builderCall }: GqlCallModel): t.Expression => {
  const [, , normalize] = builderCall.arguments;
  if (!normalize || !t.isExpression(normalize)) {
    throw new Error("[INTERNAL] model requires a normalize function");
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
    throw new Error("[INTERNAL] slice requires a projection builder");
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

export const buildComposedOperationRuntimeComponents = ({ artifact, builderCall }: GqlCallOperation) => {
  const [, slicesBuilder] = builderCall.arguments;
  if (!slicesBuilder || !t.isExpression(slicesBuilder)) {
    throw new Error("[INTERNAL] composed operation requires a slices builder");
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

  return {
    referenceCall,
    runtimeCall,
  };
};

export const buildInlineOperationRuntimeComponents = ({ artifact, builderCall: _ }: GqlCallInlineOperation) => {
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

  return {
    referenceCall,
    runtimeCall,
  };
};
