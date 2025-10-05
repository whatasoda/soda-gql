import type { AnyModel } from "../types/operation";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";

export type RuntimeModelInput = {
  prebuild: StripFunctions<AnyModel>;
  runtime: {
    // biome-ignore lint/suspicious/noExplicitAny: any is ok here
    normalize: (raw: any) => object;
  };
};

export const createRuntimeModel = (input: RuntimeModelInput): AnyModel =>
  ({
    typename: input.prebuild.typename,
    fragment: hidden(),
    normalize: input.runtime.normalize,
  }) satisfies StripSymbols<AnyModel> as unknown as AnyModel;
