import { gql } from "../../codegen-fixture/graphql-system";

export const objectWrapped = {
  model: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),

  query: gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "ObjectWrappedQuery",
        variables: [$var("userId").scalar("ID:!")],
      },
      ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
    ),
  ),

  nested: {
    model: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),

    query: gql.default(({ query }, { $var }) =>
      query.operation(
        {
          name: "ObjectWrappedNestedQuery",
          variables: [$var("userId").scalar("ID:!")],
        },
        ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
      ),
    ),
  },
};
