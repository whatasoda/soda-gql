/** Canonical field selection types used by models and slices. */

import type { AnyFieldName, AnyGraphqlSchema, AnyTypeName, InferOutputProfile } from "../schema";
import type {
  ApplyTypeModifier,
  DeferredOutputFieldWithArgs,
  DeferredOutputInferrableSpecifier,
  DeferredOutputSpecifier,
  GetModifiedType,
  GetSpecKind,
  GetSpecModifier,
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
  readonly type: DeferredOutputFieldWithArgs;
  readonly args: AnyAssignableInput;
  readonly directives: AnyDirectiveAttachments;
  readonly object: AnyNestedObjectExtended | null;
  readonly union: AnyUnionSelection | null;
};

/** Nested selection produced when resolving an object field (factory syntax only). */
export type AnyNestedObject = { readonly [alias: string]: AnyFieldSelection };

/** Nested selection supporting shorthand syntax. */
export type AnyNestedObjectExtended = { readonly [alias: string]: AnyFieldValue };
/**
 * Nested selection produced when resolving a union field. Supports shorthand syntax.
 * Maps union member type names to their field selections.
 */
export type AnyNestedUnion = {
  readonly [typeName: string]: AnyNestedObjectExtended | undefined;
};

/**
 * Structured union selection with explicit __typename flag.
 * Separates member selections from the __typename discriminator flag for reliable type inference.
 */
export type UnionSelection<TSelections extends AnyNestedUnion, TTypename extends boolean> = {
  readonly selections: TSelections;
  readonly __typename: TTypename;
};

/** Type-erased union selection */
export type AnyUnionSelection = UnionSelection<AnyNestedUnion, boolean>;

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
  TSpecifier extends DeferredOutputFieldWithArgs,
  TArgs extends AnyAssignableInput,
  TDirectives extends AnyDirectiveAttachments,
  TObject extends AnyNestedObjectExtended | null,
  TUnionSelections extends AnyNestedUnion | null,
  TUnionTypename extends boolean,
> = {
  readonly parent: TTypeName;
  readonly field: TFieldName;
  readonly type: TSpecifier;
  readonly args: TArgs;
  readonly directives: TDirectives;
  readonly object: TObject;
  readonly union: TUnionSelections extends AnyNestedUnion ? UnionSelection<TUnionSelections, TUnionTypename> : null;
};

/** Convenience alias to obtain a typed field reference from the schema. */
export type FieldSelectionTemplateOf<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
  TRef extends DeferredOutputFieldWithArgs = TSchema["object"][TTypeName]["fields"][TFieldName],
> = AbstractFieldSelection<
  TTypeName,
  TFieldName,
  TRef,
  AssignableInputByFieldName<TSchema, TTypeName, TFieldName>,
  AnyDirectiveAttachments,
  GetSpecKind<TRef["spec"]> extends "object" ? AnyNestedObjectExtended : null,
  GetSpecKind<TRef["spec"]> extends "union" ? AnyNestedUnion : null,
  boolean // TUnionTypename - will be refined by factory return type
>;

/** Resolve the data shape produced by a set of field selections. */
export type InferFields<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = {
  [_ in TSchema["label"]]: {
    [TAliasName in keyof TFields]: InferField<TSchema, TFields[TAliasName]>;
  } & {};
}[TSchema["label"]];

/**
 * Remove index signature from a type, keeping only literal string keys.
 * This is needed for inferring union selections where we want to iterate over explicit member keys.
 */
type RemoveIndexSignature<T> = {
  [K in keyof T as string extends K ? never : K]: T[K];
};

/**
 * Infer union type with __typename for all members when __typename: true is set.
 * Selected members get their fields + __typename, unselected members get only __typename.
 */
type InferUnionWithTypename<
  TSchema extends AnyGraphqlSchema,
  TUnionName extends keyof TSchema["union"] & string,
  TSelections extends AnyNestedUnion,
  TSelectionsClean = RemoveIndexSignature<TSelections>,
> = {
  [TTypename in keyof TSchema["union"][TUnionName]["types"] & string]: TTypename extends keyof TSelectionsClean
    ? TSelectionsClean[TTypename] extends infer TFields extends AnyNestedObjectExtended
      ? InferFieldsExtended<TSchema, TTypename & (keyof TSchema["object"] & string), TFields> & {
          readonly __typename: TTypename;
        }
      : { readonly __typename: TTypename }
    : { readonly __typename: TTypename };
}[keyof TSchema["union"][TUnionName]["types"] & string];

/**
 * Infer union type without __typename catch-all (original behavior).
 * Only includes members that have explicit selections.
 */
type InferUnionWithoutTypename<
  TSchema extends AnyGraphqlSchema,
  TSelections extends AnyNestedUnion,
  TSelectionsClean = RemoveIndexSignature<TSelections>,
> = {
  [TTypename in keyof TSelectionsClean]: TSelectionsClean[TTypename] extends infer TFields extends AnyNestedObjectExtended
    ? InferFieldsExtended<TSchema, TTypename & (keyof TSchema["object"] & string), TFields>
    : never;
}[keyof TSelectionsClean];

/** Resolve the data shape for a single field reference, including nested objects/unions. */
export type InferField<
  TSchema extends AnyGraphqlSchema,
  TSelection extends AnyFieldSelection,
> = TSelection["type"]["spec"] extends infer TSpec extends DeferredOutputSpecifier // Extract spec string from field type
  ?
      | (TSpec extends `o|${infer TName extends string}|${string}`
          ? TSelection extends { object: infer TNested extends AnyNestedObjectExtended }
            ? ApplyTypeModifier<InferFieldsExtended<TSchema, TName, TNested>, GetSpecModifier<TSpec>>
            : never
          : never)
      | (TSpec extends `u|${infer TUnionName extends keyof TSchema["union"] & string}|${string}`
          ? TSelection extends { union: infer TUnion extends AnyUnionSelection }
            ? ApplyTypeModifier<
                TUnion["__typename"] extends true
                  ? InferUnionWithTypename<TSchema, TUnionName, TUnion["selections"]>
                  : InferUnionWithoutTypename<TSchema, TUnion["selections"]>,
                GetSpecModifier<TSpec>
              >
            : never
          : never)
      | (TSpec extends DeferredOutputInferrableSpecifier
          ? GetModifiedType<InferOutputProfile<TSchema, TSpec>, GetSpecModifier<TSpec>>
          : never)
  : never;

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
> = TSchema["object"][TTypeName]["fields"][TFieldName] extends infer TSpecifier extends DeferredOutputInferrableSpecifier
  ? GetModifiedType<InferOutputProfile<TSchema, TSpecifier>, GetSpecModifier<TSpecifier>>
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
