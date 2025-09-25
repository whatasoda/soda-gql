import { createModel, createSlice, gqlRuntime } from "@soda-gql/runtime";
export const models = {
  "tests/fixtures/runtime-app/src/entities/user.ts::userModel": createModel("tests/fixtures/runtime-app/src/entities/user.ts::userModel", () => gqlRuntime.model({
    typename: "User",
    variables: {
      categoryId: {
        kind: "scalar",
        name: "ID",
        modifier: ""
      }
    },
    transform: selection => ({
      id: selection.id,
      name: selection.name,
      posts: selection.posts.map(post => ({
        id: post.id,
        title: post.title
      }))
    })
  }))
} as const;
export const slices = {
  "tests/fixtures/runtime-app/src/entities/user.ts::userSlice": createSlice("tests/fixtures/runtime-app/src/entities/user.ts::userSlice", () => gqlRuntime.querySlice({
    variables: {
      id: {
        kind: "scalar",
        name: "ID",
        modifier: "!"
      },
      categoryId: {
        kind: "scalar",
        name: "ID",
        modifier: ""
      }
    },
    getProjections: gqlRuntime.handleProjectionBuilder(({
      select
    }) => select("$.users", result => result.safeUnwrap(data => data.map(user => userModel.transform(user)))))
  }))
} as const;