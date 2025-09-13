/**
 * Field Selection type definitions
 * Copied from spec - not imported from /specs directory
 *
 * @see docs/decisions/004-typename-based-relations.md for design rationale
 *
 * Key concepts:
 * - Nested types are identified by presence of __typename in the target type
 * - Regular objects (no __typename) can only be selected with boolean
 * - Arrays are automatically unwrapped for field selection
 * - Nested types can be nested at any level
 */

import type { Hidden } from "./hidden";

/**
 * Helper type to unwrap array types for field selection
 * For arrays, we want to select fields of the element type, not the array itself
 */
type NormalizeType<T> = NormalizeTypeInner<NonNullable<T>>;
type NormalizeTypeInner<T> = T extends T ? (T extends ReadonlyArray<infer U> ? U : T) : never;

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Helper type to check if a type has __typename (making it a nested type)
 */
type HasTypename<T> = T extends { __typename?: string } ? true : false;

/**
 * Helper type to extract __typename field from a type
 * Accepts both required and optional __typename fields
 */
type ExtractTypename<T> = T extends { __typename?: infer U extends string }
  ? NonNullable<U>
  : never;

/**
 * Helper type to extract fields that are nested types (have __typename)
 */
type ExtractObjectTypeNestedFields<T> = {
  [K in keyof T as HasTypename<NormalizeType<T[K]>> extends true ? K : never]: T[K];
};

/**
 * Helper type to extract fields that are not nested types (no __typename)
 */
type ExtractObjectTypeScalarFields<T> = {
  [K in keyof T as HasTypename<NormalizeType<T[K]>> extends false ? K : never]: T[K];
};

type TypeInfo<T> = {
  type: NormalizeType<T>;
  list: NonNullable<T> extends ReadonlyArray<infer _> ? true : false;
  nonNull: true extends (null extends T ? true : false) | (undefined extends T ? true : false)
    ? boolean // may change to false
    : true;
};

type FromTypeInfo<
  // biome-ignore lint/suspicious/noExplicitAny: generic constraint for type info
  TInfo extends TypeInfo<any>,
  TType = TInfo extends { type: infer T } ? T : never,
> = TInfo extends { list: true }
  ? TInfo extends { nonNull: true }
    ? TType[]
    : TType[] | null | undefined
  : TInfo extends { nonNull: true }
    ? TType
    : TType | null | undefined;

declare const __input_object_name_DO_NOT_FILL_ANY_VALUE: unique symbol;
type InputObjectName<TName extends string> = TName & {
  [__input_object_name_DO_NOT_FILL_ANY_VALUE]: true;
};
type InputObject<T extends object, TName extends string> = T & {
  __input_object_name?: InputObjectName<TName>;
};
type ExtractInputObjectNestedFields<T> = {
  [K in Exclude<keyof T, "__input_object_name"> as T[K] extends InputObject<infer _0, infer _1>
    ? K
    : never]: T[K];
};
type ExtractInputObjectScalarFields<T> = {
  [K in keyof T as T[K] extends InputObject<infer _0, infer _1> ? never : K]: T[K];
};

type FieldArgRef<T> = {
  readonly _type: Hidden<TypeInfo<T>>;

  kind: "scalar" | "input";

  typeName: string;
};

export type FieldArgs<T> = {
  [K in keyof ExtractInputObjectScalarFields<T>]: FieldArgRef<T[K]>;
} & {
  [K in keyof ExtractInputObjectNestedFields<T>]:
    | FieldArgRef<T[K]>
    | (T[K] extends InputObject<infer U, infer _0> ? FieldArgs<U> : never);
};

/**
 * Helper type to check if a type is a union type
 */
export type IsUnionType<T> = IsUnionTypeInner<
  ExtractTypename<NormalizeType<T>>,
  ExtractTypename<NormalizeType<T>>
>;
type IsUnionTypeInner<TEach, TAll> = true extends (
  TEach extends TEach
    ? TAll extends TEach
      ? false
      : true
    : never
)
  ? true
  : false;

export type ObjectTypeScalarSelection<T, K extends keyof T> = {
  readonly _type: Hidden<TypeInfo<T[K]>>;

  key: K;

  // biome-ignore lint/suspicious/noExplicitAny: field arguments can be any type
  args: FieldArgs<any>;

  // biome-ignore lint/suspicious/noExplicitAny: directives can have any value
  directives: Record<string, any>;
};

export type ObjectTypeNestedSelection<T, K extends keyof T> = {
  readonly _type: Hidden<TypeInfo<T[K]>>;

  key: K;

  // biome-ignore lint/suspicious/noExplicitAny: field arguments can be any type
  args: FieldArgs<any>;

  // biome-ignore lint/suspicious/noExplicitAny: directives can have any value
  directives: Record<string, any>;

  selection: ObjectTypeNestedSelectionSelection<NormalizeType<T[K]>>;
};

type ObjectTypeNestedSelectionSelection<T> = T extends T
  ? { [_ in ExtractTypename<T>]: FieldSelection<T> }
  : never;

/**
 * Field selection for GraphQL types with deep/nested traversal support
 * Nested types are identified by presence of __typename in the target type
 * For array relations, the selection applies to each element
 * Requires __typename to be defined in the type (either required or optional)
 * Always supports deep selection through relations
 */
// biome-ignore lint/suspicious/noExplicitAny: generic default for type utility
export type FieldSelection<T = any> = {
  [alias: string]:
    | {
        // Scalar fields (no __typename in target type)
        [K in keyof ExtractObjectTypeScalarFields<T>]-?: ObjectTypeScalarSelection<T, K>;
      }[keyof ExtractObjectTypeScalarFields<T>]
    | {
        // Nested type fields (have __typename in target type) with deep traversal
        // Arrays are unwrapped so selection applies to elements
        [K in keyof ExtractObjectTypeNestedFields<T>]-?: ObjectTypeNestedSelection<T, K>;
      }[keyof ExtractObjectTypeNestedFields<T>];
};

/**
 * Utility type for extracting selected fields from a type
 */
export type SelectedFields<TSelection> = Prettify<{
  [K in keyof TSelection]: TSelection[K] extends {
    // biome-ignore lint/suspicious/noExplicitAny: generic constraint for type info
    _type: Hidden<infer TInfo extends TypeInfo<any>>;
  }
    ? FromTypeInfo<TInfo>
    : TSelection[K] extends {
          // biome-ignore lint/suspicious/noExplicitAny: generic constraint for type info
          _type: Hidden<infer TInfo extends TypeInfo<any>>;
          selection: infer TSubSelection;
        }
      ? FromTypeInfo<
          TInfo,
          { [K in keyof TSubSelection]: SelectedFields<TSubSelection[K]> }[keyof TSubSelection]
        >
      : never;
}>;

/**
 * Utility type for making fields optional
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making fields required
 */
export type RequiredFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
