import { gqlRuntime } from "@soda-gql/runtime";
import type { DocumentNode } from "graphql";
import type { ExecutionResultProjectionPathGraphNode } from "./packages/core/src/types";

const userModel = gqlRuntime.model({
  typename: "User",
  transform: (data) => ({
    id: data.id,
    name: data.name,
    userName: data.name,
    posts: data.posts.map((post) => ({
      id: post.id,
      title: post.title,
    })),
    postOrComment: data.postOrComment.map((postOrComment) =>
      postOrComment.__typename === "post"
        ? {
            type: postOrComment.__typename,
            id: postOrComment.id,
            title: postOrComment.title,
          }
        : {
            type: postOrComment.__typename,
            id: postOrComment.id,
            content: postOrComment.content,
          },
    ),
  }),
});

const userQuerySlice = gqlRuntime.querySlice({
  rootFieldKeys: ["users"],
  projection: gqlRuntime.handleProjectionBuilder(({ select }) =>
    // select path of result to handle
    select(
      "$.users",
      // runtime function to transform result
      (result) => {
        // selected result data is wrapped by Result-like object
        // use must handle error on every single case
        if (result.isError()) {
          return { error: result.error };
        }

        if (result.isEmpty()) {
          return { data: [] };
        }

        return {
          data: result.data.map((user) => userModel.transform(user)),
        };
      },
    ),
  ),
});

const userQuerySlice2 = gqlRuntime.querySlice({
  rootFieldKeys: ["users"],
  projection: gqlRuntime.handleProjectionBuilder(({ select }) =>
    select("$.users", (result) => {
      if (result.isError()) {
        return { error: result.error };
      }

      return {
        data: result.unwrap()?.map((user) => userModel.transform(user)) ?? [],
      };
    }),
  ),
});

const userQuerySlice3 = gqlRuntime.querySlice({
  rootFieldKeys: ["users"],
  projection: gqlRuntime.handleProjectionBuilder(({ select }) => ({
    // multiple results are allowed, duplication is also allowed
    a: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
    b: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
  })),
});

const _pageQuery = gqlRuntime.query({
  name: "PageQuery",
  document: {
    /* omitted in this sample */
  } as DocumentNode,
  variableNames: ["userId", "x", "y"],
  projectionPathGraph: { matches: [], children: {} } as ExecutionResultProjectionPathGraphNode,
  getSlices: ({ $ }) => ({
    // define query document with slices
    users: userQuerySlice({
      id: $.userId,
      x: $.x,
      y: $.y,
    }),
    users2: userQuerySlice2({
      id: $.userId,
      x: $.x,
      y: $.y,
    }),
    users3: userQuerySlice3({
      id: $.userId,
      x: $.x,
      y: $.y,
    }),
  }),
});
