/**
 * Type-level tests for nested object field selection.
 *
 * Tests that deeply nested object selections produce correct output types.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { type NestedSchema, nestedInputTypeMethods, nestedSchema } from "./_fixtures";
import type { EqualPublic, Expect, Extends } from "./_helpers";

const gql = createGqlElementComposer<NestedSchema, StandardDirectives>(nestedSchema, {
  inputTypeMethods: nestedInputTypeMethods,
});

describe("Nested object selection type inference", () => {
  describe("Single level nesting", () => {
    it("infers nested object field", () => {
      const GetPost = gql(({ query, $var }) =>
        query.operation({
          name: "GetPost",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.post({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.title(),
              ...f.author()(({ f }) => ({
                ...f.id(),
                ...f.name(),
              })),
            })),
          }),
        }),
      );

      type Output = typeof GetPost.$infer.output;
      type Expected = {
        post:
          | {
              id: string;
              title: string;
              author: { id: string; name: string };
            }
          | null
          | undefined;
      };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });

  describe("Multi-level nesting", () => {
    it("infers deeply nested structure", () => {
      const GetUserPosts = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.name(),
              ...f.posts({})(({ f }) => ({
                ...f.id(),
                ...f.title(),
                ...f.comments()(({ f }) => ({
                  ...f.id(),
                  ...f.text(),
                })),
              })),
            })),
          }),
        }),
      );

      type Output = typeof GetUserPosts.$infer.output;
      // User -> posts -> comments (3 levels)
      // Output extends the expected shape (has user with nested structure)
      type _TestHasUser = Expect<
        Extends<
          Output,
          {
            user:
              | {
                  id: string;
                  name: string;
                  posts: Array<{ id: string; title: string; comments: Array<{ id: string; text: string }> }>;
                }
              | null
              | undefined;
          }
        >
      >;
      expect(true).toBe(true);
    });
  });

  describe("Circular references", () => {
    it("handles User -> posts -> author (back to User)", () => {
      const GetUserWithPostAuthors = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.posts({})(({ f }) => ({
                ...f.id(),
                ...f.author()(({ f }) => ({
                  ...f.id(),
                  ...f.name(),
                })),
              })),
            })),
          }),
        }),
      );

      type Output = typeof GetUserWithPostAuthors.$infer.output;
      // Circular reference: User -> posts -> author (User type)
      type _TestCircular = Expect<
        Extends<
          {
            user:
              | {
                  id: string;
                  posts: Array<{ id: string; author: { id: string; name: string } }>;
                }
              | null
              | undefined;
          },
          Output
        >
      >;
      expect(true).toBe(true);
    });
  });

  describe("List nesting", () => {
    it("infers list of nested objects", () => {
      const GetUserPosts = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.posts({})(({ f }) => ({
                ...f.id(),
                ...f.title(),
              })),
            })),
          }),
        }),
      );

      type Output = typeof GetUserPosts.$infer.output;
      // posts: [Post!]! -> Array<{ id: string; title: string }>
      type _TestList = Expect<Extends<{ user: { posts: Array<{ id: string; title: string }> } | null | undefined }, Output>>;
      expect(true).toBe(true);
    });
  });

  describe("Fragment on nested type", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers fragment spread in nested selection", () => {
      const postFragment = gql(({ fragment }) =>
        fragment`fragment PostNestedFields on Post { id title }`(),
      );

      const GetUserWithPosts = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.posts({})(() => ({
                ...postFragment.spread(),
              })),
            })),
          }),
        }),
      );

      // Runtime behavior tests
      expect(GetUserWithPosts.operationName).toBe("GetUser");
      expect(postFragment.typename).toBe("Post");
    });
  });
});
