import type { FragmentMetaInfo, OperationMetadata } from "@soda-gql/core";
import { defineAdapter } from "@soda-gql/core/adapter";

export const adapter = defineAdapter({
  helpers: {
    auth: {
      requiresLogin: () => ({ requiresAuth: true as const }),
      spec: (input: { permission: string }) => input,
    },
  },
  metadata: {
    aggregateFragmentMetadata: (
      fragments: readonly FragmentMetaInfo<OperationMetadata>[],
    ): readonly (OperationMetadata | undefined)[] => fragments.map((m) => m.metadata),
  },
});
