/**
 * Type-level tests for union field selection.
 *
 * Tests that union field selections produce discriminated union types.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import { type UnionSchema, unionInputTypeMethods, unionSchema } from "./_fixtures";
import type { Expect, Extends } from "./_helpers";

const gql = createGqlElementComposer<UnionSchema, FragmentBuildersAll<UnionSchema>, StandardDirectives>(unionSchema, {
  inputTypeMethods: unionInputTypeMethods,
});

describe("Union field selection type inference", () => {
  describe("Basic union selection with shorthand", () => {
    it("infers union field with shorthand syntax", () => {
      const Search = gql(({ query, $var }) =>
        query.operation({
          name: "Search",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            // Union selection uses object with member types as keys (shorthand)
            ...f.search({ query: $.query })({
              User: () => ({
                id: true,
                name: true,
              }),
              Post: () => ({
                id: true,
                title: true,
              }),
            }),
          }),
        }),
      );

      type Output = typeof Search.$infer.output;
      // search returns array of union results
      type _TestHasSearch = Expect<Extends<Output, { search: unknown[] }>>;
      expect(true).toBe(true);
    });
  });

  describe("Union selection with factory syntax", () => {
    it("infers union with nested field builders", () => {
      const Search = gql(({ query, $var }) =>
        query.operation({
          name: "Search",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              User: ({ f }) => ({
                ...f.id(),
                ...f.name(),
              }),
              Post: ({ f }) => ({
                ...f.id(),
                ...f.title(),
              }),
            }),
          }),
        }),
      );

      type Output = typeof Search.$infer.output;
      type SearchResult = Output["search"][number];

      // User member should have name field
      type _TestUnion = Expect<Extends<SearchResult, { id: string; name: string } | { id: string; title: string }>>;
      expect(true).toBe(true);
    });
  });

  describe("Partial member selection", () => {
    it("allows selecting only some union members", () => {
      const Search = gql(({ query, $var }) =>
        query.operation({
          name: "Search",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            // Only select User, not Post or Comment
            ...f.search({ query: $.query })({
              User: () => ({
                id: true,
                name: true,
              }),
            }),
          }),
        }),
      );

      type Output = typeof Search.$infer.output;
      // Result type still compiles when only selecting some members
      type _TestCompiles = Expect<Extends<Output, { search: unknown[] }>>;
      expect(true).toBe(true);
    });
  });

  describe("Nullable union field", () => {
    it("infers nullable union result", () => {
      const GetNode = gql(({ query, $var }) =>
        query.operation({
          name: "GetNode",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.node({ id: $.id })({
              User: () => ({
                id: true,
              }),
              Post: () => ({
                id: true,
              }),
            }),
          }),
        }),
      );

      type Output = typeof GetNode.$infer.output;
      // node is nullable (SearchResult?)
      type _TestNullable = Expect<Extends<Output, { node: object | null | undefined }>>;
      expect(true).toBe(true);
    });
  });

  describe("__typename: true catch-all", () => {
    it("includes __typename for all union members", () => {
      const Search = gql(({ query, $var }) =>
        query.operation({
          name: "Search",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              User: ({ f }) => ({ ...f.id() }),
              __typename: true,
            }),
          }),
        }),
      );

      type Output = typeof Search.$infer.output;
      type SearchResult = Output["search"][number];

      // All union members should have __typename (using readonly to match inferred type)
      type _TestUser = Expect<Extends<{ readonly __typename: "User"; readonly id: string }, SearchResult>>;
      type _TestPost = Expect<Extends<{ readonly __typename: "Post" }, SearchResult>>;
      type _TestComment = Expect<Extends<{ readonly __typename: "Comment" }, SearchResult>>;
      expect(true).toBe(true);
    });

    it("includes selected fields with __typename for selected members", () => {
      const Search = gql(({ query, $var }) =>
        query.operation({
          name: "Search",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              User: ({ f }) => ({ ...f.id(), ...f.name() }),
              Post: ({ f }) => ({ ...f.id(), ...f.title() }),
              __typename: true,
            }),
          }),
        }),
      );

      type Output = typeof Search.$infer.output;
      type SearchResult = Output["search"][number];

      // Selected members should have their fields + __typename
      type _TestUser = Expect<Extends<{ readonly __typename: "User"; readonly id: string; readonly name: string }, SearchResult>>;
      type _TestPost = Expect<
        Extends<{ readonly __typename: "Post"; readonly id: string; readonly title: string }, SearchResult>
      >;
      // Unselected member should have only __typename
      type _TestComment = Expect<Extends<{ readonly __typename: "Comment" }, SearchResult>>;
      expect(true).toBe(true);
    });

    it("maintains backward compatibility without __typename flag", () => {
      const Search = gql(({ query, $var }) =>
        query.operation({
          name: "Search",
          variables: { ...$var("query").String("!") },
          fields: ({ f, $ }) => ({
            ...f.search({ query: $.query })({
              User: ({ f }) => ({ ...f.id() }),
            }),
          }),
        }),
      );

      type Output = typeof Search.$infer.output;
      type SearchResult = Output["search"][number];

      // Without __typename flag, only User appears with id (no __typename)
      type _TestOnlyUser = Expect<Extends<SearchResult, { readonly id: string }>>;
      expect(true).toBe(true);
    });

    it("works with nullable union field", () => {
      const GetNode = gql(({ query, $var }) =>
        query.operation({
          name: "GetNode",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.node({ id: $.id })({
              User: () => ({ id: true }),
              __typename: true,
            }),
          }),
        }),
      );

      type Output = typeof GetNode.$infer.output;
      // node is nullable and all members should have __typename
      type _TestNullable = Expect<
        Extends<Output, { readonly node: { readonly __typename: "User" | "Post" | "Comment" } | null | undefined }>
      >;
      expect(true).toBe(true);
    });
  });
});
