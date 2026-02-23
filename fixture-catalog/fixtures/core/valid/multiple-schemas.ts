import { gql } from "../../../graphql-system";

export const adminFragment = gql.admin(({ fragment }) => fragment("AdminFragment", "Employee")`{ id name }`());

export const defaultQuery = gql.default(({ query }) =>
  query("DefaultData")`{ employees { id } }`(),
);
