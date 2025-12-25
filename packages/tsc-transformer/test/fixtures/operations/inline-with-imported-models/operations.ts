import { gql } from "../../../codegen-fixture/graphql-system";
import { userModel } from "./models";

export const getUserById = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUserById",
      variables: [$var("id").scalar("ID:!")],
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
