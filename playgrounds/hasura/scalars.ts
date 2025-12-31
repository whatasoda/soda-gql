import { defineScalar } from "@soda-gql/core";

/**
 * Scalar type mappings for Hasura GraphQL.
 */
export const scalar = {
  // Built-in GraphQL scalars
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  // Hasura custom scalars
  ...defineScalar<"bigint", string, string>("bigint"),
  ...defineScalar<"date", string, string>("date"),
  ...defineScalar<"jsonb", unknown, unknown>("jsonb"),
  ...defineScalar<"numeric", string, string>("numeric"),
  ...defineScalar<"timestamptz", string, string>("timestamptz"),
  ...defineScalar<"uuid", string, string>("uuid"),
} as const;
