import { gql } from "@/graphql-system";
import { userRemote } from "./user";

export const collections = {
  byCategory: gql.default(({ query }, { $var }) =>
    query.slice(
      {
        variables: [$var("categoryId").scalar("ID:?")],
      },
      ({ f, $ }) => [
        //
        f.users({ categoryId: $.categoryId })(({ f }) => [
          //
          f.id(),
          f.name(),
        ]),
      ],
      ({ select }) =>
        select(["$.users"], (result) =>
          result.safeUnwrap(([users]) => users.map((user) => userRemote.forIterate.normalize(user))),
        ),
    ),
  ),
};
