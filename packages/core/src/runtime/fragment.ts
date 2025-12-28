import type { AnyFragment, GqlElementAttachment } from "../types/element";
import { hidden } from "../utils/hidden";
import type { StripFunctions } from "../utils/type-utils";

export type RuntimeFragmentInput = {
  prebuild: StripFunctions<AnyFragment>;
};

export const createRuntimeFragment = (input: RuntimeFragmentInput): AnyFragment => {
  const fragment = {
    typename: input.prebuild.typename,
    embed: hidden(),
    attach<TName extends string, TValue extends object>(attachment: GqlElementAttachment<typeof fragment, TName, TValue>) {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic property assignment
      (fragment as any)[attachment.name] = attachment.createValue(fragment);
      return fragment as typeof fragment & { [_ in TName]: TValue };
    },
  } as unknown as AnyFragment;

  return fragment;
};
