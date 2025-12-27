import { gql } from "../../codegen-fixture/graphql-system";

const fragment1 = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
const fragment2 = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));

function factory() {
  const fragment1 = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
  const fragment2 = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
}
