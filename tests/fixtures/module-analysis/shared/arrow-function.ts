import { gql } from "@/graphql-system";

const factory = () => {
  const model = gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => ({ ...f.id() }),
      (v) => v,
    ),
  );
  return model;
};
