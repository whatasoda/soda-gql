import {
  type AnyFields,
  type AnyGraphqlSchema,
  type AnySliceResultSelections,
  type AssignableInput,
  type EmptyObject,
  type FieldsBuilder,
  type GraphqlAdapter,
  type InputTypeRefs,
  type OperationSlice,
  type OperationSliceFn,
  type OperationType,
  SliceResultSelection,
  type SliceResultSelectionsBuilder,
  type VoidIfEmptyObject,
} from "../types";
import { createFieldFactories } from "./fields-builder";
import { createVariableAssignments } from "./input";
import { evaluateSelections } from "./slice-result-selection";

export const createOperationSliceFactory =
  <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(schema: TSchema, _adapter: TAdapter) =>
  <TOperation extends OperationType>(operation: TOperation) => {
    type TTypeName = TSchema["operations"][TOperation] & keyof TSchema["object"];
    const operationTypeName: TTypeName = schema.operations[operation];

    const sliceFn: OperationSliceFn<TSchema, TAdapter, TOperation, TTypeName> = <
      TFields extends AnyFields,
      TSelection extends AnySliceResultSelections<TAdapter>,
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      variableDefinitionsAndExtras: [TVariableDefinitions?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariableDefinitions, TFields>,
      selectionBuilder: SliceResultSelectionsBuilder<TSchema, TAdapter, TFields, TSelection>,
    ) => {
      const variableDefinitions = (variableDefinitionsAndExtras?.[0] ?? {}) as TVariableDefinitions;

      return (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => {
        const $ = createVariableAssignments<TSchema, TVariableDefinitions>(variableDefinitions, variables);
        const fieldFactories = createFieldFactories(schema, operationTypeName);
        const fields = builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $,
        });

        const selections = selectionBuilder({ select: (path, projector) => new SliceResultSelection(path, projector) });

        const slice: OperationSlice<TAdapter, TOperation, TFields, TSelection> = {
          operation,
          object: fields,
          selections,
          transform: ({ results }) => evaluateSelections<TAdapter, TSelection>(selections, results),
        };

        return slice;
      };
    };

    return sliceFn;
  };
