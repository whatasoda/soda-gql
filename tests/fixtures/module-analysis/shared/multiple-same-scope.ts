import { gql } from "@/graphql-system";

const container = {
  model1: gql.default(({ model }) => model("A", ({ f }) => ({ id: f.id() }), (v) => v)),
  model2: gql.default(({ model }) => model("B", ({ f }) => ({ id: f.id() }), (v) => v)),
  model3: gql.default(({ model }) => model("C", ({ f }) => ({ id: f.id() }), (v) => v)),
};
