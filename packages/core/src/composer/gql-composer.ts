import type { AnyComposedOperation, AnyInlineOperation, AnyModel, AnySlice } from "../types/element";
import type { AnyMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema } from "../types/schema";
import { createComposedOperationComposerFactory } from "./composed-operation";
import { createInlineOperationComposerFactory } from "./inline-operation";
import { createGqlModelComposers } from "./model";
import { createSliceComposerFactory } from "./slice";
import { createVarBuilder } from "./var-builder";

export type GqlElementComposer<TComposers, THelper> = <
  TResult extends AnyModel | AnySlice | AnyComposedOperation | AnyInlineOperation,
>(
  composeElement: (composers: TComposers, helper: THelper) => TResult,
) => TResult;

export type GqlElementComposerOptions = {
  metadataAdapter?: AnyMetadataAdapter;
};

export const createGqlElementComposer = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  schema: NoInfer<TSchema>,
  options: GqlElementComposerOptions = {},
) => {
  const { metadataAdapter } = options;
  const model = createGqlModelComposers<TSchema>(schema);
  const createSliceComposer = createSliceComposerFactory<TSchema, TRuntimeAdapter>(schema);
  const createComposedOperationFactory = createComposedOperationComposerFactory<TSchema, TRuntimeAdapter>({
    metadataAdapter,
  });
  const createInlineOperationComposer = createInlineOperationComposerFactory<TSchema, TRuntimeAdapter>(schema);
  const composers = {
    model,
    query: {
      slice: createSliceComposer("query"),
      composed: createComposedOperationFactory("query"),
      inline: createInlineOperationComposer("query"),
    },
    mutation: {
      slice: createSliceComposer("mutation"),
      composed: createComposedOperationFactory("mutation"),
      inline: createInlineOperationComposer("mutation"),
    },
    subscription: {
      slice: createSliceComposer("subscription"),
      composed: createComposedOperationFactory("subscription"),
      inline: createInlineOperationComposer("subscription"),
    },
  };

  const helper = {
    ...createVarBuilder(schema),
  };

  const elementComposer: GqlElementComposer<typeof composers, typeof helper> = (composeElement) =>
    composeElement(composers, helper);

  return elementComposer;
};
