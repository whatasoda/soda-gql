import type {
  ArgumentAssignments,
  FieldSelection,
  FieldSelectionMapping,
  InferFromSelectedFields,
  SelectedFields,
} from "./document";
import type { GraphqlSchema, InputDefinition } from "./schema";

export type ModelFn<TSchema extends GraphqlSchema> = <
  TTypename extends keyof TSchema["object"],
  TVariables extends { [key: string]: InputDefinition },
  TSelected extends SelectedFields<TSchema, TTypename>,
  TTransformed extends object,
>(
  target: TTypename | [TTypename, TVariables],
  factory: ModelFactory<TSchema, TTypename, TVariables, TSelected>,
  transform: (selected: NoInfer<InferFromSelectedFields<TSchema, TTypename, TSelected>>) => TTransformed,
) => {
  typeName: TTypename;
  variables: TVariables;
  fields: TSelected;
  transform: (selected: NoInfer<InferFromSelectedFields<TSchema, TTypename, TSelected>>) => TTransformed;
};

export type InlineModelFn<TSchema extends GraphqlSchema> = <
  TTypename extends keyof TSchema["object"],
  TSelected extends SelectedFields<TSchema, TTypename>,
>(
  target: TTypename,
  factory: InlineModelFactory<TSchema, TTypename, TSelected>,
) => {
  [_ in TTypename]: {
    typename: TTypename;
    fields: TSelected;
  };
};

type ModelFactory<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TVariables extends { [key: string]: InputDefinition },
  TSelected extends SelectedFields<TSchema, TTypename>,
> = (tools: {
  fields: NoInfer<ModelFactoryFields<TSchema, TTypename>>;
  variables: NoInfer<ModelFactoryVariables<TSchema, TVariables>>;
}) => TSelected;

type InlineModelFactory<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TSelected extends SelectedFields<TSchema, TTypename>,
> = (tools: { fields: NoInfer<ModelFactoryFields<TSchema, TTypename>> }) => TSelected;

type ModelFactoryVariables<
  TSchema extends GraphqlSchema,
  TVariables extends { [key: string]: InputDefinition },
> = ArgumentAssignments<TSchema, TVariables>;

type ModelFactoryFields<TSchema extends GraphqlSchema, TTypename extends keyof TSchema["object"]> = {
  [TField in keyof FieldSelectionMapping<TSchema, TTypename>]: ModelFactoryFieldsToolField<TSchema, TTypename, TField>;
};

type ModelFactoryFieldsToolField<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TField extends keyof FieldSelectionMapping<TSchema, TTypename>,
  TFieldSelectionTemplate extends FieldSelection<TSchema, TTypename> = FieldSelectionMapping<TSchema, TTypename>[TField],
> = FieldSelectionMapping<TSchema, TTypename>[TField] extends {
  nested: infer TNestedSelectionTemplate;
}
  ? <TNestedFieldSelection extends TNestedSelectionTemplate>(
      args:
        | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
        | TFieldSelectionTemplate["args"]
        | [args: TFieldSelectionTemplate["args"], directives: {}],
      nested: TNestedFieldSelection,
    ) => {
      [_ in TFieldSelectionTemplate["field"]]: {
        field: TFieldSelectionTemplate["field"];
        args: TFieldSelectionTemplate["args"];
        directives: TFieldSelectionTemplate["directives"];
        nested: TNestedFieldSelection;
      };
    }
  : (
      args:
        | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
        | TFieldSelectionTemplate["args"]
        | [args: TFieldSelectionTemplate["args"], directives: {}],
    ) => {
      [_ in TFieldSelectionTemplate["field"]]: {
        field: TFieldSelectionTemplate["field"];
        args: TFieldSelectionTemplate["args"];
        directives: TFieldSelectionTemplate["directives"];
      };
    };

declare const phony: unique symbol;
type IsEmptyObject<T> = keyof (T & { [phony]: true }) extends typeof phony ? true : false;
// biome-ignore lint/suspicious/noConfusingVoidType: Need to use void to make argument optional
type VoidIfEmptyObject<T> = IsEmptyObject<T> extends true ? void : never;
