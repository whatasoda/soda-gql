import { types as t } from "@babel/core";
import type { PluginError } from "@soda-gql/plugin-common";
import { ok, type Result } from "neverthrow";
import type { BabelGqlCallFragment, BabelGqlCallOperation } from "./analysis";
import { buildObjectExpression } from "./ast";

export const buildFragmentRuntimeCall = ({
  artifact,
}: BabelGqlCallFragment & { filename: string }): Result<t.Expression, PluginError> => {
  const prebuildProps: Record<string, t.Expression> = {
    typename: t.stringLiteral(artifact.prebuild.typename),
  };
  if (artifact.prebuild.key !== undefined) {
    prebuildProps.key = t.stringLiteral(artifact.prebuild.key);
  }

  return ok(
    t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("fragment")), [
      buildObjectExpression({
        prebuild: buildObjectExpression(prebuildProps),
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
