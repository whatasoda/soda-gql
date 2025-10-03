import { gql } from "@/graphql-system";

class UserRepository {
  getModels() {
    const model = gql.default(({ model }) =>
      model("User", ({ f }) => ({ id: f.id() }), (v) => v)
    );
    return model;
  }
}
