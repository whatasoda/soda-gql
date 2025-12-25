import { gql } from "../../codegen-fixture/graphql-system";

const factory = () => {
  const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
  return model;
};
