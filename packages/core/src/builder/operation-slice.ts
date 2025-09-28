import { handleProjectionBuilder } from "../runtime/operation-slice";
import {
  type AnyExecutionResultProjection,
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
    const getFieldFactories = (() => {
      const get = () => createFieldFactories(schema, operationTypeName);

      let cache: ReturnType<typeof get> | null = null;
      return () => {
        if (cache === null) {
          cache = get();
        }
        return cache;
      };
    })();

    const sliceFn: OperationSliceFn<TSchema, TRuntimeAdapter, TOperationType, TTypeName> = <
      TFields extends AnyFields,
      TProjection extends AnyExecutionResultProjection<TRuntimeAdapter>,
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      variableDefinitionsAndExtras: [TVariableDefinitions?],
      builder: FieldsBuilder<TSchema, TTypeName, TVariableDefinitions, TFields>,
      projectionBuilder: SliceResultProjectionsBuilder<TSchema, TRuntimeAdapter, TFields, TProjection>,
    ) => {
      const variableDefinitions = (variableDefinitionsAndExtras?.[0] ?? {}) as TVariableDefinitions;
      const projection = handleProjectionBuilder(projectionBuilder);

      return (variables: VoidIfEmptyObject<TVariableDefinitions> | AssignableInput<TSchema, TVariableDefinitions>) => {
        const $ = createVariableAssignments<TSchema, TVariableDefinitions>(variableDefinitions, variables);
        const fieldFactories = getFieldFactories();
        const fields = builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $,
        });

        const slice: OperationSlice<TSchema, TRuntimeAdapter, TOperationType, TFields, TProjection, TVariableDefinitions> = {
          _metadata: pseudoTypeAnnotation(),
          _output: pseudoTypeAnnotation(),
          variables: (variables ?? {}) as AssignableInput<TSchema, TVariableDefinitions>,
          getFields: () => fields,
          projection,
        };

        return slice;
      };
    };

    return sliceFn;
  };
