import { gql } from "@/graphql-system";

export const GetUser = gql.default(({ query }) =>
  query("GetUser")({ variables: `($id: ID!)`, fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")(), ...f("name")() })) }) })({}),
);

export const SearchItems = gql.default(({ query }) =>
  query("SearchItems")({
    variables: `($query: String!)`,
    fields: ({ f, $ }) => ({
      ...f("search", { query: $.query })({
        User: ({ f }) => ({
          ...f("id")(),
          ...f("name")(),
        }),
        Post: ({ f }) => ({
          ...f("id")(),
          ...f("title")(),
        }),
        __typename: true,
      }),
    }),
  })({}),
);
