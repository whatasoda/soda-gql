import { gql } from "@/graphql-system";

export const pageQuery = gql.default(({ operation, slice }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      user: slice
        .query(
          {},
          ({ _: f }) => ({ ...f.user({ id: $.userId }, ({ f }) => ({ ...f.id() })) }),
          ({ select }) => select(["$.user"], (result) => result),
        )
        .build(),
    }),
  ),
);
