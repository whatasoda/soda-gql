import { types as t } from "@babel/core";
import type { RuntimeOperationInput, RuntimeModelInput } from "@soda-gql/core/runtime";
import type { PluginError } from "@soda-gql/plugin-common";
import { ok, type Result } from "neverthrow";
import type { BabelGqlCallOperation, BabelGqlCallModel } from "./analysis";
import { buildObjectExpression } from "./ast";

export const buildModelRuntimeCall = ({
  artifact,
}: BabelGqlCallModel & { filename: string }): Result<t.Expression, PluginError> => {
  return ok(
    t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")), [
      buildObjectExpression({
        prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>({
          typename: t.stringLiteral(artifact.prebuild.typename),
          metadata: t.identifier("undefined"),
        }),
      }),
    ]),
  );
};

export const buildOperationRuntimeComponents = ({
  artifact,
}: BabelGqlCallOperation & { filename: string }): Result<
  { referenceCall: t.Expression; runtimeCall: t.Expression },
  PluginError
> => {
  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("operation")), [
    buildObjectExpression({
      prebuild: t.callExpression(t.memberExpression(t.identifier("JSON"), t.identifier("parse")), [
        t.stringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression({}),
    }),
  ]);

  const referenceCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("getOperation")), [
    t.stringLiteral(artifact.prebuild.operationName),
  ]);

  return ok({
    referenceCall,
    runtimeCall,
  });
};

// Re-export old name for backwards compatibility during transition
/** @deprecated Use `buildOperationRuntimeComponents` instead */
export const buildInlineOperationRuntimeComponents = buildOperationRuntimeComponents;
