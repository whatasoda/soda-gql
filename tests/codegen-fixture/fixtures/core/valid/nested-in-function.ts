import { gql } from "../../../graphql-system";

function createModels() {
  const nested = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
  return nested;
}
