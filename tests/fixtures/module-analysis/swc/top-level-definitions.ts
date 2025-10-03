import { gql } from "@/graphql-system";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    {},
    () => ({
      hello: "world",
    }),
  )
);
