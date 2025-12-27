import { gql } from "../../codegen-fixture/graphql-system";

const factory = () => {
  const fragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
  return fragment;
};
