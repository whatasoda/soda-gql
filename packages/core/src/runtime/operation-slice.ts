import type { AnyExecutionResultProjectionsBuilder, AnyOperationSlice } from "../types/operation";
import { ExecutionResultProjection } from "../types/runtime";
import type { OperationType } from "../types/schema";
import { pseudoTypeAnnotation, type StripFunctions, type StripSymbols } from "../types/shared/utility";

export type RuntimeOperationSliceInput = {
  prebuild: StripFunctions<AnyOperationSlice<OperationType>>;
  runtime: {
    buildProjection: AnyExecutionResultProjectionsBuilder;
  };
};

export const handleProjectionBuilder = <TBuilder extends AnyExecutionResultProjectionsBuilder>(
  projectionBuilder: TBuilder,
): ReturnType<TBuilder> =>
  projectionBuilder({
    select: (path, projector) => new ExecutionResultProjection(path, projector),
  });

export const runtimeOperationSlice = (input: RuntimeOperationSliceInput) => {
  const projection = handleProjectionBuilder(input.runtime.buildProjection);
  return {
    operationType: input.prebuild.operationType,
    build: (variables) => ({
      variables,
      getFields: pseudoTypeAnnotation(),
      projection,
    }),
  } satisfies StripSymbols<AnyOperationSlice<OperationType>> as AnyOperationSlice<OperationType>;
};
