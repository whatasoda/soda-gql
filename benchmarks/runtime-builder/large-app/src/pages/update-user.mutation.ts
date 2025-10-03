import { gql } from "@/graphql-system";
import { userModel } from "../entities/user";

export const updateUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("id").scalar("ID:!"),
        ...$("firstName").scalar("String:?"),
        ...$("lastName").scalar("String:?"),
        ...$("avatar").scalar("String:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.updateUserProfile({ id: $.id, firstName: $.firstName, lastName: $.lastName, avatar: $.avatar }, () => ({
        ...userModel.fragment(),
      })),
    }),
  ),
);
