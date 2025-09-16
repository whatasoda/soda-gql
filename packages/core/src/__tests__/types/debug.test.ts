import type { GraphqlAdapter } from "../../types/adapter";
import type { FieldPaths, InferFields } from "../../types/fields";
import type { ModelFn } from "../../types/model";
import type { OperationFn } from "../../types/operation";
import type { OperationSliceFn } from "../../types/operation-slice";
import { define, type GraphqlSchema } from "../../types/schema";
import { createTypeFactories, unsafeType } from "../../types/type-ref";

type Scalars = {
  string: string;
  int: number;
  float: number;
  boolean: boolean;
  id: string;
};

const scalars = {
  ...define("string").scalar<Scalars["string"]>(),
  ...define("int").scalar<Scalars["int"]>(),
  ...define("float").scalar<Scalars["float"]>(),
  ...define("boolean").scalar<Scalars["boolean"]>(),
  ...define("id").scalar<Scalars["id"]>(),
};

const enums = {
  ...define("direction").enum({
    up: true,
    down: true,
    left: true,
    right: true,
  }),
};

const inputs = {
  ...define("point").input({
    x: unsafeType.scalar("int", "!"),
    y: unsafeType.scalar("int", "!"),
  }),
};

const objects = {
  ...define("point").object({
    x: {
      arguments: {
        input: unsafeType.input("point", "!"),
      },
      type: unsafeType.scalar("int", "!"),
    },
    y: {
      arguments: {
        input: unsafeType.input("point", "!"),
      },
      type: unsafeType.scalar("int", "!"),
    },
  }),
  ...define("user").object({
    id: {
      arguments: {},
      type: unsafeType.scalar("id", "!"),
    },
    name: {
      arguments: {},
      type: unsafeType.scalar("string", "!"),
    },
    posts: {
      arguments: {
        categoryId: unsafeType.scalar("id", "?"),
      },
      type: unsafeType.object("post", "![]!"),
    },
    postOrComment: {
      arguments: {},
      type: unsafeType.union("postOrComment", "![]!"),
    },
  }),
  ...define("post").object({
    id: {
      arguments: {},
      type: unsafeType.scalar("id", "!"),
    },
    title: {
      arguments: {},
      type: unsafeType.scalar("string", "!"),
    },
    content: {
      arguments: {},
      type: unsafeType.scalar("string", "!"),
    },
    userId: {
      arguments: {},
      type: unsafeType.scalar("id", "!"),
    },
  }),
  ...define("comment").object({
    id: {
      arguments: {},
      type: unsafeType.scalar("id", "!"),
    },
    content: {
      arguments: {},
      type: unsafeType.scalar("string", "!"),
    },
    userId: {
      arguments: {},
      type: unsafeType.scalar("id", "!"),
    },
    postId: {
      arguments: {},
      type: unsafeType.scalar("id", "!"),
    },
  }),
};

const query_root = {
  ...define("query_root").object({
    users: {
      arguments: {
        id: unsafeType.scalar("id", "![]!"),
        point: unsafeType.input("point", "!"),
      },
      type: unsafeType.object("user", "![]!"),
    },
    posts: {
      arguments: {},
      type: unsafeType.object("post", "![]!"),
    },
    comments: {
      arguments: {},
      type: unsafeType.object("comment", "![]!"),
    },
  }),
};

const unions = {
  ...define("postOrComment").union({
    post: true,
    comment: true,
  }),
};

export const schema = {
  schema: {
    query: "query_root" as const,
    mutation: "mutation_root" as const,
    subscription: "subscription_root" as const,
  },
  scalar: scalars,
  enum: enums,
  input: inputs,
  object: {
    ...objects,
    ...query_root,
  },
  union: unions,
} satisfies GraphqlSchema;

export const adapter = {
  createError: (raw: unknown) => ({
    raw,
  }),
} satisfies GraphqlAdapter;

export type Schema = typeof schema & { _?: never };
export type Adapter = typeof adapter & { _?: never };

const ref = createTypeFactories<Schema>();

