import { gql } from "../../../graphql-system";

const factory = () => {
  const fragment = gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());
  return fragment;
};
