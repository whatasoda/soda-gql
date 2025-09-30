import { createGql, define, defineScalar, pseudoTypeAnnotation, unsafeInputRef, unsafeOutputRef } from "./packages/core/src";
import { createA } from "./packages/core/src/builder/type-ref";
import type { GraphqlRuntimeAdapter } from "./packages/core/src/types/adapter";
// import type { FieldPaths } from "./packages/core/src/types/field-path"; // unused type import
import type { InferFields } from "./packages/core/src/types/fields";
import type { AnyGraphqlSchema } from "./packages/core/src/types/schema";

const scalars = {
  ...defineScalar("String", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("Int", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Float", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Boolean", ({ type }) => ({
    input: type<boolean>(),
    output: type<boolean>(),
    directives: {},
  })),
  ...defineScalar("ID", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
};

const enums = {
  ...define("direction").enum(
    {
      up: true,
      down: true,
      left: true,
      right: true,
    },
    {},
  ),
};

const inputs = {
  ...define("point").input(
    {
      x: unsafeInputRef.scalar(["Int", "!"], { default: 0 }, {}),
      y: unsafeInputRef.scalar(["Int", "!"], null, {}),
    },
    {},
  ),
};

const objects = {
  ...define("point").object(
    {
      x: unsafeOutputRef.scalar(
        ["Int", ""],
        {
          input: unsafeInputRef.input(["point", "!"], null, {}),
        },
        {},
      ),
      y: unsafeOutputRef.scalar(
        ["Int", "!"],
        {
          input: unsafeInputRef.input(["point", "!"], null, {}),
        },
        {},
      ),
    },
    {},
  ),
  ...define("user").object(
    {
      id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
      name: unsafeOutputRef.scalar(["String", "!"], {}, {}),
      posts: unsafeOutputRef.object(
        ["post", "![]!"],
        {
          categoryId: unsafeInputRef.scalar(["ID", ""], null, {}),
        },
        {},
      ),
      postOrComment: unsafeOutputRef.union(["postOrComment", "![]!"], {}, {}),
    },
    {},
  ),
  ...define("post").object(
    {
      id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
      title: unsafeOutputRef.scalar(["String", "!"], {}, {}),
      content: unsafeOutputRef.scalar(["String", "!"], {}, {}),
      userId: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
    },
    {},
  ),
  ...define("comment").object(
    {
      id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
      content: unsafeOutputRef.scalar(["String", "!"], {}, {}),
      userId: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
      postId: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
    },
    {},
  ),
};

const query_root = {
  ...define("query_root").object(
    {
      users: unsafeOutputRef.object(
        ["user", "![]!"],
        {
          id: unsafeInputRef.scalar(["ID", "![]!"], null, {}),
          point: unsafeInputRef.input(["point", "!"], null, {}),
        },
        {},
      ),
      posts: unsafeOutputRef.object(["post", "![]!"], {}, {}),
      comments: unsafeOutputRef.object(["comment", "![]!"], {}, {}),
    },
    {},
  ),
};

const unions = {
  ...define("postOrComment").union(
    {
      post: true,
      comment: true,
    },
    {},
  ),
};

export const schema = {
  operations: {
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
} satisfies AnyGraphqlSchema;

const nonGraphqlErrorType = pseudoTypeAnnotation<{ type: "non-graphql-error"; cause: unknown }>();

export const adapter = {
  nonGraphqlErrorType,
} satisfies GraphqlRuntimeAdapter;

export type Schema = typeof schema & { _?: never };
export type Adapter = typeof adapter & { _?: never };

// const ref = createRefFactories<Schema>();
// const helpers = createHelpers<Schema>(schema);

// declare const model: ModelFn<Schema>;
// declare const querySlice: OperationSliceFn<Schema, Adapter, "query">;
// declare const mutationSlice: OperationSliceFn<Schema, Adapter, "mutation">;
// declare const subscriptionSlice: OperationSliceFn<Schema, Adapter, "subscription">;
// declare const query: OperationFn<Schema, Adapter, "query">;
// declare const mutation: OperationFn<Schema, Adapter, "mutation">;
// declare const subscription: OperationFn<Schema, Adapter, "subscription">;

// const gql = {
//   ...helpers,
//   ...ref,
//   query,
//   mutation,
//   subscription,
//   model,
//   querySlice,
//   mutationSlice,
//   subscriptionSlice,
// };

const gql = createGql<Schema, Adapter>({
  schema,
  adapter,
});

const { _a } = createA<Schema>()
const w = _a(["ID", "!"], {
  default: () => "1",
    directives: {
  a: {a: {  }}
} },)
w.defaultValue

// ここから上は生成されるべきコード

// ここから下はユーザーが書くコード

const userModel = gql.model(
  [
    // type name
    "user",
    // model can have variables
    {
      categoryId: gql.scalar(["ID", ""]),
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
      id: gql.scalar(["ID", "!"]),
      categoryId: gql.scalar(["ID", ""]),
      x: gql.scalar(["Int", "!"]),
      y: gql.scalar(["Int", "!"]),
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
);

const userQuerySlice2 = gql.querySlice(
  [
    {
      id: gql.scalar(["ID", "!"]),
      x: gql.scalar(["Int", "!"]),
      y: gql.scalar(["Int", "!"]),
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
      id: gql.scalar(["ID", "!"]),
      x: gql.scalar(["Int", "!"]),
      y: gql.scalar(["Int", "!"]),
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
    // multiple results are allowed, duplication is also allowed
    a: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
    b: select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
  }),
);

const pageQuery = gql.query(
  "DocumentName",
  {
    userId: gql.scalar(["ID", "!"]),
    x: gql.scalar(["Int", "!"]),
    y: gql.scalar(["Int", "!"]),
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

// for now, way to handle built query document is not implemented. But we can confirm that type inference works correctly.
const a = pageQuery.parse({});
a.users;
a.users2;
a.users3;

const _a: InferFields<Schema, ReturnType<typeof userModel.fragment>> = {
  id: "1",
  name: "John Doe",
  userName: "John Doe",
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

// type _a = FieldPaths<Schema, ReturnType<typeof userModel.fragment>>; // debug type
