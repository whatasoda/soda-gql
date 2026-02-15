import { gql } from "../../../graphql-system";

export const factory = () => {
  return gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());
};
