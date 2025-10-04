import { gql } from "@/graphql-system";

class UserRepository {
  getModels() {
    const model = gql.default(({ model }) =>
      model.User(
        {},
        ({ f }) => [
          //
          f.id(),
        ],
        (v) => v,
      ),
    );
    return model;
  }
}
