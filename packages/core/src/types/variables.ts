import type { AnyGraphqlSchema, InferByTypeRef, InferInputDefinitionType } from "./schema";
import type {
  EnumRef,
  InputDefinition,
  InputTypeRef,
  ListTypeFormat,
  ScalarRef,
  TypeRefMappingWithFlags,
  UnwrapListTypeRef,
} from "./type-ref";
import { type Hidden, hidden } from "./utility";

type AnyScalarValue = string | number | boolean | null | undefined;
type AnyEnumValue = string | undefined | null;
export type AnyVariableAssignments = {
  [key: string]:
    | (AnyVariableAssignments | AnyVariableReference | AnyScalarValue | AnyEnumValue)
    | (AnyVariableAssignments | AnyVariableReference | AnyScalarValue | AnyEnumValue)[];
};

type AnyVariableReference = VariableReference<
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  any,
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  any
>;

declare const __VARIABLE_REFERENCE_BRAND__: unique symbol;
export class VariableReference<TSchema extends AnyGraphqlSchema, TRef extends InputDefinition> {
  [__VARIABLE_REFERENCE_BRAND__]: Hidden<{
    type: InferInputDefinitionType<TSchema, TRef>;
    kind: TRef["kind"];
    name: TRef["name"];
  }> = hidden();

  constructor(public readonly name: string) {}
}

type AssignableVariable<TSchema extends AnyGraphqlSchema, TRef extends InputDefinition> =
  | VariableReference<TSchema, TRef>
  | (TRef extends { format: ListTypeFormat }
      ? AssignableVariable<TSchema, UnwrapListTypeRef<TRef>>[]
      :
          | (TRef extends InputTypeRef ? AssignableVariableNested<TSchema, TRef["name"]> : never)
          | (TRef extends ScalarRef | EnumRef ? InferByTypeRef<TSchema, TRef> : never));

type AssignableVariableNested<TSchema extends AnyGraphqlSchema, TInputType extends keyof TSchema["input"]> = {
  [K in keyof TypeRefMappingWithFlags<TSchema["input"][TInputType]["fields"]>]: AssignableVariable<
    TSchema,
    TSchema["input"][TInputType]["fields"][K]
  >;
};

export type VariableReferencesByDefinition<
  TSchema extends AnyGraphqlSchema,
  TDefinition extends { [key: string]: InputDefinition },
> = {
  [K in keyof TypeRefMappingWithFlags<TDefinition>]: AssignableVariable<TSchema, TDefinition[K]>;
};

export type VariableReferencesByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = VariableReferencesByDefinition<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
