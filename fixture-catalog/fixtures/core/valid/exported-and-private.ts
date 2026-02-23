import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment("UserFragment", "Employee")`{ id }`());

const privateFragment = gql.default(({ fragment }) => fragment("PrivateFragment", "Employee")`{ id }`());
