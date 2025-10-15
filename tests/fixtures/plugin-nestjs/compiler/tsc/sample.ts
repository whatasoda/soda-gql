import { gql } from "@/graphql-system";

// @ts-expect-error - This is a test fixture, intentionally using invalid types
export const userQuery = gql.operation.query("UserQuery", ({ f }: any) => ({
  user: f.user({}, ({ f }: any) => ({
    id: f.id,
    name: f.name,
  })),
}));

// @ts-expect-error - This is a test fixture, intentionally using invalid types
export const createUserMutation = gql.operation.mutation("CreateUser", ({ f, $ }: any) => ({
  createUser: f.createUser({ input: $.input }, ({ f }: any) => ({
    id: f.id,
    name: f.name,
  })),
}));
