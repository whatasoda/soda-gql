import { gql } from "../../../graphql-system";

function createModels() {
  const nested = gql.default(({ fragment }) => fragment`fragment NestedFragment on Employee { id }`());
  return nested;
}
