import { types as t } from "@babel/core";
import type { RuntimeInlineOperationInput, RuntimeModelInput } from "@soda-gql/core/runtime";
import type { PluginError } from "@soda-gql/plugin-common";
import { ok, type Result } from "neverthrow";
import type { BabelGqlCallInlineOperation, BabelGqlCallModel } from "./analysis";
import { buildObjectExpression } from "./ast";

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
