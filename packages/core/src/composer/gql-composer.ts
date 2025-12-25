import type { AnyModel, AnyOperation } from "../types/element";
import type { AnyGraphqlSchema } from "../types/schema";
import { createPrefixHelper } from "./field-prefix";
import { createGqlModelComposers } from "./model";
import { createOperationComposerFactory } from "./operation";
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

  // Wrap operation composers in objects with an `operation` method for extensibility
  // This allows adding more factories (e.g., query.subscription, query.fragment) in the future
  const composers = {
    model,
    query: { operation: createOperationComposer("query") },
    mutation: { operation: createOperationComposer("mutation") },
    subscription: { operation: createOperationComposer("subscription") },
  };

  const helper = {
    $var: createVarBuilder(schema),
    $prefix: createPrefixHelper(),
    ...(helpers ?? ({} as THelpers)),
  };

  const elementComposer: GqlElementComposer<typeof composers, typeof helper> = (composeElement) =>
    composeElement(composers, helper);

  return elementComposer;
};
