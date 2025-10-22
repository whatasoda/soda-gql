import { gql } from "@/graphql-system";
import type { RuntimeModelInput } from "@soda-gql/core/runtime";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);

export type ModelInput = RuntimeModelInput;
