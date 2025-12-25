import { gql } from "../../codegen-fixture/graphql-system";

class UserRepository {
  getModels() {
    const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
    return model;
  }
}
