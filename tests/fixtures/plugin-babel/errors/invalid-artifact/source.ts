import { gql } from "@/graphql-system";

// @ts-expect-error - intentional invalid usage
export const something = gql.default(({ unknown }) => unknown());
