/** Canonical field selection types used by models and slices. */

import type { Prettify } from "../../utils/prettify";
import type {
  AnyFieldName,
  AnyGraphqlSchema,
  AnyTypeName,
  ApplyTypeModifier,
  InferOutputTypeRef,
  OutputInferrableTypeSpecifier,
  OutputObjectSpecifier,
  OutputTypeSpecifier,
  OutputUnionSpecifier,
  PickTypeSpecifierByFieldName,
} from "../schema";
import type { AnyAssignableInput, AssignableInputByFieldName } from "./assignable-input";
import type { AnyDirectiveAttachments } from "./directives";

/**
 * Canonical representation of the field selections we collect during model and
 * slice definition. Each alias maps to a typed field reference that still
 * remembers its parent type, arguments, directives, and nested selections.
 */
export type AnyFieldSelection = {
  readonly parent: AnyTypeName;
  readonly field: AnyFieldName;
  readonly type: OutputTypeSpecifier;
  readonly args: AnyAssignableInput;
  readonly directives: AnyDirectiveAttachments;
  readonly object: AnyNestedObject | null;
  readonly union: AnyNestedUnion | null;
};

/** Nested selection produced when resolving an object field. */
export type AnyNestedObject = { readonly [alias: string]: AnyFieldSelection };
/** Nested selection produced when resolving a union field. */
export type AnyNestedUnion = { readonly [typeName: string]: AnyNestedObject | undefined };

/** Map of alias → field reference used by builders and inference. */
export type AnyFields = {
  readonly [alias: string]: AnyFieldSelection;
};

/** Strongly typed field reference produced for concrete schema members. */
export type AbstractFieldSelection<
  TTypeName extends AnyTypeName,
  TFieldName extends AnyFieldName,
  TRef extends OutputTypeSpecifier,
  TArgs extends AnyAssignableInput,
  TDirectives extends AnyDirectiveAttachments,
  TExtras extends { object: AnyNestedObject } | { union: AnyNestedUnion } | { _?: never },
> = {
  readonly parent: TTypeName;
  readonly field: TFieldName;
  readonly type: TRef;
  readonly args: TArgs;
  readonly directives: TDirectives;
  readonly object: TExtras extends { object: infer TObject } ? TObject : null;
  readonly union: TExtras extends { union: infer TUnion } ? TUnion : null;
};

/** Convenience alias to obtain a typed field reference from the schema. */
export type FieldSelectionTemplateOf<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
> = PickTypeSpecifierByFieldName<TSchema, TTypeName, TFieldName> extends infer TRef extends OutputTypeSpecifier
  ? AbstractFieldSelection<
      TTypeName,
      TFieldName,
      TRef,
      AssignableInputByFieldName<TSchema, TTypeName, TFieldName>,
      AnyDirectiveAttachments,
      | (TRef extends OutputObjectSpecifier ? { object: AnyNestedObject } : never)
      | (TRef extends OutputUnionSpecifier ? { union: AnyNestedUnion } : never)
    >
  : never;

/** Resolve the data shape produced by a set of field selections. */
export type InferFields<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = {
  readonly [TAliasName in keyof TFields]: InferField<TSchema, TFields[TAliasName]>;
};

/** Resolve the data shape for a single field reference, including nested objects/unions. */
export type InferField<TSchema extends AnyGraphqlSchema, TSelection extends AnyFieldSelection> =
  | (TSelection extends {
      type: infer TRef extends OutputObjectSpecifier;
      object: infer TNested extends AnyNestedObject;
    }
      ? ApplyTypeModifier<TRef["modifier"], InferFields<TSchema, TNested>>
      : never)
  | (TSelection extends {
      type: infer TRef extends OutputUnionSpecifier;
      union: infer TNested extends AnyNestedUnion;
    }
      ? ApplyTypeModifier<
          TRef["modifier"],
          {
            [TTypename in keyof TNested]: undefined extends TNested[TTypename]
              ? never
              : InferFields<TSchema, NonNullable<TNested[TTypename]>>;
          }[keyof TNested]
        >
      : never)
  | (TSelection extends {
      type: infer TRef extends OutputInferrableTypeSpecifier;
    }
      ? InferOutputTypeRef<TSchema, TRef>
      : never);
