import { gql } from "@/graphql-system";

export function getModel() {
  const model = gql.default(({ model }) =>
    model("User", ({ f }) => ({ id: f.id() }), (v) => v)
  );
  return model;
}
