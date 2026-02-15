import { gql } from "../../../../../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment`fragment UserFragment on Employee { id name }`());

export const productFragment = gql.default(({ fragment }) => {
  return fragment`fragment ProductFragment on Project { id title }`();
});

export const fragments = {
  user: gql.default(({ fragment }) => fragment`fragment UserIdFragment on Employee { id }`()),
};
