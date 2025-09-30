import { handleProjectionBuilder } from "../runtime/operation-slice";
import type { AnyFields } from "../types/fragment";
import { type ExecutionResultProjectionsBuilder, type FieldsBuilder, OperationSlice } from "../types/operation";
import type { AnyExecutionResultProjection, AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../types/schema";

import { createFieldFactories } from "./fields-builder";
import { createVarAssignments } from "./input";

export const createOperationSliceFactory = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  schema: NoInfer<TSchema>,
) => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName: TTypeName | null = schema.operations[operationType];
    const getFieldFactories = (() => {
      const get = () => {
        if (operationTypeName === null) {
          throw new Error(`Operation type ${operationType} is not defined in schema roots`);
        }

        return createFieldFactories(schema, operationTypeName);
      };

      let cache: ReturnType<typeof get> | null = null;
      return () => {
        if (cache === null) {
          cache = get();
        }
        return cache;
      };
    })();

    return <
      TFields extends AnyFields,
      TProjection extends AnyExecutionResultProjection,
      TVarDefinitions extends InputTypeRefs = {},
    >(
      options: {
        variables?: TVarDefinitions;
      },
      builder: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>,
      projectionBuilder: ExecutionResultProjectionsBuilder<TSchema, TRuntimeAdapter, TFields, TProjection>,
    ) => {
      return OperationSlice.create<TSchema, TOperationType, TVarDefinitions, TFields, TProjection>(() => {
        const varDefinitions = (options.variables ?? {}) as TVarDefinitions;
        const projection = handleProjectionBuilder(projectionBuilder);

        return {
          operationType,
          build: (variables) => {
            const $ = createVarAssignments<TSchema, TVarDefinitions>(varDefinitions, variables);
            const fieldFactories = getFieldFactories();
            const fields = builder({
              _: fieldFactories,
              f: fieldFactories,
              $,
            });
            return { variables, getFields: () => fields, projection };
          },
        };
      });
    };
  };
};
