/**
 * Field builder types for constructing GraphQL field selections.
 * @module
 */

import type { IfOmittable } from "../../utils/empty-object";
import type {
  AbstractFieldSelection,
  AnyAssignableInput,
  AnyFieldSelection,
  AnyFieldsExtended,
  AnyNestedUnion,
  DeclaredVariables,
  FieldSelectionTemplateOf,
} from "../fragment";
import type { AnyGraphqlSchema, ObjectFieldRecord } from "../schema";
import type { DeferredOutputSpecifier, GetSpecName, VariableDefinitions } from "../type-foundation";
import type { AnyDirectiveRef } from "../type-foundation/directive-ref";

/**
 * Builder signature exposed to userland `model` and `slice` helpers. The
 * tooling `f`/`fields`/`_` aliases provide ergonomic access to GraphQL fields
 * while preserving the original schema information for inference.
 *
 * Supports both shorthand syntax (`id: true`) and factory syntax (`...f.id()`).
 */
export type FieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
> = (tools: NoInfer<FieldsBuilderTools<TSchema, TTypeName, TVariableDefinitions>>) => TFields;

/**
 * Tools provided to field builder callbacks.
 * - `f`: Field selection factories for the current type
 * - `$`: Variable references for the current scope
 */
export type FieldsBuilderTools<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends VariableDefinitions,
> = {
  f: FieldSelectionFactories<TSchema, TTypeName>;
  $: DeclaredVariables<TSchema, TVariableDefinitions>;
};

/**
 * Builder for nested object field selections.
 * Used when a field returns an object type requiring sub-selections.
 *
 * Supports both shorthand syntax (`id: true`) and factory syntax (`...f.id()`).
 */
export type NestedObjectFieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFieldsExtended,
> = (tools: NoInfer<NestedObjectFieldsBuilderTools<TSchema, TTypeName>>) => TFields;

/**
 * Tools for nested object builders (no variable access).
 * @internal
 */
export type NestedObjectFieldsBuilderTools<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
> = {
  f: FieldSelectionFactories<TSchema, TTypeName>;
};

/**
 * Builder for union type selections with per-member field definitions.
 * Supports shorthand syntax (`id: true`) within each member's field builder.
 * Use `__typename: true` to enable catch-all __typename discrimination for all union members.
 *
 * Note: The mapped type only includes union member names. The __typename flag is added via
 * intersection. TUnionFields will NOT capture __typename - use direct input inspection instead.
 */
export type NestedUnionFieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TMemberName extends string,
  TUnionFields extends AnyNestedUnion,
> = {
  [TTypename in keyof TUnionFields & TMemberName]?: NestedObjectFieldsBuilder<
    TSchema,
    TTypename,
    NonNullable<TUnionFields[TTypename]> & AnyFieldsExtended
  >;
} & {
  __typename?: true;
};

/** Map each field to a factory capable of emitting fully-typed references. */
export type FieldSelectionFactories<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string> = {
  [TFieldName in keyof ObjectFieldRecord<TSchema, TTypeName> & string]: FieldSelectionFactory<
    TSchema,
    FieldSelectionTemplateOf<TSchema, TTypeName, TFieldName>
  >;
};

/**
 * Type-erased field selection factory.
 * @internal
 */
export type AnyFieldSelectionFactory = <TAlias extends string | null = null>(
  fieldArgs: AnyAssignableInput | void,
  extras?: { alias?: TAlias; directives?: AnyDirectiveRef[] },
) => AnyFieldSelectionFactoryReturn<TAlias>;

/**
 * Factory function for creating a typed field selection.
 * Accepts field arguments and optional alias/directives.
 */
export type FieldSelectionFactory<TSchema extends AnyGraphqlSchema, TSelection extends AnyFieldSelection> = <
  TAlias extends string | null = null,
>(
  fieldArgs: TSelection["args"] | IfOmittable<TSelection["args"], void | null>,
  extras?: { alias?: TAlias; directives?: AnyDirectiveRef[] },
) => FieldSelectionFactoryReturn<TSchema, TSelection, TAlias>;

/** Deferred specifier pattern for object types: o|{name}|{modifier} */
type ObjectSpecifierPattern = `o|${string}|${string}`;

/** Deferred specifier pattern for union types: u|{name}|{modifier} */
type UnionSpecifierPattern = `u|${string}|${string}`;

