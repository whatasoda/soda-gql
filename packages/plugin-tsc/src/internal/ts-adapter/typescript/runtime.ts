import type { RuntimeModelInput, RuntimeOperationInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import * as ts from "typescript";
import type { GqlCallModel, GqlCallOperation, GqlCallSlice } from "./analysis.js";
import { buildJsonParseExpression, buildObjectExpression, clone } from "./ast.js";

const createRuntimeAccessor = ({ isCJS, factory }: { isCJS: boolean; factory: ts.NodeFactory }) =>
  isCJS
    ? factory.createPropertyAccessExpression(
        factory.createIdentifier("__soda_gql_runtime"),
        factory.createIdentifier("gqlRuntime"),
      )
    : factory.createIdentifier("gqlRuntime");

export const buildModelRuntimeCall = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: GqlCallModel;
  factory: ts.NodeFactory;
  isCJS: boolean;
}): ts.Expression => {
  const [, , normalize] = gqlCall.builderCall.arguments;
  if (!normalize || !ts.isExpression(normalize)) {
    throw new Error("[INTERNAL] model requires a normalize function");
  }

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("model")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>(factory, {
          typename: factory.createStringLiteral(gqlCall.artifact.prebuild.typename),
        }),
        runtime: buildObjectExpression<keyof RuntimeModelInput["runtime"]>(factory, {
          normalize: clone(normalize),
        }),
      }),
    ],
  );
};

export const buildSliceRuntimeCall = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: GqlCallSlice;
  factory: ts.NodeFactory;
  isCJS: boolean;
}): ts.Expression => {
  const [, , projectionBuilder] = gqlCall.builderCall.arguments;
  if (!projectionBuilder || !ts.isExpression(projectionBuilder)) {
    throw new Error("[INTERNAL] slice requires a projection builder");
  }

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("slice")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildObjectExpression<keyof RuntimeSliceInput["prebuild"]>(factory, {
          operationType: factory.createStringLiteral(gqlCall.artifact.prebuild.operationType),
        }),
        runtime: buildObjectExpression<keyof RuntimeSliceInput["runtime"]>(factory, {
          buildProjection: clone(projectionBuilder),
        }),
      }),
    ],
  );
};

export const buildOperationRuntimeComponents = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: GqlCallOperation;
  factory: ts.NodeFactory;
  isCJS: boolean;
}) => {
  const [, slicesBuilder] = gqlCall.builderCall.arguments;
  if (!slicesBuilder || !ts.isExpression(slicesBuilder)) {
    throw new Error("[INTERNAL] operation requires a slices builder");
  }

  const runtimeCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("operation")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildJsonParseExpression<RuntimeOperationInput["prebuild"]>(factory, gqlCall.artifact.prebuild),
        runtime: buildObjectExpression<keyof RuntimeOperationInput["runtime"]>(factory, {
          getSlices: clone(slicesBuilder),
        }),
      }),
    ],
  );

  const referenceCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("getOperation")),
    undefined,
    [factory.createStringLiteral(gqlCall.artifact.prebuild.operationName)],
  );

  return {
    referenceCall,
    runtimeCall,
  };
};
