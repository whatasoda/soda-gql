import type { RuntimeModelInput, RuntimeOperationInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import type * as ts from "typescript";
import type { GqlCallModel, GqlCallOperation, GqlCallSlice } from "./analysis.js";
import { buildJsonParseExpression, buildObjectExpression, clone } from "./ast.js";

export const buildModelRuntimeCall = (
  { artifact, builderCall }: GqlCallModel,
  factory: ts.NodeFactory,
  typescript: typeof ts,
  runtimeAccessor: ts.Expression = factory.createIdentifier("gqlRuntime"),
): ts.Expression => {
  const [, , normalize] = builderCall.arguments;
  if (!normalize || !typescript.isExpression(normalize)) {
    throw new Error("[INTERNAL] model requires a normalize function");
  }

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(runtimeAccessor, factory.createIdentifier("model")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>(factory, {
          typename: factory.createStringLiteral(artifact.prebuild.typename),
        }),
        runtime: buildObjectExpression<keyof RuntimeModelInput["runtime"]>(factory, {
          normalize: clone(typescript, normalize),
        }),
      }),
    ],
  );
};

export const buildSliceRuntimeCall = (
  { artifact, builderCall }: GqlCallSlice,
  factory: ts.NodeFactory,
  typescript: typeof ts,
  runtimeAccessor: ts.Expression = factory.createIdentifier("gqlRuntime"),
): ts.Expression => {
  const [, , projectionBuilder] = builderCall.arguments;
  if (!projectionBuilder || !typescript.isExpression(projectionBuilder)) {
    throw new Error("[INTERNAL] slice requires a projection builder");
  }

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(runtimeAccessor, factory.createIdentifier("slice")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildObjectExpression<keyof RuntimeSliceInput["prebuild"]>(factory, {
          operationType: factory.createStringLiteral(artifact.prebuild.operationType),
        }),
        runtime: buildObjectExpression<keyof RuntimeSliceInput["runtime"]>(factory, {
          buildProjection: clone(typescript, projectionBuilder),
        }),
      }),
    ],
  );
};

export const buildOperationRuntimeComponents = (
  { artifact, builderCall }: GqlCallOperation,
  factory: ts.NodeFactory,
  typescript: typeof ts,
  runtimeAccessor: ts.Expression = factory.createIdentifier("gqlRuntime"),
) => {
  const [, slicesBuilder] = builderCall.arguments;
  if (!slicesBuilder || !typescript.isExpression(slicesBuilder)) {
    throw new Error("[INTERNAL] operation requires a slices builder");
  }

  const runtimeCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(runtimeAccessor, factory.createIdentifier("operation")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildJsonParseExpression<RuntimeOperationInput["prebuild"]>(factory, artifact.prebuild),
        runtime: buildObjectExpression<keyof RuntimeOperationInput["runtime"]>(factory, {
          getSlices: clone(typescript, slicesBuilder),
        }),
      }),
    ],
  );

  const referenceCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(runtimeAccessor, factory.createIdentifier("getOperation")),
    undefined,
    [factory.createStringLiteral(artifact.prebuild.operationName)],
  );

  return {
    referenceCall,
    runtimeCall,
  };
};
