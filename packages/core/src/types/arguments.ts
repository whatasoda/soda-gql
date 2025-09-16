import type { GraphqlSchema, InferByTypeRef, InferInputDefinitionType } from "./schema";
import type {
  EnumRef,
  InputDefinition,
  InputTypeRef,
  ListTypeFormat,
  TypeRefMappingWithFlags,
  UnwrapListTypeRef,
} from "./type-ref";

export type VariableReference<
  TSchema extends GraphqlSchema,
  TRef extends InputDefinition,
> = `${__VariableReference__<TSchema, TRef>}`;
type __VariableReference__<TSchema extends GraphqlSchema, TRef extends InputDefinition> = `$${string}` &
  VariableReferenceBrand<TSchema, TRef>;
type VariableReferenceBrand<TSchema extends GraphqlSchema, TRef extends InputDefinition> = () => {
  type: InferInputDefinitionType<TSchema, TRef>;
  kind: TRef["kind"];
  name: TRef["name"];
};

export type ArgumentAssignments<TSchema extends GraphqlSchema, TRefMapping extends { [key: string]: InputDefinition }> = {
  [K in keyof TypeRefMappingWithFlags<TRefMapping>]: ArgumentAssignmentItem<TSchema, TRefMapping[K]>;
};

type ArgumentAssignmentItem<TSchema extends GraphqlSchema, TRef extends InputDefinition> =
  | VariableReference<TSchema, TRef>
  | (TRef extends { format: ListTypeFormat }
      ? ArgumentAssignmentItem<TSchema, UnwrapListTypeRef<TRef>>[]
      :
          | (TRef extends InputTypeRef ? ArgumentAssignmentItemNested<TSchema, TRef["name"]> : never)
          | (TRef extends EnumRef ? InferByTypeRef<TSchema, TRef> : never));

type ArgumentAssignmentItemNested<TSchema extends GraphqlSchema, TInputType extends keyof TSchema["input"]> = {
  [K in keyof TypeRefMappingWithFlags<TSchema["input"][TInputType]["fields"]>]: ArgumentAssignmentItem<
    TSchema,
    TSchema["input"][TInputType]["fields"][K]
  >;
};
