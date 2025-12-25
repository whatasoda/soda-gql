import type { AnyModel, AnyOperation } from "../types/element";
import type { AnyFlexibleMetadataAdapter, DefaultFlexibleMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import { createPrefixHelper } from "./field-prefix";
import { createGqlModelComposers } from "./model";
import { createOperationComposerFactory } from "./operation";
import { createVarBuilder } from "./var-builder";

export type GqlElementComposer<TComposers, THelper> = <TResult extends AnyModel | AnyOperation>(
  composeElement: (composers: TComposers, helper: THelper) => TResult,
) => TResult;

export type GqlElementComposerOptions<
  THelpers extends object = object,
  TAdapter extends AnyFlexibleMetadataAdapter = DefaultFlexibleMetadataAdapter,
> = {
  helpers?: THelpers;
  adapter?: TAdapter;
};

export const createGqlElementComposer = <
  TSchema extends AnyGraphqlSchema,
  THelpers extends object = object,
  TAdapter extends AnyFlexibleMetadataAdapter = DefaultFlexibleMetadataAdapter,
>(
  schema: NoInfer<TSchema>,
  options: GqlElementComposerOptions<NoInfer<THelpers>, NoInfer<TAdapter>> = {} as GqlElementComposerOptions<THelpers, TAdapter>,
) => {
  const { helpers, adapter } = options;
  const model = createGqlModelComposers<TSchema, TAdapter>(schema, adapter);
  const createOperationComposer = createOperationComposerFactory<TSchema, TAdapter>(schema, adapter);

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
