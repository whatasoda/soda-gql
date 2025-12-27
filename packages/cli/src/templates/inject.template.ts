export const getInjectTemplate = (): string => `\
import { defineScalar } from "@soda-gql/core";
import { defineAdapter } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;

export const helpers = {};

export const metadata = defineAdapter({
  aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
});
`;
