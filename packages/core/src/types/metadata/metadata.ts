import type { DocumentNode } from "graphql";
import type { ConstValue } from "../type-foundation/const-value";
import type {
  AnyVarRef,
  ComposeTimeVarRefsFromVarTypes,
  NameAtProxy,
  NestedValueVarRef,
  SelectedValue,
  SelectorProxy,
  VarRefPayload,
} from "../type-foundation/var-ref";
import type { OperationDocumentTransformer } from "./adapter";

/**
 * Base metadata types that can be attached to operations.
 * These are consumed at runtime by GraphQL clients for HTTP headers
 * and custom application-specific values.
 */
export type OperationMetadata = {
  /** HTTP headers to include with the GraphQL request */
  readonly headers?: Record<string, string>;
  /** Custom arbitrary metadata values for application-specific use */
  readonly custom?: Record<string, unknown>;
};

/**
 * Tools for inspecting VarRef objects inside metadata builder callbacks.
 * Available as `$var` in the callback context.
 */
export type VarRefTools = {
  /** Get variable name from a VarRef */
  readonly getName: (varRef: AnyVarRef) => string;
  /**
   * Get const value from a nested-value VarRef.
   * Rejects compose-time variable refs, whose runtime const value never exists.
   */
  readonly getValue: (varRef: NestedValueVarRef) => ConstValue;
  /**
   * Get variable name at a specific path in a nested VarRef.
   * The selector proxy defaults to the variable's payload shape, except a compose-time
   * variable ref gets an identity-only leaf (navigating a variable ref throws at
   * runtime); an explicit annotation overrides it.
   */
  readonly getNameAt: <TVarRef extends AnyVarRef, T = NameAtProxy<TVarRef>>(
    varRef: TVarRef,
    selector: (proxy: T) => unknown,
  ) => string;
  /**
   * Get const value at a specific path in a nested VarRef.
   * Rejects compose-time variable refs, whose runtime const value never exists.
   * The selector proxy defaults to the variable's payload shape (object fields
   * navigable, scalars/arrays terminal); an explicit annotation overrides it.
   */
  readonly getValueAt: <TVarRef extends NestedValueVarRef, T = SelectorProxy<VarRefPayload<TVarRef>>, U = unknown>(
    varRef: TVarRef,
    selector: (proxy: T) => U,
  ) => SelectedValue<U>;
  /**
   * Get path segments to a variable within a nested structure.
   * The selector proxy defaults to the variable's payload shape (object fields
   * navigable, scalars/arrays terminal); an explicit annotation overrides it.
   */
  readonly getPath: <TVarRef extends AnyVarRef, T = SelectorProxy<VarRefPayload<TVarRef>>>(
    varRef: TVarRef,
    selector: (proxy: T) => unknown,
  ) => readonly string[];
  /** Check if a value contains any VarRef */
  readonly hasVarRefInside: (value: unknown) => boolean;
};

/**
 * Tools available inside metadata builder callbacks.
 * Access utilities via $var.getName(), $var.getValue(), $var.getInner().
 *
 * @template TVarRefs - Variable references from the operation
 * @template TAggregatedFragmentMetadata - The aggregated fragment metadata type from the adapter
 * @template TSchemaLevel - The schema-level configuration type from the adapter
 */
export type MetadataBuilderTools<
  TVarRefs extends Record<string, AnyVarRef>,
  TAggregatedFragmentMetadata = readonly (OperationMetadata | undefined)[],
  TSchemaLevel = unknown,
> = {
  /** Variable references created from the operation's variable definitions */
  readonly $: TVarRefs;
  /** Utilities for inspecting VarRef objects (variable name extraction, nested path access) */
  readonly $var: VarRefTools;
  /** The GraphQL DocumentNode (AST) for this operation */
  readonly document: DocumentNode;
  /** Aggregated metadata from spread fragments, evaluated before operation metadata */
  readonly fragmentMetadata?: TAggregatedFragmentMetadata;
  /** Schema-level fixed values from the adapter */
  readonly schemaLevel?: TSchemaLevel;
};

/**
 * Metadata builder callback that receives variable tools.
 * Allows metadata to reference operation variables.
 *
 * @template TVarRefs - Variable references from the operation
 * @template TMetadata - The metadata type returned by this builder
 * @template TAggregatedFragmentMetadata - The aggregated fragment metadata type from the adapter
 * @template TSchemaLevel - The schema-level configuration type from the adapter
 */
export type MetadataBuilder<
  TVarRefs extends Record<string, AnyVarRef>,
  TMetadata,
  TAggregatedFragmentMetadata = readonly (OperationMetadata | undefined)[],
  TSchemaLevel = unknown,
> = (tools: MetadataBuilderTools<TVarRefs, TAggregatedFragmentMetadata, TSchemaLevel>) => TMetadata | Promise<TMetadata>;

/**
 * Utility type to extract the metadata type from an operation.
 */
export type ExtractMetadata<T> = T extends { metadata: infer M } ? M : OperationMetadata;

/**
 * Tools available inside fragment metadata builder callbacks.
 * Unlike operation metadata, fragments don't have their own document.
 */
export type FragmentMetadataBuilderTools<TVarRefs extends Record<string, AnyVarRef>> = {
  /** Variable references created from the fragment's variable definitions */
  readonly $: TVarRefs;
  /** Utilities for inspecting VarRef objects (variable name extraction, nested path access) */
  readonly $var: VarRefTools;
};

/**
 * Metadata builder callback for fragments.
 * Allows metadata to reference fragment variables.
 * Supports both sync and async metadata generation.
 */
export type FragmentMetadataBuilder<TVarRefs extends Record<string, AnyVarRef>, TMetadata = OperationMetadata> = (
  tools: FragmentMetadataBuilderTools<TVarRefs>,
) => TMetadata | Promise<TMetadata>;

/**
 * Trailing options accepted by a prebuilt operation builder call.
 * `metadata` accepts a static value or a builder callback whose `$` is keyed by
 * the operation's variables (derived from generated `varTypes`); `TMetadata` is
 * inferred from whichever form is provided. The adapter's aggregated
 * fragment-metadata and schema-level types are threaded through so the callback's
 * `fragmentMetadata`/`schemaLevel` are typed per configured adapter.
 */
export type PrebuiltOperationOptions<
  TVarTypes,
  TMetadata,
  TAggregatedFragmentMetadata = readonly (OperationMetadata | undefined)[],
  TSchemaLevel = unknown,
> = {
  readonly metadata?:
    | TMetadata
    | MetadataBuilder<ComposeTimeVarRefsFromVarTypes<TVarTypes>, TMetadata, TAggregatedFragmentMetadata, TSchemaLevel>;
  readonly transformDocument?: OperationDocumentTransformer<TMetadata>;
};

/**
 * Trailing options accepted by a prebuilt fragment builder call.
 * `metadata` accepts a static value or a fragment builder callback whose `$` is
 * keyed by the fragment's variables. The refs are compose-time: at spread time a
 * fragment `$` entry may be a pass-through operation variable ref (no const value),
 * so `getValue`/`getValueAt` are rejected here just as for operations.
 */
export type PrebuiltFragmentOptions<TVarTypes, TMetadata> = {
  readonly metadata?: TMetadata | FragmentMetadataBuilder<ComposeTimeVarRefsFromVarTypes<TVarTypes>, TMetadata>;
};
