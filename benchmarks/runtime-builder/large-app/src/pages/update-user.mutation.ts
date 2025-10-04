import { gql } from "@/graphql-system";
import { updateUserSlice } from "../entities/user";

export const updateUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateUser",
      variables: {
        ...$("id").scalar("ID:!"),
        ...$("firstName").scalar("String:?"),
        ...$("lastName").scalar("String:?"),
        ...$("avatar").scalar("String:?"),
      },
    },
    ({ $ }) => ({
      user: updateUserSlice.build({
        id: $.id,
        firstName: $.firstName,
        lastName: $.lastName,
        avatar: $.avatar,
      }),
    }),
  ),
);
