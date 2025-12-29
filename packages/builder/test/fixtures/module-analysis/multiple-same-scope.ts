import { gql } from "../../codegen-fixture/graphql-system";

const container = {
  fragment1: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id()] })),
  fragment2: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id()] })),
  fragment3: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id()] })),
};
