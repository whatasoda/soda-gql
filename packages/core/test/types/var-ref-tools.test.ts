/**
 * Type-level tests for SchemaAwareGetValueAt inference.
 *
 * Tests that the selector proxy parameter in $var.getValueAt is correctly typed
 * based on the VarRef's schema type, enabling type-safe field access.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { type InputObjectSchema, inputObjectSchema } from "./_fixtures";
import type { Expect, Extends } from "./_helpers";

const gql = createGqlElementComposer<InputObjectSchema, StandardDirectives>(inputObjectSchema, {});

describe("SchemaAwareGetValueAt type inference", () => {
  it("getValueAt returns correctly typed value for input object field", () => {
    gql(({ query }) =>
      query("GetUsers")({
        variables: `($filter: UserFilter!)`,
        metadata: ({ $ }) => {
          // Call getValueAt to access a field on the UserFilter input object
          const nameVal = $var.getValueAt($.filter, (p) => p.name);
          type NameType = typeof nameVal;
          // name is String:? in UserFilter → string | null | undefined
          type _T1 = Expect<Extends<string, NameType>>;

          const ageVal = $var.getValueAt($.filter, (p) => p.minAge);
          type AgeType = typeof ageVal;
          // minAge is Int:? in UserFilter → number | null | undefined
          type _T2 = Expect<Extends<number, AgeType>>;

          return { nameVal, ageVal };
        },
        fields: ({ f, $ }) => ({
          ...f("users", { filter: $.filter })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    expect(true).toBe(true);
  });

  it("getNameAt returns string for input object VarRef", () => {
    gql(({ query }) =>
      query("GetUsers")({
        variables: `($filter: UserFilter!)`,
        metadata: ({ $ }) => {
          const name = $var.getNameAt($.filter, (p) => p.name);
          type NameResult = typeof name;
          // getNameAt always returns string
          type _T1 = Expect<Extends<NameResult, string>>;

          return { name };
        },
        fields: ({ f, $ }) => ({
          ...f("users", { filter: $.filter })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    expect(true).toBe(true);
  });
});
