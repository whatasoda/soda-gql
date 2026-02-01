import { gql } from "@/graphql-system";

export const GetUser = gql.default(({ query }) => query`query GetUser { user(id: "1") { id name } }`);

export const GetAuditLogs = gql.admin(({ query }) => query`query GetAuditLogs { auditLogs(limit: 10) { id action } }`);
