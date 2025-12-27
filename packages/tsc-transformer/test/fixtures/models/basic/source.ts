import { gql } from "../../../codegen-fixture/graphql-system";

export const userModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id(), f.name()]));

export const productModel = gql.default(({ model }) => {
  return model.Product({}, ({ f }) => [f.id(), f.name()]);
});

export const models = {
  user: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
};
