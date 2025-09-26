/** Model helper types mirroring the `gql.model` API. */

import type { AnyFields, InferFields } from "./fields";
import type { FieldsBuilder } from "./fields-builder";
import type { AssignableInput } from "./input-value";
import type { AnyGraphqlSchema } from "./schema";
import type { InputTypeRefs } from "./type-ref";
import type { EmptyObject, PseudoTypeAnnotation, VoidIfEmptyObject } from "./utility";

/**
 * Describes the userland `gql.model` helper. It binds a schema type, a field
 * selection builder, and a runtime transformer into a reusable fragment-like
 * construct that can later be injected into operations.
 */
export type ModelFn<TSchema extends AnyGraphqlSchema> = <
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFields,
  TTransformed extends object,
  TVariableDefinitions extends InputTypeRefs = EmptyObject,
>(
  target: TTypeName | [TTypeName, TVariableDefinitions],
  builder: FieldsBuilder<TSchema, TTypeName, TVariableDefinitions, TFields>,
  transform: (raw: NoInfer<InferFields<TSchema, TFields>>) => TTransformed,
) => NoInfer<Model<TSchema, TTypeName, TVariableDefinitions, TFields, TTransformed>>;

/** Internal representation returned by `gql.model`. */
export type Model<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TVariableDefinitions extends InputTypeRefs,
  TFields extends AnyFields,
  TTransformed extends object,
> = {
  _input: PseudoTypeAnnotation<AssignableInput<TSchema, TVariableDefinitions>>;
  _output: PseudoTypeAnnotation<TTransformed>;
  typename: TTypeName;
  fragment: (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => TFields;
  transform: (raw: InferFields<TSchema, TFields>) => TTransformed;
};
