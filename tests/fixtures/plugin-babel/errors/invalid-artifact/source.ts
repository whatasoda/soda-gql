import { gql } from "@soda-gql/core";

// @ts-expect-error - intentional invalid usage
export const something = gql.default(({ unknown }) => unknown());
