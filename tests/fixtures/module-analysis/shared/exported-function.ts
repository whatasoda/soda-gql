import { gql } from "@/graphql-system";

export function getModel() {
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
