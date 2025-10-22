import { gql } from "@/graphql-system";

export const profileQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfileQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    () => ({}),
  ),
);

export const updateProfileMutation = gql.default(({ mutation }, { $ }) =>
  mutation.composed(
    {
      operationName: "UpdateProfile",
      variables: [$("userId").scalar("ID:!"), $("name").scalar("String:!")],
    },
    () => ({}),
  ),
);
