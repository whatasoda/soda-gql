import { gql } from "@/graphql-system";

const factory = () => {
  const model = gql.default(({ model }) =>
    model("User", ({ f }) => ({ id: f.id() }), (v) => v)
  );
  return model;
};
