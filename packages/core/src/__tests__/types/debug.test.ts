import type { InferFromSelectedFields } from "../../types/document";
import type { InlineModelFn, ModelFn } from "../../types/model";
import {
  createDefineUnionType,
  createTypeRefFactories,
  defineEnum,
  defineInputType,
  defineObjectType,
  defineScalar,
  type GraphqlSchema,
  unsafeRef,
} from "../../types/schema";

type Scalars = {
  string: string;
  int: number;
  float: number;
  boolean: boolean;
  id: string;
};

const scalars = {
  ...defineScalar("string")<Scalars["string"]>(),
  ...defineScalar("int")<Scalars["int"]>(),
  ...defineScalar("float")<Scalars["float"]>(),
  ...defineScalar("boolean")<Scalars["boolean"]>(),
  ...defineScalar("id")<Scalars["id"]>(),
};
const enums = {
  ...defineEnum("direction")({
    up: true,
    down: true,
    left: true,
    right: true,
  }),
};
const inputs = {
  ...defineInputType("point")<{ x: Scalars["int"]; y: Scalars["int"] }>()({
    x: unsafeRef.scalar("int", "!"),
    y: unsafeRef.scalar("int", "!"),
  }),
};
const objects = {
  ...defineObjectType("point")<{ x: Scalars["int"]; y: Scalars["int"] }>()({
    x: {
      arguments: {
        input: unsafeRef.input("point", "!"),
      },
      type: unsafeRef.scalar("int", "!"),
    },
    y: {
      arguments: {
        input: unsafeRef.input("point", "!"),
      },
      type: unsafeRef.scalar("int", "!"),
    },
  }),
  ...defineObjectType("user")<{ id: Scalars["id"]; name: Scalars["string"] }>()({
    id: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    name: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    posts: {
      arguments: {},
      type: unsafeRef.object("post", "![]!"),
    },
    postOrComment: {
      arguments: {},
      type: unsafeRef.union("postOrComment", "![]!"),
    },
  }),
  ...defineObjectType("post")<{
    id: Scalars["id"];
    title: Scalars["string"];
    content: Scalars["string"];
    userId: Scalars["id"];
  }>()({
    id: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    title: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    content: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    userId: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
  }),
  ...defineObjectType("comment")<{
    id: Scalars["id"];
    content: Scalars["string"];
    userId: Scalars["id"];
    postId: Scalars["id"];
  }>()({
    id: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    content: {
      arguments: {},
      type: unsafeRef.scalar("string", "!"),
    },
    userId: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
    postId: {
      arguments: {},
      type: unsafeRef.scalar("id", "!"),
    },
  }),
};
const query_root = {
  ...defineObjectType("query_root")<{}>()({
    users: {
      arguments: {},
      type: unsafeRef.object("user", "![]!"),
    },
    posts: {
      arguments: {},
      type: unsafeRef.object("post", "![]!"),
    },
    comments: {
      arguments: {},
      type: unsafeRef.object("comment", "![]!"),
    },
  }),
};
const defineUnionType = createDefineUnionType(objects);
const unions = {
  ...defineUnionType("postOrComment")({ post: true, comment: true }),
};

export const schema = {
  schema: {
    query: "query_root",
    mutation: "mutation_root",
    subscription: "subscription_root",
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
createTypeRefFactories(schema);

declare const model: ModelFn<typeof schema>;
declare const inlineModel: InlineModelFn<typeof schema>;

const c = model(
  "user",
  ({ fields }) => ({
    ...fields.id(),
    ...fields.name(),
    ...fields.posts(
      {},
      inlineModel("post", ({ fields }) => ({
        ...fields.id(),
        ...fields.title(),
      })),
    ),
    ...fields.postOrComment(
      {},
      {
        ...inlineModel("post", ({ fields }) => ({
          ...fields.id(),
          ...fields.title(),
        })),
        ...inlineModel("comment", ({ fields }) => ({
          ...fields.id(),
          ...fields.content(),
        })),
      },
    ),
  }),
  (data) => data,
);

const _a: InferFromSelectedFields<typeof schema, typeof c.typeName, typeof c.fields> = {
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
      id: "1",
      title: "Post 1",
    },
  ],
};
