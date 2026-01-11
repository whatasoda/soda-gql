import { gql } from "../../../graphql-system";

function createModels() {
  const nested = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
  return nested;
}
