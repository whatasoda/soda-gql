import { handleProjectionBuilder } from "../runtime/slice";
import {
  type ExecutionResultProjectionsBuilder,
  type FieldsBuilder,
  type MergeFields,
  mergeFields,
  Slice,
} from "../types/element";
import type { AnyFields } from "../types/fragment";
import type { AnyGraphqlRuntimeAdapter, AnyProjection } from "../types/runtime";
import type { AnyGraphqlSchema, InputTypeSpecifiers, OperationType } from "../types/schema";

import { createFieldFactories } from "./fields-builder";
import { createVarAssignments, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createSliceComposerFactory = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  schema: NoInfer<TSchema>,
) => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName: TTypeName | null = schema.operations[operationType];
    if (operationTypeName === null) {
      throw new Error(`Operation type ${operationType} is not defined in schema roots`);
    }

    return <
      TFieldEntries extends AnyFields[],
      TProjection extends AnyProjection,
      TVarDefinitions extends InputTypeSpecifiers[] = [{}],
    >(
      options: {
        variables?: TVarDefinitions;
      },
      fieldBuilder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
      projectionBuilder: ExecutionResultProjectionsBuilder<TSchema, TRuntimeAdapter, MergeFields<TFieldEntries>, TProjection>,
    ) =>
      Slice.create<TSchema, TOperationType, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>, TProjection>(() => {
        const varDefinitions = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        const projection = handleProjectionBuilder(projectionBuilder);

        return {
          operationType,
          embed: (variables) => {
            const f = createFieldFactories(schema, operationTypeName);
            const $ = createVarAssignments(varDefinitions, variables);
            const fields = mergeFields(fieldBuilder({ f, $ }));
            return { variables, getFields: () => fields, projection };
          },
        };
      });
  };
};
