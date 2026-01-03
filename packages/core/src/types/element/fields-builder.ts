/**
 * Field builder types for constructing GraphQL field selections.
 * @module
 */

import type { IfOmittable } from "../../utils/empty-object";
import type {
  AbstractFieldSelection,
  AnyAssignableInput,
  AnyDirectiveAttachments,
  AnyFieldSelection,
  AnyFields,
  AnyNestedObject,
  AnyNestedUnion,
  DeclaredVariables,
  FieldSelectionTemplateOf,
} from "../fragment";
import type { AnyGraphqlSchema, ObjectFieldRecord, UnionMemberName } from "../schema";
import type {
  InputTypeSpecifiers,
  OutputEnumSpecifier,
  OutputObjectSpecifier,
  OutputScalarSpecifier,
  OutputTypenameSpecifier,
  OutputUnionSpecifier,
} from "../type-foundation";

/**
 * Builder signature exposed to userland `model` and `slice` helpers. The
 * tooling `f`/`fields`/`_` aliases provide ergonomic access to GraphQL fields
 * while preserving the original schema information for inference.
 */
export type FieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields,
> = (tools: NoInfer<FieldsBuilderTools<TSchema, TTypeName, TVariableDefinitions>>) => TFields;

/**
 * Tools provided to field builder callbacks.
 * - `f`: Field selection factories for the current type
 * - `$`: Variable references for the current scope
 */
export type FieldsBuilderTools<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends InputTypeSpecifiers,
> = {
  f: FieldSelectionFactories<TSchema, TTypeName>;
  $: DeclaredVariables<TSchema, TVariableDefinitions>;
};

/**
 * Builder for nested object field selections.
 * Used when a field returns an object type requiring sub-selections.
 */
export type NestedObjectFieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyNestedObject,
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
 */
export type NestedUnionFieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TMemberName extends string,
  TUnionFields extends AnyNestedUnion,
> = {
  [TTypename in keyof TUnionFields & TMemberName]?: NestedObjectFieldsBuilder<
    TSchema,
    TTypename,
    NonNullable<TUnionFields[TTypename]>
  >;
};

/** Map each field to a factory capable of emitting fully-typed references. */
export type FieldSelectionFactories<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string> = {
  [TFieldName in keyof ObjectFieldRecord<TSchema, TTypeName>]: TFieldName extends string
    ? FieldSelectionFactory<TSchema, FieldSelectionTemplateOf<TSchema, TTypeName, TFieldName>>
    : never;
};

/**
 * Type-erased field selection factory.
 * @internal
 */
export type AnyFieldSelectionFactory = <TAlias extends string | null = null>(
  fieldArgs: AnyAssignableInput | void,
  extras?: { alias?: TAlias; directives?: AnyDirectiveAttachments },
) => AnyFieldSelectionFactoryReturn<TAlias>;

/**
 * Factory function for creating a typed field selection.
 * Accepts field arguments and optional alias/directives.
 */
export type FieldSelectionFactory<TSchema extends AnyGraphqlSchema, TSelection extends AnyFieldSelection> = <
  TAlias extends string | null = null,
>(
  fieldArgs: TSelection["args"] | IfOmittable<TSelection["args"], void | null>,
  extras?: { alias?: TAlias; directives?: TSelection["directives"] },
) => FieldSelectionFactoryReturn<TSchema, TSelection, TAlias>;

export type AnyFieldSelectionFactoryReturn<TAlias extends string | null> =
  | FieldSelectionFactoryReturn<AnyGraphqlSchema, AnyFieldSelection & { type: OutputObjectSpecifier }, TAlias>
  | FieldSelectionFactoryReturn<AnyGraphqlSchema, AnyFieldSelection & { type: OutputUnionSpecifier }, TAlias>
  | FieldSelectionFactoryReturn<
      AnyGraphqlSchema,
      AnyFieldSelection & { type: OutputTypenameSpecifier | OutputScalarSpecifier | OutputEnumSpecifier },
      TAlias
    >;

export type FieldSelectionFactoryReturn<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection,
  TAlias extends string | null,
> = TSelection extends { type: OutputObjectSpecifier }
  ? FieldSelectionFactoryObjectReturn<TSchema, TSelection, TAlias>
  : TSelection extends { type: OutputUnionSpecifier }
    ? FieldSelectionFactoryUnionReturn<TSchema, TSelection, TAlias>
    : TSelection extends { type: OutputTypenameSpecifier | OutputScalarSpecifier | OutputEnumSpecifier }
      ? FieldSelectionFactoryPrimitiveReturn<TSelection, TAlias>
      : never;

export type FieldSelectionFactoryObjectReturn<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection & { type: OutputObjectSpecifier },
  TAlias extends string | null,
> = <TNested extends AnyNestedObject>(
  nest: NestedObjectFieldsBuilder<TSchema, TSelection["type"]["name"], TNested>,
) => {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    { object: TNested }
  >;
};

export type FieldSelectionFactoryUnionReturn<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection & { type: OutputUnionSpecifier },
  TAlias extends string | null,
> = <TNested extends AnyNestedUnion>(
  nest: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TSelection["type"]>, TNested>,
) => {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    { union: TNested }
  >;
};

export type FieldSelectionFactoryPrimitiveReturn<
  TSelection extends AnyFieldSelection & { type: OutputTypenameSpecifier | OutputScalarSpecifier | OutputEnumSpecifier },
  TAlias extends string | null,
> = {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    {}
  >;
};

export type FieldSelectionFactoryFieldArguments<TFieldSelectionTemplate extends AnyFieldSelection> =
  | TFieldSelectionTemplate["args"]
  | IfOmittable<TFieldSelectionTemplate["args"], void | null>;
