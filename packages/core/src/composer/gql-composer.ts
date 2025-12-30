import type { AnyFragment, AnyOperation } from "../types/element";
import type { Adapter, AnyAdapter, AnyMetadataAdapter, DefaultAdapter, DefaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import { createColocateHelper } from "./colocate";
import { createGqlFragmentComposers, type FragmentBuilderFor } from "./fragment";
import { createOperationComposerFactory } from "./operation";
import { createVarBuilder, type InputTypeMethods } from "./var-builder";

export type GqlElementComposer<TContext> = <TResult extends AnyFragment | AnyOperation>(
  composeElement: (context: TContext) => TResult,
) => TResult;

/**
 * Extracts the helpers type from an adapter.
 */
type ExtractHelpers<TAdapter extends AnyAdapter> = TAdapter extends Adapter<infer THelpers, unknown, unknown, unknown>
  ? THelpers
  : object;

/**
 * Extracts the metadata adapter type from an adapter.
 * Handles optional metadata property correctly.
 */
export type ExtractMetadataAdapter<TAdapter extends AnyAdapter> = TAdapter extends { metadata?: infer M }
  ? NonNullable<M> extends AnyMetadataAdapter
    ? NonNullable<M>
    : DefaultMetadataAdapter
  : DefaultMetadataAdapter;

/**
 * Default fragment builders type computed from schema.
 * This is the mapped type that's expensive to compute for large schemas.
 */
export type FragmentBuildersAll<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter,
> = {
  readonly [TTypeName in keyof TSchema["object"]]: TTypeName extends string
    ? FragmentBuilderFor<TSchema, TTypeName, TAdapter>
    : never;
};

export type GqlElementComposerOptions<TSchema extends AnyGraphqlSchema, TAdapter extends AnyAdapter = DefaultAdapter> = {
  adapter?: TAdapter;
  inputTypeMethods: InputTypeMethods<TSchema>;
};

/**
 * Creates a GQL element composer for a given schema.
 *
 * @typeParam TSchema - The GraphQL schema type
 * @typeParam TAdapter - The adapter type (optional)
 * @typeParam TFragmentBuilders - Pre-computed fragment builders type (optional, for codegen optimization)
 */
export const createGqlElementComposer = <
  TSchema extends AnyGraphqlSchema,
  TFragmentBuilders,
  TAdapter extends AnyAdapter = DefaultAdapter,
>(
  schema: NoInfer<TSchema>,
  options: GqlElementComposerOptions<NoInfer<TSchema>, NoInfer<TAdapter>>,
) => {
  type THelpers = ExtractHelpers<TAdapter>;
  type TMetadataAdapter = ExtractMetadataAdapter<TAdapter>;
  const { adapter, inputTypeMethods } = options;
  const helpers = adapter?.helpers as THelpers | undefined;
  const metadataAdapter = adapter?.metadata as TMetadataAdapter | undefined;
  const fragment = createGqlFragmentComposers<TSchema, TMetadataAdapter>(schema, metadataAdapter) as TFragmentBuilders;
  const createOperationComposer = createOperationComposerFactory<TSchema, TMetadataAdapter>(schema, metadataAdapter);

  // Wrap operation composers in objects with an `operation` method for extensibility
  // This allows adding more factories (e.g., query.subscription, query.fragment) in the future
  const context = {
    fragment,
    query: { operation: createOperationComposer("query") },
    mutation: { operation: createOperationComposer("mutation") },
    subscription: { operation: createOperationComposer("subscription") },
    $var: createVarBuilder<TSchema>(inputTypeMethods),
    $colocate: createColocateHelper(),
    ...(helpers ?? ({} as THelpers)),
  };

  const elementComposer: GqlElementComposer<typeof context> = (composeElement) => composeElement(context);

  return elementComposer;
};
