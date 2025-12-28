import type { AnyFragment, GqlElementAttachment } from "../types/element";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";

export type RuntimeFragmentInput = {
  prebuild: StripFunctions<AnyFragment>;
};

export const createRuntimeFragment = (input: RuntimeFragmentInput): AnyFragment => {
  const fragment = {
    typename: input.prebuild.typename,
    embed: hidden(),
    attach<TName extends string, TValue extends object>(attachment: GqlElementAttachment<typeof fragment, TName, TValue>) {
      const value = attachment.createValue(fragment);

      Object.defineProperty(fragment, attachment.name, {
        get() {
          return value;
        },
      });

      return fragment as typeof fragment & { [_ in TName]: TValue };
    },
  } satisfies StripSymbols<AnyFragment> as unknown as AnyFragment;

  return fragment;
};
