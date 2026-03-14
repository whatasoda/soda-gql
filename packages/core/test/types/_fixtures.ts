/**
 * Extended schema fixtures for type-level testing.
 *
 * These schemas provide comprehensive type combinations for testing
 * type inference in Fragment, Operation, and other user-facing APIs.
 *
 * @module
 */

import { defineOperationRoots, defineScalar } from "../../src/schema";
import type { AnyGraphqlSchema, MinimalSchema } from "../../src/types/schema";
import { define, unsafeInputType, unsafeOutputType } from "../utils/schema";

// =============================================================================
// Basic Schema (for simple fragment/operation tests)
// =============================================================================

/**
 * Basic schema with common scalar types.
 * Used for: fragment-definition, operation-definition, variable-builder tests
 */
export const basicSchema = {
  label: "basic" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
      users: unsafeOutputType.object("User:![]!", {
        arguments: {
          limit: unsafeInputType.scalar("Int:?", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({
      updateUser: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
          name: unsafeInputType.scalar("String:!", {}),
        },
      }),
    }),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:?", {}),
      age: unsafeOutputType.scalar("Int:?", {}),
    }),
  },
  union: {},
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies AnyGraphqlSchema & MinimalSchema;

export type BasicSchema = typeof basicSchema & { _?: never };

// =============================================================================
// Nested Schema (for deep object nesting tests)
// =============================================================================

/**
 * Schema with deep object nesting and circular references.
 * Used for: nested-object-selection tests
 *
 * Structure:
 * - User -> posts: [Post!]! -> comments: [Comment!]! -> author: User!
 * - Post -> author: User!
 * - Comment -> author: User!
 */
export const nestedSchema = {
  label: "nested" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
      post: unsafeOutputType.object("Post:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      posts: unsafeOutputType.object("Post:![]!", {
        arguments: {
          limit: unsafeInputType.scalar("Int:?", {}),
        },
      }),
    }),
    Post: define("Post").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      content: unsafeOutputType.scalar("String:?", {}),
      author: unsafeOutputType.object("User:!", {}),
      comments: unsafeOutputType.object("Comment:![]!", {}),
    }),
    Comment: define("Comment").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      text: unsafeOutputType.scalar("String:!", {}),
      author: unsafeOutputType.object("User:!", {}),
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
  },
  union: {},
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies AnyGraphqlSchema & MinimalSchema;

export type NestedSchema = typeof nestedSchema & { _?: never };

// =============================================================================
// Union Schema (for discriminated union tests)
// =============================================================================

/**
 * Schema with union types for testing discriminated union inference.
 * Used for: union-field-selection tests
 *
 * Union: SearchResult = User | Post | Comment
 */
export const unionSchema = {
  label: "union" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      search: unsafeOutputType.union("SearchResult:![]!", {
        arguments: {
          query: unsafeInputType.scalar("String:!", {}),
          limit: unsafeInputType.scalar("Int:?", {}),
        },
      }),
      node: unsafeOutputType.union("SearchResult:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:?", {}),
    }),
    Post: define("Post").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      content: unsafeOutputType.scalar("String:?", {}),
    }),
    Comment: define("Comment").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      text: unsafeOutputType.scalar("String:!", {}),
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
  },
  union: {
    SearchResult: define("SearchResult").union({
      User: true,
      Post: true,
      Comment: true,
    }),
  },
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies AnyGraphqlSchema & MinimalSchema;

export type UnionSchema = typeof unionSchema & { _?: never };

// =============================================================================
// Enum Schema (for enum type tests)
// =============================================================================

/**
 * Schema with enum types for testing enum handling.
 * Used for: variable-builder tests with enum variables
 */
export const enumSchema = {
  label: "enum" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {
    UserRole: define("UserRole").enum({
      ADMIN: true,
      USER: true,
      GUEST: true,
    }),
    PostStatus: define("PostStatus").enum({
      DRAFT: true,
      PUBLISHED: true,
      ARCHIVED: true,
    }),
    SortOrder: define("SortOrder").enum({
      ASC: true,
      DESC: true,
    }),
  },
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
      users: unsafeOutputType.object("User:![]!", {
        arguments: {
          role: unsafeInputType.enum("UserRole:?", {}),
          sortOrder: unsafeInputType.enum("SortOrder:?", {}),
        },
      }),
      posts: unsafeOutputType.object("Post:![]!", {
        arguments: {
          status: unsafeInputType.enum("PostStatus:?", {}),
        },
      }),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      role: unsafeOutputType.enum("UserRole:!", {}),
    }),
    Post: define("Post").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      status: unsafeOutputType.enum("PostStatus:!", {}),
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
  },
  union: {},
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: ["UserRole", "PostStatus", "SortOrder"], input: [] },
} satisfies AnyGraphqlSchema & MinimalSchema;

export type EnumSchema = typeof enumSchema & { _?: never };

// =============================================================================
// Input Object Schema (for complex input type tests)
// =============================================================================

/**
 * Schema with input object types for testing input type handling.
 * Used for: variable-builder tests with input type variables
 */
export const inputObjectSchema = {
  label: "input_object" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {
    SortOrder: define("SortOrder").enum({
      ASC: true,
      DESC: true,
    }),
  },
  input: {
    UserFilter: define("UserFilter").input({
      name: unsafeInputType.scalar("String:?", {}),
      email: unsafeInputType.scalar("String:?", {}),
      minAge: unsafeInputType.scalar("Int:?", {}),
      maxAge: unsafeInputType.scalar("Int:?", {}),
    }),
    UserOrderBy: define("UserOrderBy").input({
      field: unsafeInputType.scalar("String:!", {}),
      order: unsafeInputType.enum("SortOrder:?", {}),
    }),
    CreateUserInput: define("CreateUserInput").input({
      name: unsafeInputType.scalar("String:!", {}),
      email: unsafeInputType.scalar("String:!", {}),
      age: unsafeInputType.scalar("Int:?", {}),
    }),
  },
  object: {
    Query: define("Query").object({
      users: unsafeOutputType.object("User:![]!", {
        arguments: {
          filter: unsafeInputType.input("UserFilter:?", {}),
          orderBy: unsafeInputType.input("UserOrderBy:?", {}),
          limit: unsafeInputType.scalar("Int:?", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({
      createUser: unsafeOutputType.object("User:!", {
        arguments: {
          input: unsafeInputType.input("CreateUserInput:!", {}),
        },
      }),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:!", {}),
      age: unsafeOutputType.scalar("Int:?", {}),
    }),
    Subscription: define("Subscription").object({}),
  },
  union: {},
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: ["SortOrder"], input: ["UserFilter", "UserOrderBy", "CreateUserInput"] },
} satisfies AnyGraphqlSchema & MinimalSchema;

export type InputObjectSchema = typeof inputObjectSchema & { _?: never };

