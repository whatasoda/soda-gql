import type {
  ArgumentAssignments,
  BuildTypeFromSelectedFields,
  FieldSelection,
  FieldSelectionMapping,
  InlineFragment,
  SelectedFields,
} from "./document";
import type { GraphqlSchema, InputDefinition } from "./schema";

export type ModelFn<TSchema extends GraphqlSchema> = <
  TTypename extends keyof TSchema["objects"],
  TVariables extends { [key: string]: InputDefinition },
  TSelected extends SelectedFields<TSchema, TTypename>,
  TTransformed extends object,
>(
  target: TTypename | [TTypename, TVariables],
  factory: ModelFactory<TSchema, TTypename, TVariables, TSelected>,
  transform: (selected: NoInfer<BuildTypeFromSelectedFields<TSchema, TTypename, TSelected>>) => TTransformed,
) => {
  typeName: TTypename;
  variables: TVariables;
  fields: FieldSelection<TSchema, TTypename>;
  transform: (selected: NoInfer<BuildTypeFromSelectedFields<TSchema, TTypename, TSelected>>) => TTransformed;
};

export type InlineModelFn<TSchema extends GraphqlSchema> = <
  TTypename extends keyof TSchema["objects"],
  TSelected extends SelectedFields<TSchema, TTypename>,
>(
  target: TTypename,
  factory: InlineModelFactory<TSchema, TTypename, TSelected>,
) => {
  [_ in TTypename]: {
    typeName: TTypename;
    fields: FieldSelection<TSchema, TTypename>;
  };
};

type ModelFactory<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TVariables extends { [key: string]: InputDefinition },
  TSelected extends SelectedFields<TSchema, TTypename>,
> = (tools: {
  fields: NoInfer<ModelFactoryFields<TSchema, TTypename>>;
  variables: NoInfer<ModelFactoryVariables<TSchema, TVariables>>;
}) => TSelected;

type InlineModelFactory<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TSelected extends SelectedFields<TSchema, TTypename>,
> = (tools: { fields: NoInfer<ModelFactoryFields<TSchema, TTypename>> }) => TSelected;

type ModelFactoryVariables<
  TSchema extends GraphqlSchema,
  TVariables extends { [key: string]: InputDefinition },
> = ArgumentAssignments<TSchema, TVariables>;

type ModelFactoryFields<TSchema extends GraphqlSchema, TTypename extends keyof TSchema["objects"]> = {
  [TField in keyof FieldSelectionMapping<TSchema, TTypename>]: ModelFactoryFieldsToolField<
    TSchema,
    TTypename,
    FieldSelectionMapping<TSchema, TTypename>[TField]
  >;
};

type ModelFactoryFieldsToolField<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TFieldSelectionTemplate extends FieldSelection<TSchema, TTypename>,
> = TFieldSelectionTemplate extends {
  nested: infer TNestedSelectionTemplate extends { [typename: string]: InlineFragment<TSchema, string> };
}
  ? <TNestedFieldSelection extends TNestedSelectionTemplate>(
      args:
        | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
        | TFieldSelectionTemplate["args"]
        | [args: TFieldSelectionTemplate["args"], directives: {}],
      selection: TNestedFieldSelection,
    ) => {
      [_ in TFieldSelectionTemplate["field"]]: {
        field: TFieldSelectionTemplate["field"];
        args: TFieldSelectionTemplate["args"];
        directives: TFieldSelectionTemplate["directives"];
        selection: TNestedFieldSelection;
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
