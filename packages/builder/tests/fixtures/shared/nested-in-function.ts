import { gql } from "../../graphql-system";

function createModels() {
  const nested = gql.default(({ model }) =>
    model.User(
      {},
      ({ f }) => [
        //
        f.id(),
      ],
      (v) => v,
    ),
  );
  return nested;
}
