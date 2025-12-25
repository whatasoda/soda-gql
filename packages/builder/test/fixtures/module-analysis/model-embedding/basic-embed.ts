import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * Basic model definition
 */
export const userModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id(), f.name(), f.email()]));

/**
 * Operation that embeds the model
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(() => [userModel.embed()])],
  ),
);
