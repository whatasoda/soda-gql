import type { PluginError } from "@soda-gql/builder/plugin";
import type { RuntimeOperationInput } from "@soda-gql/core/runtime";
import { ok, type Result } from "neverthrow";
import type * as ts from "typescript";
import type { TsGqlCallFragment, TsGqlCallOperation } from "./analysis";
import { buildJsonParseExpression, buildObjectExpression } from "./ast";

const createRuntimeAccessor = ({ isCJS, factory }: { isCJS: boolean; factory: ts.NodeFactory }) =>
  isCJS
    ? factory.createPropertyAccessExpression(
        factory.createIdentifier("__soda_gql_runtime"),
        factory.createIdentifier("gqlRuntime"),
      )
    : factory.createIdentifier("gqlRuntime");

export const buildFragmentRuntimeCall = ({
  gqlCall,
  factory,
  isCJS,
}: {
  gqlCall: TsGqlCallFragment;
  factory: ts.NodeFactory;
  isCJS: boolean;
  filename: string;
}): Result<ts.Expression, PluginError> => {
  const prebuildProps: Record<string, ts.Expression> = {
    typename: factory.createStringLiteral(gqlCall.artifact.prebuild.typename),
  };
  if (gqlCall.artifact.prebuild.key !== undefined) {
    prebuildProps.key = factory.createStringLiteral(gqlCall.artifact.prebuild.key);
  }

  return ok(
    factory.createCallExpression(
      factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("fragment")),
      undefined,
      [
        buildObjectExpression(factory, {
          prebuild: buildObjectExpression(factory, prebuildProps),
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
    factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("operation")),
    undefined,
    [
      buildObjectExpression(factory, {
        prebuild: buildJsonParseExpression<RuntimeOperationInput["prebuild"]>(factory, gqlCall.artifact.prebuild),
        runtime: buildObjectExpression(factory, {}),
      }),
    ],
  );

  const referenceCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(createRuntimeAccessor({ isCJS, factory }), factory.createIdentifier("getOperation")),
    undefined,
    [factory.createStringLiteral(gqlCall.artifact.prebuild.operationName)],
  );

  return ok({
    referenceCall,
    runtimeCall,
  });
};
