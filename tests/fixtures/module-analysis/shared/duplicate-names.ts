import { gql } from "@/graphql-system";

const model1 = gql.default(({ model }) => model({ typename: "User" }, ({ f }) => ({ ...f.id() }), (v) => v));
const model2 = gql.default(({ model }) => model({ typename: "User" }, ({ f }) => ({ ...f.id() }), (v) => v));

function factory() {
  const model1 = gql.default(({ model }) => model({ typename: "User" }, ({ f }) => ({ ...f.id() }), (v) => v));
  const model2 = gql.default(({ model }) => model({ typename: "User" }, ({ f }) => ({ ...f.id() }), (v) => v));
}
