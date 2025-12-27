import { gql } from "../../codegen-fixture/graphql-system";

function createModels() {
  const nested = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
  return nested;
}
