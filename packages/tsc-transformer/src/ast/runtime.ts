import type {
  RuntimeComposedOperationInput,
  RuntimeInlineOperationInput,
  RuntimeModelInput,
  RuntimeSliceInput,
} from "@soda-gql/core/runtime";
import type { PluginError, PluginTransformMissingBuilderArgError } from "@soda-gql/plugin-common";
import { err, ok, type Result } from "neverthrow";
import * as ts from "typescript";
import type { TsGqlCallInlineOperation, TsGqlCallModel, TsGqlCallOperation, TsGqlCallSlice } from "./analysis";
import { buildJsonParseExpression, buildObjectExpression, clone } from "./ast";

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
  filename,
}: {
  gqlCall: TsGqlCallModel;
  factory: ts.NodeFactory;
  isCJS: boolean;
  filename: string;
}): Result<ts.Expression, PluginError> => {
  const [, , normalize] = gqlCall.builderCall.arguments;
  if (!normalize || !ts.isExpression(normalize)) {
    return err(createMissingBuilderArgError({ filename, builderType: "model", argName: "normalize" }));
  }

  return ok(
    factory.createCallExpression(
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
    ),
  );
};

export const buildSliceRuntimeCall = ({
  gqlCall,
  factory,
  isCJS,
  filename,
}: {
  gqlCall: TsGqlCallSlice;
  factory: ts.NodeFactory;
  isCJS: boolean;
  filename: string;
}): Result<ts.Expression, PluginError> => {
  const [, , projectionBuilder] = gqlCall.builderCall.arguments;
  if (!projectionBuilder || !ts.isExpression(projectionBuilder)) {
    return err(createMissingBuilderArgError({ filename, builderType: "slice", argName: "projectionBuilder" }));
  }

  return ok(
    factory.createCallExpression(
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
    ),
  );
};

export const buildComposedOperationRuntimeComponents = ({
  gqlCall,
  factory,
  isCJS,
  filename,
}: {
  gqlCall: TsGqlCallOperation;
  factory: ts.NodeFactory;
  isCJS: boolean;
  filename: string;
}): Result<{ referenceCall: ts.Expression; runtimeCall: ts.Expression }, PluginError> => {
  const [, slicesBuilder] = gqlCall.builderCall.arguments;
  if (!slicesBuilder || !ts.isExpression(slicesBuilder)) {
    return err(createMissingBuilderArgError({ filename, builderType: "composed operation", argName: "slicesBuilder" }));
  }

  const runtimeCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      createRuntimeAccessor({ isCJS, factory }),
      factory.createIdentifier("composedOperation"),
    ),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildJsonParseExpression<RuntimeComposedOperationInput["prebuild"]>(factory, gqlCall.artifact.prebuild),
        runtime: buildObjectExpression<keyof RuntimeComposedOperationInput["runtime"]>(factory, {
          getSlices: clone(slicesBuilder),
        }),
      }),
    ],
  );

  const referenceCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      createRuntimeAccessor({ isCJS, factory }),
      factory.createIdentifier("getComposedOperation"),
    ),
    undefined,
    [factory.createStringLiteral(gqlCall.artifact.prebuild.operationName)],
  );

  return ok({
    referenceCall,
    runtimeCall,
  });
};

export const buildInlineOperationRuntimeComponents = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: TsGqlCallInlineOperation;
  factory: ts.NodeFactory;
  isCJS: boolean;
}): Result<{ referenceCall: ts.Expression; runtimeCall: ts.Expression }, PluginError> => {
  const runtimeCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      createRuntimeAccessor({ isCJS, factory }),
      factory.createIdentifier("inlineOperation"),
    ),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildJsonParseExpression<RuntimeInlineOperationInput["prebuild"]>(factory, gqlCall.artifact.prebuild),
        runtime: buildObjectExpression(factory, {}),
      }),
    ],
  );

  const referenceCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      createRuntimeAccessor({ isCJS, factory }),
      factory.createIdentifier("getInlineOperation"),
    ),
    undefined,
    [factory.createStringLiteral(gqlCall.artifact.prebuild.operationName)],
  );

  return ok({
    referenceCall,
    runtimeCall,
  });
};
