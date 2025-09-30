import type { AnyModel } from "../types/operation";
import { hidden } from "../types/shared/hidden";
import type { StripFunctions, StripSymbols } from "../types/shared/utility";

export type RuntimeModelInput = {
  prebuild: StripFunctions<AnyModel>;
  runtime: {
    normalize: (raw: unknown) => object;
  };
};

export const createRuntimeModel = (input: RuntimeModelInput): AnyModel =>
  ({
    typename: input.prebuild.typename,
    fragment: hidden(),
    normalize: input.runtime.normalize,
  }) satisfies StripSymbols<AnyModel> as unknown as AnyModel;
