/**
 * Fragment types for reusable field selections.
 * @module
 */

import type { OptionalArg } from "../../utils/empty-object";
import type { AnyAssignableInput, AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlSchema } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import { GqlElement } from "./gql-element";

/**
 * Type alias for any Fragment instance.
 */
export type AnyFragment = Fragment<string, any, AnyFields, any, string | undefined>;

/**
 * Type inference metadata for fragments.
 * Access via `typeof fragment.$infer`.
 */
export type FragmentInferMeta<TVariables, TOutput extends object> = {
  readonly input: TVariables;
  readonly output: TOutput;
};

/**
 * Internal artifact shape produced by fragment evaluation.
 * @internal
 */
interface FragmentArtifact<
  TTypeName extends string,
  TVariables extends Partial<AnyAssignableInput> | void,
  TFields extends Partial<AnyFields>,
  TKey extends string | undefined = undefined,
> {
  readonly typename: TTypeName;
  readonly key: TKey;
  readonly variableDefinitions: InputTypeSpecifiers;
  readonly spread: (variables: TVariables) => TFields;
}

declare const __FRAGMENT_BRAND__: unique symbol;

/**
 * Represents a reusable GraphQL field selection on a specific type.
 *
 * Fragments are created via `gql(({ fragment }) => fragment.TypeName({ ... }))`.
 * Use `spread()` to include the fragment's fields in an operation.
 *
 * @template TTypeName - The GraphQL type this fragment selects from
 * @template TVariables - Variables required when spreading
 * @template TFields - The selected fields structure
 * @template TOutput - Inferred output type from selected fields
 * @template TKey - Optional unique key for prebuilt type lookup
 */
export class Fragment<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFields>,
    TOutput extends object,
    TKey extends string | undefined = undefined,
  >
  extends GqlElement<FragmentArtifact<TTypeName, TVariables, TFields, TKey>, FragmentInferMeta<TVariables, TOutput>>
  implements FragmentArtifact<TTypeName, TVariables, TFields, TKey>
{
  private declare readonly [__FRAGMENT_BRAND__]: void;

  private constructor(define: () => FragmentArtifact<TTypeName, TVariables, TFields, TKey>) {
    super(define);
  }

  /** The GraphQL type name this fragment selects from. */
  public get typename() {
    return GqlElement.get(this).typename;
  }

  /** Optional unique key for prebuilt type lookup. */
  public get key() {
    return GqlElement.get(this).key;
  }

  /** Variable definitions for this fragment. */
  public get variableDefinitions() {
    return GqlElement.get(this).variableDefinitions;
  }

  /**
   * Spreads this fragment's fields into a parent selection.
   * Pass variables if the fragment defines any.
   */
  public get spread() {
    return GqlElement.get(this).spread;
  }

  /**
   * Creates a new Fragment instance.
   * Prefer using the `gql(({ fragment }) => ...)` API instead.
   * @internal
   */
  static create<
    TSchema extends AnyGraphqlSchema,
    TTypeName extends keyof TSchema["object"] & string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TKey extends string | undefined = undefined,
  >(
    define: () => {
      typename: TTypeName;
      key: TKey;
      variableDefinitions: TVariableDefinitions;
      spread: (variables: OptionalArg<AssignableInput<TSchema, TVariableDefinitions>>) => TFields;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Output = InferFields<TSchema, TFields> & { [key: symbol]: never };
    type Variables = OptionalArg<AssignableInput<TSchema, TVariableDefinitions>>;

    return new Fragment<TTypeName, Variables, Fields, Output, TKey>(
      define as () => FragmentArtifact<TTypeName, Variables, Fields, TKey>,
    );
  }
}
