import { gql } from "@/graphql-system";

function createModels() {
  const nested = gql.default(({ model }) =>
    model("Nested", ({ f }) => ({ id: f.id() }), (v) => v)
  );
  return nested;
}
