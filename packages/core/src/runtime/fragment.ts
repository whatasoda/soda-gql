import type { AnyFragment, GqlElementAttachment } from "../types/element";
import { hidden } from "../utils/hidden";
import type { StripSymbols } from "../utils/type-utils";

/**
 * Prebuild data for runtime fragment creation.
 * Explicitly defined to ensure key remains optional.
 */
export type RuntimeFragmentPrebuild = {
  readonly typename: string;
  readonly key?: string;
};

export type RuntimeFragmentInput = {
  prebuild: RuntimeFragmentPrebuild;
};

export const createRuntimeFragment = (input: RuntimeFragmentInput): AnyFragment => {
  const fragment = {
    typename: input.prebuild.typename,
    key: input.prebuild.key,
    spread: hidden(),
    attach(
      attachmentOrAttachments:
        | GqlElementAttachment<typeof fragment, string, object>
        | readonly GqlElementAttachment<typeof fragment, string, object>[],
    ) {
      const attachments = Array.isArray(attachmentOrAttachments) ? attachmentOrAttachments : [attachmentOrAttachments];

      for (const attachment of attachments) {
        const value = attachment.createValue(fragment);

        Object.defineProperty(fragment, attachment.name, {
          get() {
            return value;
          },
        });
      }

      return fragment;
    },
  } satisfies StripSymbols<AnyFragment> as unknown as AnyFragment;

  return fragment;
};
