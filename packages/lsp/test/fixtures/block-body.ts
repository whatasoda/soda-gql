import { gql } from "@/graphql-system";

export const GetUser = gql.default(({ query }) => {
  return query("GetUser")`{ user(id: "1") { id name } }`;
});
