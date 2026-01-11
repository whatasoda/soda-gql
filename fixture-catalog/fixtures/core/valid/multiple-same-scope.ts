import { gql } from "../../../graphql-system";

const container = {
  fragment1: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
  fragment2: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
  fragment3: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
};
