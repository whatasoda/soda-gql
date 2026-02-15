import { gql } from "../../../graphql-system";
import { usersQuery, usersQueryCatalog } from "./user";
import * as userCatalog from "./user-catalog";

type ProfileQueryVariables = {
  readonly employeeId: string;
};

export const profileQuery = gql.default(({ query }) =>
  query`query ProfilePageQuery($employeeId: ID!) { employee(id: $employeeId) { id name email } }`(),
);

export type ProfileQuery = typeof profileQuery;
export type ProfileQueryVariablesInput = ProfileQueryVariables;
