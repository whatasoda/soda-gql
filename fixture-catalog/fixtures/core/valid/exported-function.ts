import { gql } from "../../../graphql-system";

export function getFragment() {
  const fragment = gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());
  return fragment;
}
