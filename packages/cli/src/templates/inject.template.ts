export const getInjectTemplate = (): string => `\
import { defineAdapter, defineHelpers, defineScalar } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;

export const helpers = defineHelpers({});

export const metadata = defineAdapter({
  aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
});
`;
