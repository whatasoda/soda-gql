import { gqlRuntime } from "../runtime";
import {
  type AnyExecutionResultProjections,
  type AnyFields,
  type AnyGraphqlSchema,
  type AssignableInput,
  type EmptyObject,
  type FieldsBuilder,
  type GraphqlAdapter,
  hidden,
  type InputTypeRefs,
  type OperationSlice,
  type OperationSliceFn,
  type OperationType,
  type SliceResultProjectionsBuilder,
  type VoidIfEmptyObject,
} from "../types";
import { createFieldFactories } from "./fields-builder";
import { createVariableAssignments } from "./input";

export const createOperationSliceFactory =
  <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(schema: TSchema, _adapter: TAdapter) =>
  <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"];
    const operationTypeName: TTypeName = schema.operations[operationType];

    const sliceFn: OperationSliceFn<TSchema, TAdapter, TOperationType, TTypeName> = <
      TFields extends AnyFields,
      TProjection extends AnyExecutionResultProjections<TAdapter>,
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      variableDefinitionsAndExtras: [TVariableDefinitions?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariableDefinitions, TFields>,
      projectionBuilder: SliceResultProjectionsBuilder<TSchema, TAdapter, TFields, TProjection>,
    ) => {
      const variableDefinitions = (variableDefinitionsAndExtras?.[0] ?? {}) as TVariableDefinitions;
      const getProjections = gqlRuntime.wrapProjectionBuilder(projectionBuilder);

      return (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => {
        const $ = createVariableAssignments<TSchema, TVariableDefinitions>(variableDefinitions, variables);
        const fieldFactories = createFieldFactories(schema, operationTypeName);
        const fields = builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $,
        });

        const slice: OperationSlice<TSchema, TAdapter, TOperationType, TFields, TProjection, TVariableDefinitions> = {
          _output: hidden(),
          operationType,
          variables: (variables ?? {}) as AssignableInput<TSchema, TVariableDefinitions>,
          getFields: () => fields,
          getProjections,
        };

        return slice;
      };
    };

    return sliceFn;
  };
