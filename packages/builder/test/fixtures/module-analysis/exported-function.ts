import { gql } from "../../codegen-fixture/graphql-system";

export function getFragment() {
  const fragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
  return fragment;
}
