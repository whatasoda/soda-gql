import { gql } from "../../codegen-fixture/graphql-system";

export const factory = () => {
  return gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
};
