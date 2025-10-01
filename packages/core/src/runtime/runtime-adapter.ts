import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import { hidden } from "../types/shared/hidden";

type RuntimeAdapterFactory<TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> = (tools: {
  type: typeof hidden;
}) => TRuntimeAdapter;

export const createRuntimeAdapter = <TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  factory: RuntimeAdapterFactory<TRuntimeAdapter>,
) => factory({ type: hidden });
