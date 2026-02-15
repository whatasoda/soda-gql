import { gql } from "../../../graphql-system";

const container = {
  fragment1: gql.default(({ fragment }) => fragment`fragment Fragment1 on Employee { id }`()),
  fragment2: gql.default(({ fragment }) => fragment`fragment Fragment2 on Employee { id }`()),
  fragment3: gql.default(({ fragment }) => fragment`fragment Fragment3 on Employee { id }`()),
};
