import type { RuntimeOperationInput, RuntimeModelInput } from "@soda-gql/core/runtime";
import type { PluginError } from "@soda-gql/plugin-common";
import { ok, type Result } from "neverthrow";
import * as ts from "typescript";
import type { TsGqlCallOperation, TsGqlCallModel } from "./analysis";
import { buildJsonParseExpression, buildObjectExpression } from "./ast";

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
  gqlCall: TsGqlCallModel;
  factory: ts.NodeFactory;
  isCJS: boolean;
  filename: string;
}): Result<ts.Expression, PluginError> => {
  return ok(
    factory.createCallExpression(
      factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("model")),
      undefined,
      [
        buildObjectExpression(factory, {
          prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>(factory, {
            typename: factory.createStringLiteral(gqlCall.artifact.prebuild.typename),
          }),
        }),
      ],
    ),
  );
};

export const buildOperationRuntimeComponents = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: TsGqlCallOperation;
  factory: ts.NodeFactory;
  isCJS: boolean;
}): Result<{ referenceCall: ts.Expression; runtimeCall: ts.Expression }, PluginError> => {
  const runtimeCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      createRuntimeAccessor({ isCJS, factory }),
      factory.createIdentifier("operation"),
    ),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildJsonParseExpression<RuntimeOperationInput["prebuild"]>(factory, gqlCall.artifact.prebuild),
        runtime: buildObjectExpression(factory, {}),
      }),
    ],
  );

  const referenceCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      createRuntimeAccessor({ isCJS, factory }),
      factory.createIdentifier("getOperation"),
    ),
    undefined,
    [factory.createStringLiteral(gqlCall.artifact.prebuild.operationName)],
  );

  return ok({
    referenceCall,
    runtimeCall,
  });
};

// Re-export old name for backwards compatibility during transition
/** @deprecated Use `buildOperationRuntimeComponents` instead */
export const buildInlineOperationRuntimeComponents = buildOperationRuntimeComponents;
