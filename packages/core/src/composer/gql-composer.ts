import type { AnyModel, AnyOperation } from "../types/element";
import type { AnyGraphqlSchema } from "../types/schema";
import { createPrefixHelper } from "./field-prefix";
import { createOperationComposerFactory } from "./operation";
import { createGqlModelComposers } from "./model";
import { createVarBuilder } from "./var-builder";

export type GqlElementComposer<TComposers, THelper> = <TResult extends AnyModel | AnyOperation>(
  composeElement: (composers: TComposers, helper: THelper) => TResult,
) => TResult;

export type GqlElementComposerOptions<THelpers extends object = object> = {
  helpers?: THelpers;
};

export const createGqlElementComposer = <TSchema extends AnyGraphqlSchema, THelpers extends object = object>(
  schema: NoInfer<TSchema>,
  options: GqlElementComposerOptions<NoInfer<THelpers>> = {} as GqlElementComposerOptions<THelpers>,
) => {
  const { helpers } = options;
  const model = createGqlModelComposers<TSchema>(schema);
  const createOperationComposer = createOperationComposerFactory<TSchema>(schema);
  const composers = {
    model,
    query: createOperationComposer("query"),
    mutation: createOperationComposer("mutation"),
    subscription: createOperationComposer("subscription"),
  };

  const helper = {
    ...createVarBuilder(schema),
    $prefix: createPrefixHelper(),
    ...(helpers ?? ({} as THelpers)),
  };

  const elementComposer: GqlElementComposer<typeof composers, typeof helper> = (composeElement) =>
    composeElement(composers, helper);

  return elementComposer;
};
