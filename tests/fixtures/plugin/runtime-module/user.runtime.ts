import { gql } from "@/graphql-system";
import { createModel, createSlice } from "@soda-gql/runtime";

export const models = {
  "tests/fixtures/runtime-app/src/entities/user.ts::userModel": createModel(
    "tests/fixtures/runtime-app/src/entities/user.ts::userModel",
    () =>
      gql.model(
        ["User", { categoryId: gql.scalar(["ID", ""]) }],
        ({ f, $ }) => ({
          ...f.id(),
          ...f.name(),
          ...f.posts({ categoryId: $.categoryId }, ({ f }) => ({
            ...f.id(),
            ...f.title(),
          })),
        }),
        () => {
          /* runtime function */
          return {};
        },
      ),
  ),
} as const;

export const slices = {
  "tests/fixtures/runtime-app/src/entities/user.ts::userSlice": createSlice(
    "tests/fixtures/runtime-app/src/entities/user.ts::userSlice",
    () =>
      gql.querySlice(
        [
          {
            id: gql.scalar(["ID", "!"]),
            categoryId: gql.scalar(["ID", ""]),
          },
        ],
        ({ f, $ }) => ({
          ...f.users({ id: [$.id], categoryId: $.categoryId }, () => ({
            ...models["tests/fixtures/runtime-app/src/entities/user.ts::userModel"].fragment({ categoryId: $.categoryId }),
          })),
        }),
        ({ select }) =>
          select("$.users", () => {
            /* runtime function */
            return {};
          }),
      ),
  ),
} as const;
