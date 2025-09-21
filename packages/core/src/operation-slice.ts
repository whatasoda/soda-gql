import { createFieldFactories } from "./fields-builder";
import { evaluateSelections } from "./slice-result-selection";
import {
  type AnyFields,
  type AnyGraphqlSchema,
  type AnySliceResultSelections,
  type AnyVariableDefinition,
  type EmptyObject,
  type FieldsBuilder,
  type GraphqlAdapter,
  type OperationSlice,
  type OperationSliceFn,
  type OperationType,
  SliceResultSelection,
  type SliceResultSelectionsBuilder,
  type VariableReferencesByDefinition,
  type VoidIfEmptyObject,
} from "./types";
import { createVariableAssignments } from "./variables";

export const createOperationSliceFactory =
  <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(schema: TSchema, _adapter: TAdapter) =>
  <TOperation extends OperationType>(operation: TOperation) => {
    type TTypeName = TSchema["operations"][TOperation] & keyof TSchema["object"];
    const operationTypeName: TTypeName = schema.operations[operation];

    const sliceFn: OperationSliceFn<TSchema, TAdapter, TOperation, TTypeName> = <
      TFields extends AnyFields,
      TSelection extends AnySliceResultSelections<TAdapter>,
      TVariables extends AnyVariableDefinition = EmptyObject,
    >(
      variableDefinitionsAndExtras: [TVariables?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
      selectionBuilder: SliceResultSelectionsBuilder<TSchema, TAdapter, TFields, TSelection>,
    ) => {
      const variableDefinitions = (variableDefinitionsAndExtras?.[0] ?? {}) as TVariables;

      return (variables: VoidIfEmptyObject<TVariables> | VariableReferencesByDefinition<TSchema, TVariables>) => {
        const $ = createVariableAssignments<TSchema, TVariables>(variableDefinitions, variables);
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