declare const model: ModelFn<Schema>;
declare const querySlice: OperationSliceFn<Schema, Adapter, "query">;
declare const mutationSlice: OperationSliceFn<Schema, Adapter, "mutation">;
declare const subscriptionSlice: OperationSliceFn<Schema, Adapter, "subscription">;
declare const query: OperationFn<Schema, Adapter, "query">;
declare const mutation: OperationFn<Schema, Adapter, "mutation">;
declare const subscription: OperationFn<Schema, Adapter, "subscription">;

const gql = {
  query,
  mutation,
  subscription,
  model,
  ref,
  querySlice,
  mutationSlice,
  subscriptionSlice,
};

// ここから上は生成されるべきコード

// ここから下はユーザーが書くコード

const userModel = gql.model(
  [
    // type name
    "user",
    // model can have variables
    {
      categoryId: gql.ref.scalar("id", "?"),
    },
  ],
  // fields
  ({ f, $ }) => ({
    ...f.id(),
    ...f.name(),
    // alias field
    userName: f.name().name,
    // nested fields
    ...f.posts({ categoryId: $.categoryId }, ({ f }) => ({
      ...f.id(),
      ...f.title(),
    })),
    // nested union fields
    ...f.postOrComment(
      {},
      {
        post: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.title(),
        }),
        comment: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.content(),
        }),
      },
    ),
  }),
  // runtime function to transform data
  // type of data is inferred from fields definition
  (data) => ({
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
);

const userQuerySlice = gql.querySlice(
  [
    // arguments
    {
      id: gql.ref.scalar("id", "!"),
      categoryId: gql.ref.scalar("id", "?"),
      x: gql.ref.scalar("int", "!"),
      y: gql.ref.scalar("int", "!"),
    },
  ],
  // fields of query root type
  ({ f, $ }) => ({
    ...f.users(
      {
        // both `[id!]!` and `id!` variables are valid (this example uses `id!`)
        id: [$.id],
        point: { x: $.x, y: $.y },
      },
      () => ({
        // defining fields with model
        ...userModel.fragment({ categoryId: $.categoryId }),
      }),
    ),
  }),
  ({ select }) =>
    // select path of result to handle
    select(
      "$.users",
      // runtime function to transform result
      (result) => {
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
);

const userQuerySlice2 = gql.querySlice(
  [
    {
      id: gql.ref.scalar("id", "!"),
      x: gql.ref.scalar("int", "!"),
      y: gql.ref.scalar("int", "!"),
    },
  ],
  ({ f, $ }) => ({
    ...f.users(
      {
        id: [$.id],
        point: { x: $.x, y: $.y },
      },
      () => ({
        ...userModel.fragment({}),
      }),
    ),
  }),
  ({ select }) =>
    select("$.users", (result) => {
      if (result.isError()) {
        return { error: result.error };
      }

      return {
        data: result.unwrap()?.map((user) => userModel.transform(user)) ?? [],
      };
    }),
);

const userQuerySlice3 = gql.querySlice(
  [
    {
      id: gql.ref.scalar("id", "!"),
      x: gql.ref.scalar("int", "!"),
      y: gql.ref.scalar("int", "!"),
    },
  ],
  ({ f, $ }) => ({
    ...f.users(
      {
        id: [$.id],
        point: { x: $.x, y: $.y },
      },
      () => ({
        ...userModel.fragment({}),
      }),
    ),
  }),
  ({ select }) => ({
    multiple: {
      // multiple results are allowed, duplication is also allowed
      a: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
      b: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
    },
  }),
);

const pageQuery = gql.query(
  "DocumentName",
  {
    userId: gql.ref.scalar("id", "!"),
    x: gql.ref.scalar("int", "!"),
    y: gql.ref.scalar("int", "!"),
  },
  ({ $ }) => ({
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
);

const a = pageQuery.transform({});

a.users;
a.users2;
a.users3;

const _a: InferFields<Schema, typeof userModel.typename, ReturnType<typeof userModel.fragment>> = {
  id: "1",
  name: "John Doe",
  posts: [
    {
      id: "1",
      title: "Post 1",
    },
  ],
  postOrComment: [
    {
      __typename: "post",
      id: "1",
      title: "Post 1",
    },
  ],
};

type a = FieldPaths<Schema, typeof userModel.typename, ReturnType<typeof userModel.fragment>>;
