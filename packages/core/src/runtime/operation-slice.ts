import type { AnyExecutionResultProjectionsBuilder, AnyOperationSliceOf } from "../types/operation";
import { ExecutionResultProjection } from "../types/runtime";
import type { OperationType } from "../types/schema";
import { hidden } from "../types/shared/hidden";
import type { StripFunctions, StripSymbols } from "../types/shared/utility";

export type RuntimeOperationSliceInput = {
  prebuild: StripFunctions<AnyOperationSliceOf<OperationType>>;
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

export const createRuntimeOperationSlice = (input: RuntimeOperationSliceInput) => {
  const projection = handleProjectionBuilder(input.runtime.buildProjection);
  return {
    operationType: input.prebuild.operationType,
    build: (variables) => ({
      variables,
      getFields: hidden(),
      projection,
    }),
  } satisfies StripSymbols<AnyOperationSliceOf<OperationType>> as AnyOperationSliceOf<OperationType>;
};
