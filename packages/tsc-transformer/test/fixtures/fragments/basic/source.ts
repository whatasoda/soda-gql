import { gql } from "../../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id(), f.name()] }));

export const productFragment = gql.default(({ fragment }) => {
  return fragment.Product({ fields: ({ f }) => [f.id(), f.name()] });
});

export const fragments = {
  user: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id()] })),
};
