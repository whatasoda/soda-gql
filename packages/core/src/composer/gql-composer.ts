/**
 * Main entry point for composing GraphQL elements.
 * @module
 */

import type { AnyFragment, AnyGqlDefine, AnyOperation } from "../types/element";
import { GqlDefine } from "../types/element";
import type { Adapter, AnyAdapter, AnyMetadataAdapter, DefaultAdapter, DefaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import { createColocateHelper } from "./colocate";
import { createCompatTaggedTemplate } from "./compat-tagged-template";
import { applyContextTransformer } from "./context-transformer";
import { createStandardDirectives, type StandardDirectives } from "./directive-builder";
import { createExtendComposer } from "./extend";
import { createFragmentTaggedTemplate } from "./fragment-tagged-template";
import { createOperationTaggedTemplate } from "./operation-tagged-template";

/**
 * Function signature for composing GraphQL elements (fragments or operations).
 *
 * The composer provides a context with builders for fragments, operations,
 * variables, and colocation helpers.
 */
export type GqlElementComposer<TContext> = <TResult extends AnyFragment | AnyOperation | AnyGqlDefine>(
  composeElement: (context: TContext) => TResult,
) => TResult;

/**
 * GQL element composer with schema access.
 *
 * Extends the base composer function with a `$schema` property that provides
 * runtime access to the schema definition. This is useful for:
 * - Type generation tools (typegen)
 * - Runtime schema introspection
 * - Debugging and tooling
 */
export type GqlElementComposerWithSchema<TContext, TSchema extends AnyGraphqlSchema> = GqlElementComposer<TContext> & {
  /**
   * The GraphQL schema definition used by this composer.
   * Provides runtime access to schema types, operations, and metadata.
   */
  readonly $schema: TSchema;
};

/**
 * Extracts the helpers type from an adapter.
 * Uses `any` for non-target type parameters to avoid contravariance issues
 * with the `aggregateFragmentMetadata` function parameter type.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required to avoid contravariance issues in conditional type matching
type ExtractHelpers<TAdapter extends AnyAdapter> = TAdapter extends Adapter<infer THelpers, any, any, any> ? THelpers : object;

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
 * Configuration options for `createGqlElementComposer`.
 */
export type GqlElementComposerOptions<
  _TSchema extends AnyGraphqlSchema,
  TDirectiveMethods extends StandardDirectives,
  TAdapter extends AnyAdapter = DefaultAdapter,
> = {
  /** Optional adapter for custom helpers and metadata handling. */
  adapter?: TAdapter;
  /** Optional custom directive methods (including schema-defined directives). */
  directiveMethods?: TDirectiveMethods;
};

/**
 * Creates a GQL element composer for a given schema.
 *
 * This is the main entry point for defining GraphQL operations and fragments.
 * The returned function provides a context with:
 * - `fragment`: Tagged template function for fragment definitions
 * - `query/mutation/subscription`: Operation builders (tagged template + options object + .compat)
 * - `$dir`: Field directive helpers (@skip, @include)
 * - `$colocate`: Fragment colocation utilities
 *
 * @param schema - The GraphQL schema definition
 * @param options - Configuration including optional adapter
 * @returns Element composer function
 *
 * @example
 * ```typescript
 * const gql = createGqlElementComposer(schema, {});
 *
 * const GetUser = gql(({ query, $dir }) =>
 *   query("GetUser")`($id: ID!) {
 *     user(id: $id) { name email }
 *   }`()
 * );
 * ```
 */
export const createGqlElementComposer = <
  TSchema extends AnyGraphqlSchema,
  TDirectiveMethods extends StandardDirectives,
  TAdapter extends AnyAdapter = DefaultAdapter,
>(
  schema: NoInfer<TSchema>,
  options: GqlElementComposerOptions<NoInfer<TSchema>, NoInfer<TDirectiveMethods>, NoInfer<TAdapter>>,
) => {
  type THelpers = ExtractHelpers<TAdapter>;
  type TMetadataAdapter = ExtractMetadataAdapter<TAdapter>;
  const { adapter, directiveMethods } = options;
  const helpers = adapter?.helpers as THelpers | undefined;
  const metadataAdapter = adapter?.metadata as TMetadataAdapter | undefined;
  const transformDocument = adapter?.transformDocument;
  // Fragment: curried tagged template function — fragment("name", "type")`{ fields }`
  const fragment = createFragmentTaggedTemplate(schema);

  // Hybrid context: curried tagged template / options object functions with .compat property
  const context = {
    fragment,
    query: Object.assign(createOperationTaggedTemplate(schema, "query", metadataAdapter, transformDocument), {
      compat: createCompatTaggedTemplate(schema, "query"),
    }),
    mutation: Object.assign(createOperationTaggedTemplate(schema, "mutation", metadataAdapter, transformDocument), {
      compat: createCompatTaggedTemplate(schema, "mutation"),
    }),
    subscription: Object.assign(createOperationTaggedTemplate(schema, "subscription", metadataAdapter, transformDocument), {
      compat: createCompatTaggedTemplate(schema, "subscription"),
    }),
    define: <TValue>(factory: () => TValue | Promise<TValue>) => GqlDefine.create(factory),
    extend: createExtendComposer<TSchema, TMetadataAdapter>(schema, metadataAdapter, transformDocument),
    $dir: directiveMethods ?? (createStandardDirectives() as TDirectiveMethods),
    $colocate: createColocateHelper(),
    ...(helpers ?? ({} as THelpers)),
  };

  // Apply context transformer if set (for programmatic API like @soda-gql/sdk)
  const transformedContext = applyContextTransformer(context);

  const elementComposer: GqlElementComposer<typeof context> = (composeElement) => composeElement(transformedContext);

  // Attach schema as readonly property for runtime access
  const composerWithSchema = elementComposer as GqlElementComposerWithSchema<typeof context, TSchema>;
  Object.defineProperty(composerWithSchema, "$schema", {
    value: schema,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return composerWithSchema;
};

/**
 * Abstract Context type for prebuilt composers.
 *
 * Provides minimal structure while allowing PrebuiltTypeRegistry to resolve
 * actual types. Used by prebuilt module to avoid heavy schema type inference.
 *
 * Type safety in prebuilt comes from `ResolvePrebuiltElement`, not from
 * the Context type.
 */
export type AnyGqlContext = {
  readonly fragment: (...args: unknown[]) => unknown;
  readonly query: ((...args: unknown[]) => unknown) & {
    compat: (...args: unknown[]) => AnyGqlDefine;
  };
  readonly mutation: ((...args: unknown[]) => unknown) & {
    compat: (...args: unknown[]) => AnyGqlDefine;
  };
  readonly subscription: ((...args: unknown[]) => unknown) & {
    compat: (...args: unknown[]) => AnyGqlDefine;
  };
  readonly define: <TValue>(factory: () => TValue | Promise<TValue>) => GqlDefine<TValue>;
  readonly extend: (...args: unknown[]) => AnyOperation;
  readonly $dir: StandardDirectives;
  readonly $colocate: unknown;
  readonly [key: string]: unknown;
};
