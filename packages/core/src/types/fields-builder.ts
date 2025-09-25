/** Field builder factories shared by model and slice helpers. */
import type {
  AbstractFieldReference,
  AnyFieldReference,
  AnyFields,
  AnyNestedObject,
  AnyNestedUnion,
  FieldReferenceOf,
} from "./fields";
import type { AssignableInput } from "./input-value";
import type { AnyGraphqlSchema, ObjectFieldRecord, UnionMemberName } from "./schema";
import type {
  InputTypeRefs,
  OutputEnumRef,
  OutputObjectRef,
  OutputScalarRef,
  OutputTypenameRef,
  OutputUnionRef,
} from "./type-ref";
import type { VoidIfEmptyObject } from "./utility";

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
  _: FieldReferenceFactories<TSchema, TTypeName>;
  f: FieldReferenceFactories<TSchema, TTypeName>;
  fields: FieldReferenceFactories<TSchema, TTypeName>;
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
  _: FieldReferenceFactories<TSchema, TTypeName>;
  f: FieldReferenceFactories<TSchema, TTypeName>;
  fields: FieldReferenceFactories<TSchema, TTypeName>;
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
export type FieldReferenceFactories<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string> = {
  [TFieldName in keyof ObjectFieldRecord<TSchema, TTypeName> & string]: FieldReferenceFactory<
    TSchema,
    FieldReferenceOf<TSchema, TTypeName, TFieldName>
  >;
};

export type AnyFieldReferenceFactory<TSchema extends AnyGraphqlSchema> =
  | FieldReferenceFactory<TSchema, AnyFieldReference & { type: OutputObjectRef }>
  | FieldReferenceFactory<TSchema, AnyFieldReference & { type: OutputUnionRef }>
  | FieldReferenceFactory<TSchema, AnyFieldReference & { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef }>;

/** Polymorphic factory that handles object, union, and scalar/enum fields. */
export type FieldReferenceFactory<TSchema extends AnyGraphqlSchema, TReference extends AnyFieldReference> = /* */
TReference extends { type: OutputObjectRef }
  ? FieldReferenceFactoryObject<TSchema, TReference>
  : TReference extends { type: OutputUnionRef }
    ? FieldReferenceFactoryUnion<TSchema, TReference>
    : TReference extends { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef }
      ? FieldReferenceFactoryPrimitive<TReference>
      : never;

export type FieldReferenceFactoryObject<
  TSchema extends AnyGraphqlSchema,
  TReference extends AnyFieldReference & { type: OutputObjectRef },
> = <TNested extends AnyNestedObject>(
  fieldArguments: FieldReferenceFactoryFieldArguments<TReference>,
  object: NestedObjectFieldsBuilder<TSchema, TReference["type"]["name"], TNested>,
) => {
  [_ in TReference["field"]]: AbstractFieldReference<
    TReference["parent"],
    TReference["field"],
    TReference["type"],
    TReference["args"],
    TReference["directives"],
    { object: TNested }
  >;
};

export type StrictlyRequired<T> = { [K in keyof T]-?: NonNullable<T[K]> };

export type FieldReferenceFactoryUnion<
  TSchema extends AnyGraphqlSchema,
  TReference extends AnyFieldReference & { type: OutputUnionRef },
> = <TNested extends AnyNestedUnion>(
  fieldArguments: FieldReferenceFactoryFieldArguments<TReference>,
  union: NestedUnionFieldsBuilder<TSchema, UnionMemberName<TSchema, TReference["type"]>, TNested>,
) => {
  [_ in TReference["field"]]: AbstractFieldReference<
    TReference["parent"],
    TReference["field"],
    TReference["type"],
    TReference["args"],
    TReference["directives"],
    { union: TNested }
  >;
};

export type FieldReferenceFactoryPrimitive<
  TReference extends AnyFieldReference & { type: OutputTypenameRef | OutputScalarRef | OutputEnumRef },
> = (fieldArguments: FieldReferenceFactoryFieldArguments<TReference>) => {
  [_ in TReference["field"]]: AbstractFieldReference<
    TReference["parent"],
    TReference["field"],
    TReference["type"],
    TReference["args"],
    TReference["directives"],
    {}
  >;
};

/** Flexible argument tuple accepted by field factories (supports directives). */
export type FieldReferenceFactoryFieldArguments<TFieldSelectionTemplate extends AnyFieldReference> =
  | TFieldSelectionTemplate["args"]
  | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
  | [args: TFieldSelectionTemplate["args"] | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>, directives: {}];
