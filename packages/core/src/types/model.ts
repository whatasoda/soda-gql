import type {
  ArgumentAssignments,
  BuildTypeFromSelectedFields,
  FieldSelection,
  FieldSelectionMapping,
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
) => {
  typeName: TTypename;
  variables: TVariables;
  fields: FieldSelectionMapping<TSchema, TTypename>;
  transform: (
    selected: NoInfer<BuildTypeFromSelectedFields<TSchema, TTypename, TSelected>>,
  ) => TTransformed;
};

type ModelFactory<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TVariables extends { [key: string]: InputDefinition },
  TSelected extends SelectedFields<TSchema, TTypename>,
> = (tools: NoInfer<ModelFactoryTools<TSchema, TTypename, TVariables>>) => TSelected;

type ModelFactoryTools<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TVariables extends { [key: string]: InputDefinition },
> = {
  fields: ModelFactoryFieldsTool<TSchema, TTypename>;
  variables: ArgumentAssignments<TSchema, TVariables>;
};

type ModelFactoryFieldsTool<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
> = {
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
> = TFieldSelectionTemplate extends { selection: infer TNestedSelectionTemplate }
  ? <TNestedFieldSelection extends TNestedSelectionTemplate>(
      args:
        | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
        | TFieldSelectionTemplate["args"]
        | [args: TFieldSelectionTemplate["args"], directives: {}],
      selection: TNestedFieldSelection | TNestedFieldSelection[],
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
