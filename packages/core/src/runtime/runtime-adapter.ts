import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import { pseudoTypeAnnotation } from "../types/shared/utility";

type RuntimeAdapterFactory<TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> = (tools: {
  type: typeof pseudoTypeAnnotation;
}) => TRuntimeAdapter;

export const createRuntimeAdapter = <TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  factory: RuntimeAdapterFactory<TRuntimeAdapter>,
) => factory({ type: pseudoTypeAnnotation });
