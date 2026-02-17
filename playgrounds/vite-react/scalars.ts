import { defineScalar } from "@soda-gql/core";

export const scalar = {
  // Built-in scalars
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),

  // Custom scalars from schema.graphql
  ...defineScalar<"DateTime", string, string>("DateTime"),
  ...defineScalar<"JSON", unknown, unknown>("JSON"),
  ...defineScalar<"BigInt", bigint | number | string, string>("BigInt"),
} as const;
