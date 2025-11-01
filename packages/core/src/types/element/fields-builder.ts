/** Field builder factories shared by model and slice helpers. */

import type { IfEmpty } from "../../utils/empty-object";
import type { UnionToIntersection } from "../../utils/type-utils";
import type {
  AbstractFieldSelection,
  AnyAssignableInput,
  AnyDirectiveAttachments,
  AnyFieldSelection,
  AnyFields,
  AnyNestedObject,
  AnyNestedUnion,
  AssignableInput,
  FieldSelectionTemplateOf,
} from "../fragment";
import type { SchemaByKey, SodaGqlSchemaRegistry } from "../registry";
import type {
  InputTypeSpecifiers,
  ObjectFieldRecord,
  OutputEnumSpecifier,
  OutputObjectSpecifier,
  OutputScalarSpecifier,
  OutputTypenameSpecifier,
  OutputUnionSpecifier,
  UnionMemberName,
} from "../schema";

export const mergeFields = <TFieldEntries extends AnyFields[]>(fields: TFieldEntries) =>
  Object.assign({}, ...fields) as MergeFields<TFieldEntries>;

export type MergeFields<TFieldEntries extends AnyFields[]> = UnionToIntersection<
  TFieldEntries[number]
> extends infer TFieldsIntersection
  ? {
      [TFieldName in keyof TFieldsIntersection]: TFieldsIntersection[TFieldName] extends AnyFieldSelection
        ? TFieldsIntersection[TFieldName]
        : never;
    } & {}
  : never;

/**
 * Builder signature exposed to userland `model` and `slice` helpers. The
 * tooling `f`/`fields`/`_` aliases provide ergonomic access to GraphQL fields
 * while preserving the original schema information for inference.
 */
export type FieldsBuilder<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string,
  TVariableDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields[],
> = (tools: NoInfer<FieldsBuilderTools<TSchemaKey, TTypeName, TVariableDefinitions>>) => TFields;

export type FieldsBuilderTools<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string,
  TVariableDefinitions extends InputTypeSpecifiers,
> = {
  f: FieldSelectionFactories<TSchemaKey, TTypeName>;
  $: AssignableInput<TSchemaKey, TVariableDefinitions>;
};

/** Narrow builder used when a field resolves to an object and we need nested selections. */
export type NestedObjectFieldsBuilder<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string,
  TFields extends AnyNestedObject[],
> = (tools: NoInfer<NestedObjectFieldsBuilderTools<TSchemaKey, TTypeName>>) => TFields;

export type NestedObjectFieldsBuilderTools<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string,
> = {
  f: FieldSelectionFactories<TSchemaKey, TTypeName>;
};

export type NestedUnionFieldsBuilder<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TMemberName extends string,
  TUnionFields extends AnyNestedUnion,
> = {
  [TTypename in keyof TUnionFields & TMemberName]?: NestedObjectFieldsBuilder<
    TSchemaKey,
    TTypename,
    NonNullable<TUnionFields[TTypename]>[]
  >;
};

/** Map each field to a factory capable of emitting fully-typed references. */
export type FieldSelectionFactories<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string,
> = {
  [TFieldName in keyof ObjectFieldRecord<TSchemaKey, TTypeName>]: TFieldName extends string
    ? FieldSelectionFactory<TSchemaKey, FieldSelectionTemplateOf<TSchemaKey, TTypeName, TFieldName>>
    : never;
};

export type AnyFieldSelectionFactory = <TAlias extends string | null = null>(
  fieldArgs: AnyAssignableInput | void,
  extras?: { alias?: TAlias; directives?: AnyDirectiveAttachments },
) => AnyFieldSelectionFactoryReturn<TAlias>;

export type FieldSelectionFactory<TSchemaKey extends keyof SodaGqlSchemaRegistry, TSelection extends AnyFieldSelection> = <
  TAlias extends string | null = null,
>(
  fieldArgs: TSelection["args"] | IfEmpty<TSelection["args"], void | null>,
  extras?: { alias?: TAlias; directives?: TSelection["directives"] },
) => FieldSelectionFactoryReturn<TSchemaKey, TSelection, TAlias>;

export type AnyFieldSelectionFactoryReturn<TAlias extends string | null> =
  | FieldSelectionFactoryReturn<
      keyof SodaGqlSchemaRegistry extends never ? string : keyof SodaGqlSchemaRegistry,
      AnyFieldSelection & { type: OutputObjectSpecifier },
      TAlias
    >
  | FieldSelectionFactoryReturn<
      keyof SodaGqlSchemaRegistry extends never ? string : keyof SodaGqlSchemaRegistry,
      AnyFieldSelection & { type: OutputUnionSpecifier },
      TAlias
    >
  | FieldSelectionFactoryReturn<
      keyof SodaGqlSchemaRegistry extends never ? string : keyof SodaGqlSchemaRegistry,
      AnyFieldSelection & { type: OutputTypenameSpecifier | OutputScalarSpecifier | OutputEnumSpecifier },
      TAlias
    >;

export type FieldSelectionFactoryReturn<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSelection extends AnyFieldSelection,
  TAlias extends string | null,
> = TSelection extends { type: OutputObjectSpecifier }
  ? FieldSelectionFactoryObjectReturn<TSchemaKey, TSelection, TAlias>
  : TSelection extends { type: OutputUnionSpecifier }
    ? FieldSelectionFactoryUnionReturn<TSchemaKey, TSelection, TAlias>
    : TSelection extends { type: OutputTypenameSpecifier | OutputScalarSpecifier | OutputEnumSpecifier }
      ? FieldSelectionFactoryPrimitiveReturn<TSelection, TAlias>
      : never;

export type FieldSelectionFactoryObjectReturn<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSelection extends AnyFieldSelection & { type: OutputObjectSpecifier },
  TAlias extends string | null,
> = <TNested extends AnyNestedObject[]>(
  nest: NestedObjectFieldsBuilder<TSchemaKey, TSelection["type"]["name"], TNested>,
) => {
  [_ in TAlias extends null ? TSelection["field"] : TAlias]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    { object: MergeFields<TNested> }
  >;
};

export type FieldSelectionFactoryUnionReturn<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSelection extends AnyFieldSelection & { type: OutputUnionSpecifier },
  TAlias extends string | null,
> = <TNested extends AnyNestedUnion>(
  nest: NestedUnionFieldsBuilder<TSchemaKey, UnionMemberName<TSchemaKey, TSelection["type"]>, TNested>,
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
  | IfEmpty<TFieldSelectionTemplate["args"], void | null>;
