import { gql } from "../../graphql-system";

export const objectWrapped = {
  model: gql.default(({ model }) =>
    model.User(
      {},
      ({ f }) => [
        //
        f.id(),
      ],
      (v) => v
    )
  ),

  query: gql.default(({ query }, { $var }) =>
    query.slice(
      {
        variables: [$var("userId").scalar("ID:!")],
      },
      ({ f, $ }) => [
        //
        f.user({ id: $.userId })(({ f }) => [f.id()]),
      ],
      ({ select }) => select(["$.user"], (result) => result)
    )
  ),

  nested: {
    model: gql.default(({ model }) =>
      model.User(
        {},
        ({ f }) => [
          //
          f.id(),
        ],
        (v) => v
      )
    ),

    query: gql.default(({ query }, { $var }) =>
      query.slice(
        {
          variables: [$var("userId").scalar("ID:!")],
        },
        ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
        ({ select }) => select(["$.user"], (result) => result)
      )
    ),
  },
};
