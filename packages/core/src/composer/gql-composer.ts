import type { AnyComposedOperation, AnyInlineOperation, AnyModel, AnySlice } from "../types/element";
import type { AdapterByKey, SchemaByKey, SodaGqlSchemaRegistry } from "../types/registry";
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

export const createGqlElementComposer = <TSchemaKey extends keyof SodaGqlSchemaRegistry>(
  schema: NoInfer<SchemaByKey<TSchemaKey>>,
) => {
  type TRuntimeAdapter = AdapterByKey<TSchemaKey>;

  const model = createGqlModelComposers<TSchemaKey>(schema);
  const createSliceComposer = createSliceComposerFactory<TSchemaKey, TRuntimeAdapter>(schema);
  const createComposedOperationFactory = createComposedOperationComposerFactory<TSchemaKey, TRuntimeAdapter>();
  const createInlineOperationComposer = createInlineOperationComposerFactory<TSchemaKey, TRuntimeAdapter>(schema);
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
