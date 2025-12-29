import { gql } from "../../codegen-fixture/graphql-system";

function createModels() {
  const nested = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
  return nested;
}
