import { describe, expect, it } from "bun:test";

import {
  AnyGraphqlSchema,
  createGql,
  define,
  defineOperationTypeNames,
  empty,
  GraphqlAdapter,
  unsafeRef,
} from "../../../packages/core/src/index";

const schema = {
  operations: defineOperationTypeNames({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...define("ID").scalar<string>(),
    ...define("String").scalar<string>(),
  },
  enum: {},
  input: {},
  object: {
    ...define("Query").object({
      user: {
        arguments: {
          id: unsafeRef.scalar("ID", "!"),
        },
        type: unsafeRef.object("User", "!"),
      },
    }),
    ...define("Mutation").object({}),
    ...define("Subscription").object({}),
    ...define("User").object({
      id: {
        arguments: {},
        type: unsafeRef.scalar("ID", "!"),
      },
      name: {
        arguments: {},
        type: unsafeRef.scalar("String", "!"),
      },
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema;

const adapter = {
  createError: (raw: unknown) => raw,
} satisfies GraphqlAdapter;

describe("createGql", () => {
  const gql = createGql<Schema, typeof adapter>({ schema, adapter });

  it("exposes ref factories and schema helpers", () => {
    expect(typeof gql.scalar).toBe("function");
    expect(typeof gql.fieldArg).toBe("function");

    const idRef = gql.scalar("ID", "!");
    expect(idRef.kind).toBe("scalar");
    expect(idRef.name).toBe("ID");
    expect(idRef.format).toBe("!");

    const fieldArg = gql.fieldArg("Query", "user", "id");
    expect(fieldArg.name).toBe("ID");
  });

  it("creates model descriptors with fragment + transform wiring", () => {
    const userModel = gql.model(
      "User",
      ({ f }) => ({
        ...f.id(),
        ...f.name(),
      }),
      (selected) => ({
        id: selected.id,
        label: selected.name,
      }),
    );

    expect(userModel.typename).toBe("User");
    expect(userModel.variables).toEqual(empty());
    const fragment = userModel.fragment({} as never);
    expect(fragment).toHaveProperty("id");
    expect(fragment).toHaveProperty("name");
    expect(userModel.transform({ id: "1", name: "Ada" })).toEqual({
      id: "1",
      label: "Ada",
    });
  });

  it("creates query slices and operations that reuse registered models", () => {
    const userModel = gql.model(
      "User",
      ({ f }) => ({
        ...f.id(),
        ...f.name(),
      }),
      (selected) => ({
        id: selected.id,
        name: selected.name,
      }),
    );

    const userSliceFactory = gql.querySlice(
      [
        {
          id: gql.scalar("ID", "!"),
        },
      ],
      ({ f, $ }) => ({
        ...f.user({ id: $.id }, () => ({
          ...userModel.fragment({}),
        })),
      }),
      ({ select }) => select("$.user", (result) => result.safeUnwrap((data) => userModel.transform(data))),
    );

    const slice = userSliceFactory({ id: "1" });
    expect(slice.operation).toBe("query");
    expect(typeof slice.transform).toBe("function");

    const profileQuery = gql.query(
      "ProfilePageQuery",
      {
        userId: gql.scalar("ID", "!"),
      },
      ({ $ }) => ({
        user: userSliceFactory({ id: $.userId }),
      }),
    );

    expect(profileQuery.name).toBe("ProfilePageQuery");
    expect(typeof profileQuery.transform).toBe("function");
    expect(profileQuery.variables).toHaveProperty("userId");
  });
});
