/** Canonical field selection types used by models and slices. */

import type { AnyFieldName, AnyGraphqlSchema, AnyTypeName, InferOutputProfile } from "../schema";
import type {
  ApplyTypeModifier,
  GetModifiedType,
  OutputInferrableTypeSpecifier,
  OutputObjectSpecifier,
  OutputTypeSpecifier,
  OutputUnionSpecifier,
} from "../type-foundation";
import type { AnyAssignableInput, AssignableInputByFieldName } from "./assignable-input";
import type { AnyDirectiveAttachments } from "./directives";

/**
 * Canonical representation of the field selections we collect during model and
 * slice definition. Each alias maps to a typed field reference that still
 * remembers its parent type, arguments, directives, and nested selections.
 *
 * Note: The `object` property supports both factory-returned AnyFieldSelection
 * and shorthand (true) values via AnyNestedObjectExtended.
 */
export type AnyFieldSelection = {
  readonly parent: AnyTypeName;
  readonly field: AnyFieldName;
  readonly type: OutputTypeSpecifier;
  readonly args: AnyAssignableInput;
  readonly directives: AnyDirectiveAttachments;
  readonly object: AnyNestedObjectExtended | null;
  readonly union: AnyNestedUnion | null;
};

/** Nested selection produced when resolving an object field (factory syntax only). */
export type AnyNestedObject = { readonly [alias: string]: AnyFieldSelection };

/** Nested selection supporting shorthand syntax. */
export type AnyNestedObjectExtended = { readonly [alias: string]: AnyFieldValue };
/** Nested selection produced when resolving a union field. Supports shorthand syntax. */
export type AnyNestedUnion = { readonly [typeName: string]: AnyNestedObjectExtended | undefined };

/** Map of alias → field reference used by builders and inference. */
export type AnyFields = {
  readonly [alias: string]: AnyFieldSelection;
};

/**
 * Strongly typed field reference produced for concrete schema members.
 *
 * Supports shorthand syntax in nested object selections via AnyNestedObjectExtended.
 */
export type AbstractFieldSelection<
  TTypeName extends AnyTypeName,
  TFieldName extends AnyFieldName,
  TSpecifier extends OutputTypeSpecifier,
  TArgs extends AnyAssignableInput,
  TDirectives extends AnyDirectiveAttachments,
  TObject extends AnyNestedObjectExtended | null,
  TUnion extends AnyNestedUnion | null,
> = {
  readonly parent: TTypeName;
  readonly field: TFieldName;
  readonly type: TSpecifier;
  readonly args: TArgs;
  readonly directives: TDirectives;
  readonly object: TObject;
  readonly union: TUnion;
};

/** Convenience alias to obtain a typed field reference from the schema. */
export type FieldSelectionTemplateOf<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
  TRef extends OutputTypeSpecifier = TSchema["object"][TTypeName]["fields"][TFieldName],
> = AbstractFieldSelection<
  TTypeName,
  TFieldName,
  TRef,
  AssignableInputByFieldName<TSchema, TTypeName, TFieldName>,
  AnyDirectiveAttachments,
  TRef extends OutputObjectSpecifier ? AnyNestedObjectExtended : null,
  TRef extends OutputUnionSpecifier ? AnyNestedUnion : null
>;

/** Resolve the data shape produced by a set of field selections. */
export type InferFields<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = {
  [_ in TSchema["label"]]: {
    [TAliasName in keyof TFields]: InferField<TSchema, TFields[TAliasName]>;
  } & {};
}[TSchema["label"]];

/** Resolve the data shape for a single field reference, including nested objects/unions. */
export type InferField<TSchema extends AnyGraphqlSchema, TSelection extends AnyFieldSelection> =
  | (TSelection extends {
      type: infer TSpecifier extends OutputObjectSpecifier;
      object: infer TNested extends AnyNestedObjectExtended;
    }
      ? ApplyTypeModifier<
          InferFieldsExtended<TSchema, TSpecifier["name"], TNested>,
          TSpecifier["modifier"]
        >
      : never)
  | (TSelection extends {
      type: infer TSpecifier extends OutputUnionSpecifier;
      union: infer TNested extends AnyNestedUnion;
    }
      ? ApplyTypeModifier<
          {
            [TTypename in keyof TNested]: undefined extends TNested[TTypename]
              ? never
              : InferFieldsExtended<
                  TSchema,
                  TTypename & (keyof TSchema["object"] & string),
                  NonNullable<TNested[TTypename]> & AnyFieldsExtended
                >;
          }[keyof TNested],
          TSpecifier["modifier"]
        >
      : never)
  | (TSelection extends {
      type: infer TSpecifier extends OutputInferrableTypeSpecifier;
    }
      ? GetModifiedType<InferOutputProfile<TSchema, TSpecifier>, TSpecifier["modifier"]>
      : never);

// ============================================================================
// Shorthand Syntax Support (RFC: Field Selection Shorthand)
// ============================================================================

/**
 * Shorthand value for scalar/enum fields without args or directives.
 * Only `true` is valid - use factory syntax for args/directives.
 */
export type ScalarShorthand = true;

/**
 * Field value: either shorthand (true) or factory return (AnyFieldSelection)
 */
export type AnyFieldValue = AnyFieldSelection | ScalarShorthand;

/**
 * Extended field map supporting both shorthand and factory syntax.
 * Detection is value-based: `true` for shorthand, object for factory.
 */
export type AnyFieldsExtended = {
  readonly [key: string]: AnyFieldValue;
};

/**
 * Extract required keys from an object type.
 * A key is required if {} doesn't extend Pick<T, K>.
 */
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Check if a field has no required arguments.
 */
type HasNoRequiredArgs<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
> = keyof RequiredKeys<AssignableInputByFieldName<TSchema, TTypeName, TFieldName>> extends never ? true : false;

/**
 * Validate that shorthand `true` is only used for fields without required arguments.
 * Fields with required arguments must use factory syntax.
 */
type ValidateShorthand<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends string,
  TValue,
> = TValue extends true
  ? TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string
    ? HasNoRequiredArgs<TSchema, TTypeName, TFieldName> extends true
      ? true
      : never // Type error: field has required arguments, use factory syntax
    : never
  : TValue;

/**
 * Infer the output type for a scalar/enum field by looking up the schema.
 * Used for shorthand syntax where field type info is not embedded in the value.
 */
type InferScalarFieldByName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName] extends infer TSpecifier extends OutputInferrableTypeSpecifier
  ? GetModifiedType<InferOutputProfile<TSchema, TSpecifier>, TSpecifier["modifier"]>
  : never;

/**
 * Infer the output type for a single field value (shorthand or factory return).
 */
type InferFieldValue<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldKey extends string,
  TValue,
> = TValue extends true
  ? TFieldKey extends keyof TSchema["object"][TTypeName]["fields"] & string
    ? ValidateShorthand<TSchema, TTypeName, TFieldKey, TValue> extends true
      ? InferScalarFieldByName<TSchema, TTypeName, TFieldKey>
      : never
    : never
  : TValue extends AnyFieldSelection
    ? InferField<TSchema, TValue>
    : never;

/**
 * Infer fields with shorthand support.
 * Requires TTypeName to look up field types when value is shorthand (true).
 */
export type InferFieldsExtended<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFieldsExtended,
> = {
  [_ in TSchema["label"]]: {
    [K in keyof TFields]: InferFieldValue<TSchema, TTypeName, K & string, TFields[K]>;
  } & {};
}[TSchema["label"]];
