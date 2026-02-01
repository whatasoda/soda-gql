import { gql } from "@/graphql-system";

export const GetUser = gql.default(({ query }) => query`query GetUser { user(id: "1") { id } }`({ metadata: {} }));
