import { gql } from "../../../graphql-system";

const container = {
  fragment1: gql.default(({ fragment }) => fragment("Fragment1", "Employee")`{ id }`()),
  fragment2: gql.default(({ fragment }) => fragment("Fragment2", "Employee")`{ id }`()),
  fragment3: gql.default(({ fragment }) => fragment("Fragment3", "Employee")`{ id }`()),
};
