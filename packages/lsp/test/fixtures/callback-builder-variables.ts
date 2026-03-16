import { gql } from "@/graphql-system";

export const GetUser = gql.default(({ query }) =>
  query("GetUser")({ variables: `($id: ID!)`, fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")(), ...f("name")() })) }) })({}),
);
