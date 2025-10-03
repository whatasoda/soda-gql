import { gql } from "@/graphql-system";
import type { AnySlice } from "@soda-gql/core";
import { userRemote } from "./user";

type GqlSlice = Extract<ReturnType<typeof gql.default>, AnySlice>;

const collectionsByCategory: GqlSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("categoryId").scalar("ID:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.users({ categoryId: $.categoryId }, ({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
    ({ select }) =>
      select(["$.users"], (result) =>
        result.safeUnwrap(([users]) => users.map((user) => userRemote.forIterate.normalize(user))),
      ),
  ),
);

export const collections = {
  byCategory: collectionsByCategory,
};
