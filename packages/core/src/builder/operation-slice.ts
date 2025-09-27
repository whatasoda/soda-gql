import { gqlRuntime } from "../runtime";
import {
  type AnyExecutionResultProjections,
  type AnyFields,
  type AnyGraphqlSchema,
  type AssignableInput,
  type EmptyObject,
  type FieldsBuilder,
  type GraphqlRuntimeAdapter,
  type InputTypeRefs,
  type OperationSlice,
  type OperationSliceFn,
  type OperationType,
  pseudoTypeAnnotation,
  type SliceResultProjectionsBuilder,
  type VoidIfEmptyObject,
} from "../types";
import { createFieldFactories } from "./fields-builder";
import { createVariableAssignments } from "./input";

export const createOperationSliceFactory =
  <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends GraphqlRuntimeAdapter>(schema: TSchema, _adapter: TRuntimeAdapter) =>
  <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"];
    const operationTypeName: TTypeName = schema.operations[operationType];

    const sliceFn: OperationSliceFn<TSchema, TRuntimeAdapter, TOperationType, TTypeName> = <
      TFields extends AnyFields,
      TProjection extends AnyExecutionResultProjections<TRuntimeAdapter>,
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      variableDefinitionsAndExtras: [TVariableDefinitions?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariableDefinitions, TFields>,
      projectionBuilder: SliceResultProjectionsBuilder<TSchema, TRuntimeAdapter, TFields, TProjection>,
    ) => {
      const variableDefinitions = (variableDefinitionsAndExtras?.[0] ?? {}) as TVariableDefinitions;
      const projections = gqlRuntime.handleProjectionBuilder(projectionBuilder);

      return (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => {
        const $ = createVariableAssignments<TSchema, TVariableDefinitions>(variableDefinitions, variables);
        const fieldFactories = createFieldFactories(schema, operationTypeName);
        const fields = builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $,
        });
        const rootFieldKeys = Object.keys(fields);

        const slice: OperationSlice<TSchema, TRuntimeAdapter, TOperationType, TFields, TProjection, TVariableDefinitions> = {
          _output: pseudoTypeAnnotation(),
          operationType,
          variables: (variables ?? {}) as AssignableInput<TSchema, TVariableDefinitions>,
          getFields: () => fields,
          rootFieldKeys,
          projections,
        };

        return slice;
      };
    };

    return sliceFn;
  };
