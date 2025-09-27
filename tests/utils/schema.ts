import {
  type AnyGraphqlSchema,
  define,
  defineOperationRoots,
  defineScalar,
  type GraphqlRuntimeAdapter,
  pseudoTypeAnnotation,
  unsafeInputRef,
  unsafeOutputRef,
} from "../../packages/core/src/index.ts";

/**
 * Create standard GraphQL scalar definitions
 */
export const createStandardScalars = () => ({
  ...defineScalar("ID", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
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
});

/**
 * Create a basic GraphQL schema with standard operations
 */
export const createBasicSchema = (overrides: Partial<AnyGraphqlSchema> = {}): AnyGraphqlSchema => ({
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: createStandardScalars(),
  enum: {},
  input: {},
  object: {
    ...define("Query").object({}, {}),
    ...define("Mutation").object({}, {}),
    ...define("Subscription").object({}, {}),
    ...overrides.object,
  },
  union: {},
  ...overrides,
});

/**
 * Create a minimal query-only schema
 */
export const createQueryOnlySchema = (overrides: Partial<AnyGraphqlSchema> = {}): AnyGraphqlSchema => ({
  operations: defineOperationRoots({
    query: "Query",
    mutation: null,
    subscription: null,
  }),
  scalar: createStandardScalars(),
  enum: {},
  input: {},
  object: {
    ...define("Query").object({}, {}),
    ...overrides.object,
  },
  union: {},
  ...overrides,
});

/**
 * Create standard runtime adapter
 */
export const createStandardAdapter = (): GraphqlRuntimeAdapter => {
  const nonGraphqlErrorType = pseudoTypeAnnotation<{
    type: "non-graphql-error";
    cause: unknown;
  }>();

  return { nonGraphqlErrorType };
};

/**
 * Create a test schema with User type
 */
export const createUserSchema = (): AnyGraphqlSchema => {
  const scalar = createStandardScalars();

  return {
    operations: defineOperationRoots({
      query: "Query",
      mutation: null,
      subscription: null,
    }),
    scalar,
    enum: {},
    input: {},
    object: {
      ...define("Query").object(
        {
          user: unsafeOutputRef.object(
            ["User", "!"],
            {
              id: unsafeInputRef.scalar(["ID", "!"], null, {}),
            },
            {},
          ),
          users: unsafeOutputRef.object(["User", "!", "[]", "!"], {}, {}),
        },
        {},
      ),
      ...define("User").object(
        {
          id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
          name: unsafeOutputRef.scalar(["String", "!"], {}, {}),
          email: unsafeOutputRef.scalar(["String"], {}, {}),
        },
        {},
      ),
    },
    union: {},
  };
};

/**
 * Create a test schema with Post and Author types
 */
export const createBlogSchema = (): AnyGraphqlSchema => {
  const scalar = createStandardScalars();

  return {
    operations: defineOperationRoots({
      query: "Query",
      mutation: "Mutation",
      subscription: null,
    }),
    scalar,
    enum: {},
    input: {
      ...define("CreatePostInput").input({
        title: unsafeInputRef.scalar(["String", "!"], null, {}),
        content: unsafeInputRef.scalar(["String", "!"], null, {}),
        authorId: unsafeInputRef.scalar(["ID", "!"], null, {}),
      }),
    },
    object: {
      ...define("Query").object(
        {
          post: unsafeOutputRef.object(
            ["Post"],
            {
              id: unsafeInputRef.scalar(["ID", "!"], null, {}),
            },
            {},
          ),
          posts: unsafeOutputRef.object(["Post", "!", "[]", "!"], {}, {}),
        },
        {},
      ),
      ...define("Mutation").object(
        {
          createPost: unsafeOutputRef.object(
            ["Post", "!"],
            {
              input: unsafeInputRef.object(["CreatePostInput", "!"], null, {}),
            },
            {},
          ),
        },
        {},
      ),
      ...define("Post").object(
        {
          id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
          title: unsafeOutputRef.scalar(["String", "!"], {}, {}),
          content: unsafeOutputRef.scalar(["String", "!"], {}, {}),
          author: unsafeOutputRef.object(["Author", "!"], {}, {}),
          createdAt: unsafeOutputRef.scalar(["String", "!"], {}, {}),
        },
        {},
      ),
      ...define("Author").object(
        {
          id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
          name: unsafeOutputRef.scalar(["String", "!"], {}, {}),
          posts: unsafeOutputRef.object(["Post", "!", "[]", "!"], {}, {}),
        },
        {},
      ),
    },
    union: {},
  };
};
