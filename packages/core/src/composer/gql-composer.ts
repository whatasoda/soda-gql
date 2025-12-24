import type { AnyInlineOperation, AnyModel } from "../types/element";
import type { AnyGraphqlSchema } from "../types/schema";
import { createPrefixHelper } from "./field-prefix";
import { createInlineOperationComposerFactory } from "./inline-operation";
import { createGqlModelComposers } from "./model";
import { createVarBuilder } from "./var-builder";

export type GqlElementComposer<TComposers, THelper> = <TResult extends AnyModel | AnyInlineOperation>(
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
  const createInlineOperationComposer = createInlineOperationComposerFactory<TSchema>(schema);
  const composers = {
    model,
    query: {
      inline: createInlineOperationComposer("query"),
    },
    mutation: {
      inline: createInlineOperationComposer("mutation"),
    },
    subscription: {
      inline: createInlineOperationComposer("subscription"),
    },
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