/** Deferred specifier pattern for primitive types (scalar, enum): s|{name}|{modifier} or e|{name}|{modifier} */
type PrimitiveSpecifierPattern = `s|${string}|${string}` | `e|${string}|${string}`;

/** Helper to extract spec from field type */
type GetFieldTypeSpec<T> = T extends { spec: infer S } ? S : never;

export type AnyFieldSelectionFactoryReturn<TAlias extends string | null> =
  | FieldSelectionFactoryReturn<AnyGraphqlSchema, AnyFieldSelection & { type: { spec: ObjectSpecifierPattern } }, TAlias>
  | FieldSelectionFactoryReturn<AnyGraphqlSchema, AnyFieldSelection & { type: { spec: UnionSpecifierPattern } }, TAlias>
  | FieldSelectionFactoryReturn<AnyGraphqlSchema, AnyFieldSelection & { type: { spec: PrimitiveSpecifierPattern } }, TAlias>;

export type FieldSelectionFactoryReturn<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection,
  TAlias extends string | null,
> = GetFieldTypeSpec<TSelection["type"]> extends ObjectSpecifierPattern
  ? FieldSelectionFactoryObjectReturn<TSchema, TSelection & { type: { spec: ObjectSpecifierPattern } }, TAlias>
  : GetFieldTypeSpec<TSelection["type"]> extends UnionSpecifierPattern
    ? FieldSelectionFactoryUnionReturn<TSchema, TSelection & { type: { spec: UnionSpecifierPattern } }, TAlias>
    : GetFieldTypeSpec<TSelection["type"]> extends PrimitiveSpecifierPattern
      ? FieldSelectionFactoryPrimitiveReturn<TSelection & { type: { spec: PrimitiveSpecifierPattern } }, TAlias>
      : never;

export type FieldSelectionFactoryObjectReturn<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection & { type: { spec: ObjectSpecifierPattern } },
  TAlias extends string | null,
> = <TNested extends AnyFieldsExtended>(
  nest: NestedObjectFieldsBuilder<TSchema, GetSpecName<TSelection["type"]["spec"]> & keyof TSchema["object"] & string, TNested>,
) => {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    TNested,
    null,
    false // No union, so TUnionTypename is false
  >;
};

/**
 * Remove __typename key from a type to get pure selections.
 */
type OmitTypename<T> = { [K in keyof T as K extends "__typename" ? never : K]: T[K] };

/**
 * Detect if T has __typename: true (not optional or missing).
 * Uses a pattern that checks if the property is exactly `true` after removing index signatures.
 */
type InferTypenameFlag<T> = "__typename" extends keyof T
  ? T["__typename"] extends true
    ? true
    : false
  : false;

/**
 * Constraint for union builder input that allows member builders and optional __typename.
 */
type UnionBuilderInputConstraint<
  TSchema extends AnyGraphqlSchema,
  TMemberName extends string,
> = {
  [K in TMemberName]?: NestedObjectFieldsBuilder<TSchema, K, AnyFieldsExtended>;
} & {
  __typename?: true;
};

export type FieldSelectionFactoryUnionReturn<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection & { type: { spec: UnionSpecifierPattern } },
  TAlias extends string | null,
  TMemberName extends string = UnionMemberNameFromDeferred<TSchema, TSelection["type"]["spec"]>,
> = <TInput extends UnionBuilderInputConstraint<TSchema, TMemberName>>(
  nest: TInput,
) => {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    null,
    OmitTypename<TInput> & AnyNestedUnion,
    InferTypenameFlag<TInput>
  >;
};

/** Helper to get union member names from a deferred union specifier */
type UnionMemberNameFromDeferred<
  TSchema extends AnyGraphqlSchema,
  TSpecifier extends DeferredOutputSpecifier,
> = GetSpecName<TSpecifier> extends keyof TSchema["union"]
  ? Extract<keyof TSchema["union"][GetSpecName<TSpecifier>]["types"], string>
  : never;

export type FieldSelectionFactoryPrimitiveReturn<
  TSelection extends AnyFieldSelection & { type: { spec: PrimitiveSpecifierPattern } },
  TAlias extends string | null,
> = {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    null,
    null,
    false // No union, so TUnionTypename is false
  >;
};

export type FieldSelectionFactoryFieldArguments<TFieldSelectionTemplate extends AnyFieldSelection> =
  | TFieldSelectionTemplate["args"]
  | IfOmittable<TFieldSelectionTemplate["args"], void | null>;
