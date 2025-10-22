import type { AnyGraphqlSchema } from "@soda-gql/core";
import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);

export const schema: AnyGraphqlSchema = {} as AnyGraphqlSchema;
