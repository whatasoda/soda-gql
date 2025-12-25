import { gql } from "../../codegen-fixture/graphql-system";

export const factory = () => {
  return gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
};
