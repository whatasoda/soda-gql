/** Field builder factories shared by model and slice helpers. */
import type {
  AbstractFieldSelection,
  AnyFieldSelection,
  AnyFields,
  AnyNestedObject,
  AnyNestedUnion,
  AssignableInput,
  FieldSelectionTemplateOf,
} from "../fragment";
import type {
  AnyGraphqlSchema,
  InputTypeRefs,
  ObjectFieldRecord,
  OutputEnumRef,
  OutputObjectRef,
  OutputScalarRef,
  OutputTypenameRef,
  OutputUnionRef,
  UnionMemberName,
} from "../schema";
import type { VoidIfEmptyObject } from "../shared/utility";

/**
 * Builder signature exposed to userland `model` and `slice` helpers. The
 * tooling `f`/`fields`/`_` aliases provide ergonomic access to GraphQL fields
 * while preserving the original schema information for inference.
 */
export type FieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends InputTypeRefs,
  TFields extends AnyFields,
> = (tools: NoInfer<FieldsBuilderTools<TSchema, TTypeName, TVariableDefinitions>>) => TFields;

export type FieldsBuilderTools<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends InputTypeRefs,
> = {
  _: FieldSelectionFactories<TSchema, TTypeName>;
  f: FieldSelectionFactories<TSchema, TTypeName>;
  $: AssignableInput<TSchema, TVariableDefinitions>;
};

/** Narrow builder used when a field resolves to an object and we need nested selections. */
export type NestedObjectFieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyNestedObject,
> = (tools: NoInfer<NestedObjectFieldsBuilderTools<TSchema, TTypeName>>) => TFields;

export type NestedObjectFieldsBuilderTools<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
> = {
  _: FieldSelectionFactories<TSchema, TTypeName>;
  f: FieldSelectionFactories<TSchema, TTypeName>;
  fields: FieldSelectionFactories<TSchema, TTypeName>;
};

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
  [TFieldName in keyof ObjectFieldRecord<TSchema, TTypeName> & string]: FieldSelectionFactory<
    TSchema,
    FieldSelectionTemplateOf<TSchema, TTypeName, TFieldName>
  >;
};

export type AnyFieldSelectionFactory<TSchema extends AnyGraphqlSchema> =
  | FieldSelectionFactory<TSchema, AnyFieldSelection & { type: OutputObjectRef }>
  | FieldSelectionFactory<TSchema, AnyFieldSelection & { type: OutputUnionRef }>
  | FieldSelectionFactory<TSchema, AnyFieldSelection & { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef }>;

/** Polymorphic factory that handles object, union, and scalar/enum fields. */
export type FieldSelectionFactory<TSchema extends AnyGraphqlSchema, TSelection extends AnyFieldSelection> = /* */
TSelection extends { type: OutputObjectRef }
  ? FieldSelectionFactoryObject<TSchema, TSelection>
  : TSelection extends { type: OutputUnionRef }
    ? FieldSelectionFactoryUnion<TSchema, TSelection>
    : TSelection extends { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef }
      ? FieldSelectionFactoryPrimitive<TSelection>
      : never;

export type FieldSelectionFactoryObject<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection & { type: OutputObjectRef },
> = <TNested extends AnyNestedObject>(
  fieldArguments: FieldSelectionFactoryFieldArguments<TSelection>,
  object: NestedObjectFieldsBuilder<TSchema, TSelection["type"]["name"], TNested>,
) => {
  [_ in TSelection["field"]]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    { object: TNested }
  >;
};

export type StrictlyRequired<T> = { [K in keyof T]-?: NonNullable<T[K]> };

export type FieldSelectionFactoryUnion<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection & { type: OutputUnionRef },
> = <TNested extends AnyNestedUnion>(
  fieldArguments: FieldSelectionFactoryFieldArguments<TSelection>,
  union: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TSelection["type"]>, TNested>,
) => {
  [_ in TSelection["field"]]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    { union: TNested }
  >;
};

export type FieldSelectionFactoryPrimitive<
  TSelection extends AnyFieldSelection & { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef },
> = (fieldArguments: FieldSelectionFactoryFieldArguments<TSelection>) => {
  [_ in TSelection["field"]]: AbstractFieldSelection<
    TSelection["parent"],
    TSelection["field"],
    TSelection["type"],
    TSelection["args"],
    TSelection["directives"],
    {}
  >;
};

/** Flexible argument tuple accepted by field factories (supports directives). */
export type FieldSelectionFactoryFieldArguments<TFieldSelectionTemplate extends AnyFieldSelection> =
  | TFieldSelectionTemplate["args"]
  | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
  | [args: TFieldSelectionTemplate["args"] | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>, directives: {}];
