import type { AnyExecutionResultProjectionsBuilder, AnySliceOf } from "../types/element";
import { Projection } from "../types/runtime";
import type { OperationType } from "../types/schema";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";

export type RuntimeSliceInput = {
  prebuild: StripFunctions<AnySliceOf<OperationType>>;
  runtime: {
    buildProjection: AnyExecutionResultProjectionsBuilder;
  };
};

export const handleProjectionBuilder = <TBuilder extends AnyExecutionResultProjectionsBuilder>(
  projectionBuilder: TBuilder,
): ReturnType<TBuilder> =>
  projectionBuilder({
    select: (path, projector) => new Projection(path, projector),
  });

export const createRuntimeSlice = (input: RuntimeSliceInput) => {
  const projection = handleProjectionBuilder(input.runtime.buildProjection);
  return {
    operationType: input.prebuild.operationType,
    embed: (variables) => ({
      variables,
      getFields: hidden(),
      projection,
    }),
  } satisfies StripSymbols<AnySliceOf<OperationType>> as AnySliceOf<OperationType>;
};
