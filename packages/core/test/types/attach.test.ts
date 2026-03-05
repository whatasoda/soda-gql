/**
 * Type-level tests for the attach method inference chain.
 *
 * Tests that attaching properties to operations/fragments produces
 * correct property name and value type inference.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { type BasicSchema, basicInputTypeMethods, basicSchema } from "./_fixtures";
import type { Equal, Expect, HasKey } from "./_helpers";

const gql = createGqlElementComposer<BasicSchema, StandardDirectives>(basicSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("attach type inference", () => {
  it("single attachment infers property name and value type", () => {
    const GetUser = gql(({ query }) =>
      query.operation({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.users({})(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
    ).attach({ name: "utils" as const, createValue: () => ({ helper: 42 }) });

    type Result = typeof GetUser;

    // Property name "utils" must exist on result
    type _Test1 = Expect<HasKey<Result, "utils">>;

    // Value type must be exactly { helper: number }
    type UtilsValue = Result["utils"];
    type _Test2 = Expect<Equal<UtilsValue, { helper: number }>>;

    expect(true).toBe(true);
  });

  it("array attachment with as const infers intersection of all properties", () => {
    const GetUsers = gql(({ query }) =>
      query.operation({
        name: "GetUsers",
        fields: ({ f }) => ({
          ...f.users({})(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
    ).attach([
      { name: "alpha" as const, createValue: () => ({ x: 1 }) },
      { name: "beta" as const, createValue: () => ({ y: "hello" }) },
      { name: "gamma" as const, createValue: () => ({ z: true }) },
    ] as const);

    type Result = typeof GetUsers;

    // All property names from the array must exist on result
    type _Test1 = Expect<HasKey<Result, "alpha">>;
    type _Test2 = Expect<HasKey<Result, "beta">>;
    type _Test3 = Expect<HasKey<Result, "gamma">>;

    expect(true).toBe(true);
  });

  it("chained attachments accumulate properties", () => {
    const GetUser = gql(({ query }) =>
      query.operation({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.users({})(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
    )
      .attach({ name: "first" as const, createValue: () => ({ a: 1 }) })
      .attach({ name: "second" as const, createValue: () => ({ b: "two" }) });

    type Result = typeof GetUser;

    // Both properties from chained attachments must exist
    type _Test1 = Expect<HasKey<Result, "first">>;
    type _Test2 = Expect<HasKey<Result, "second">>;

    // Value types must be correctly inferred for each
    type FirstValue = Result["first"];
    type _Test3 = Expect<Equal<FirstValue, { a: number }>>;

    type SecondValue = Result["second"];
    type _Test4 = Expect<Equal<SecondValue, { b: string }>>;

    expect(true).toBe(true);
  });
});
