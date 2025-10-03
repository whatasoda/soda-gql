import { gql } from "@/graphql-system";

export const pageQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: {},
    },
    // @ts-expect-error - Test fixture with dummy field
    ({ f }) => ({
      hello: "world",
    }),
  ),
);
