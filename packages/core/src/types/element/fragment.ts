/**
 * Fragment types for reusable field selections.
 * @module
 */

import type { OptionalArg } from "../../utils/empty-object";
import type { AnyAssignableInput, AnyFieldsExtended, AssignableInputFromVarDefs, InferFieldsExtended } from "../fragment";
import type { AnyGraphqlSchema } from "../schema";
import type { VariableDefinitions } from "../type-foundation";
import { GqlElement } from "./gql-element";

/**
 * Type alias for any Fragment instance.
 */
export type AnyFragment = Fragment<string, any, AnyFieldsExtended, any>;

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
  TFields extends Partial<AnyFieldsExtended>,
> {
  readonly typename: TTypeName;
  readonly key: string | undefined;
  readonly schemaLabel: string;
  readonly variableDefinitions: VariableDefinitions;
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
 */
export class Fragment<
    TTypeName extends string,
    TVariables extends Partial<AnyAssignableInput> | void,
    TFields extends Partial<AnyFieldsExtended>,
    TOutput extends object,
  >
  extends GqlElement<FragmentArtifact<TTypeName, TVariables, TFields>, FragmentInferMeta<TVariables, TOutput>>
  implements FragmentArtifact<TTypeName, TVariables, TFields>
{
  private declare readonly [__FRAGMENT_BRAND__]: void;

  private constructor(define: () => FragmentArtifact<TTypeName, TVariables, TFields>) {
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

  /** The schema label this fragment belongs to. */
  public get schemaLabel() {
    return GqlElement.get(this).schemaLabel;
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
    TVariableDefinitions extends VariableDefinitions,
    TFields extends AnyFieldsExtended,
  >(
    define: () => {
      typename: TTypeName;
      key: string | undefined;
      schemaLabel: TSchema["label"];
      variableDefinitions: TVariableDefinitions;
      spread: (variables: OptionalArg<AssignableInputFromVarDefs<TSchema, TVariableDefinitions>>) => TFields;
    },
  ) {
    type Fields = TFields & { [key: symbol]: never };
    type Output = InferFieldsExtended<TSchema, TTypeName, TFields> & { [key: symbol]: never };
    type Variables = OptionalArg<AssignableInputFromVarDefs<TSchema, TVariableDefinitions>>;

    return new Fragment<TTypeName, Variables, Fields, Output>(define as () => FragmentArtifact<TTypeName, Variables, Fields>);
  }
}
