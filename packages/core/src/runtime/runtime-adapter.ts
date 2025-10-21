import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { Hidden } from "../utils/hidden";
import { hidden } from "../utils/hidden";

type RuntimeAdapterFactory<TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> = (tools: {
  type: <T>() => Hidden<T>;
}) => TRuntimeAdapter;

export const createRuntimeAdapter = <TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  factory: RuntimeAdapterFactory<TRuntimeAdapter>,
) => factory({ type: hidden });
