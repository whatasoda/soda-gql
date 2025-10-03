import { gql } from "@/graphql-system";

const model1 = gql.default(({ model }) => model("A", ({ f }) => ({ id: f.id() }), (v) => v));
const model2 = gql.default(({ model }) => model("B", ({ f }) => ({ id: f.id() }), (v) => v));

function factory() {
  const model1 = gql.default(({ model }) => model("C", ({ f }) => ({ id: f.id() }), (v) => v));
  const model2 = gql.default(({ model }) => model("D", ({ f }) => ({ id: f.id() }), (v) => v));
}
