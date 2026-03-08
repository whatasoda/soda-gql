import { gql } from "../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment("UserFields", "User")`{ id name }`());
