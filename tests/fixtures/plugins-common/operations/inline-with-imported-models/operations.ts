import { gql } from "@/graphql-system";
import { userModel } from "./models";

export const getUserById = gql.default(({ query }, { $ }) =>
  query.inline(
    {
      operationName: "GetUserById",
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.user({ id: $.id })(() => [
        //
        userModel.fragment(),
      ]),
    ],
  ),
);
