import { describe, expect, it } from "bun:test";

import { createGql, define, GraphqlAdapter, unsafeRef } from "../../../packages/core/src/index";

const schema = {
  schema: {
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  },
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
} as const;

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
    // biome-ignore lint/suspicious/noExplicitAny: test helper exercise
    const userModel = (gql.model as any)(
      "User",
      ({ f }: any) => ({
        ...f.id(),
        ...f.name(),
      }),
      (selected: { id: string; name: string }) => ({
        id: selected.id,
        label: selected.name,
      }),
    );

    expect(userModel.typename).toBe("User");
    expect(userModel.variables).toEqual({});
    const fragment = userModel.fragment({} as never);
    expect(fragment).toHaveProperty("id");
    expect(fragment).toHaveProperty("name");
    expect(userModel.transform({ id: "1", name: "Ada" })).toEqual({
      id: "1",
      label: "Ada",
    });
  });

  it("creates query slices and operations that reuse registered models", () => {
    // biome-ignore lint/suspicious/noExplicitAny: test helper exercise
    const userModel = (gql.model as any)(
      "User",
      ({ f }: any) => ({
        ...f.id(),
        ...f.name(),
      }),
      (selected: { id: string; name: string }) => ({
        id: selected.id,
        name: selected.name,
      }),
    );

    // biome-ignore lint/suspicious/noExplicitAny: test helper exercise
    const userSliceFactory = (gql.querySlice as any)(
      [
        {
          id: gql.scalar("ID", "!"),
        },
      ],
      ({ f, $ }: any) => ({
        user: f.user({ id: $.id }, () => ({
          ...userModel.fragment({}),
        })),
      }),
      ({ select }: any) =>
        select("$.user", (result: any) => result.safeUnwrap((data: { id: string; name: string }) => userModel.transform(data))),
    );

    const slice = userSliceFactory({ id: "1" });
    expect(slice.operation).toBe("query");
    expect(typeof slice.transform).toBe("function");

    // biome-ignore lint/suspicious/noExplicitAny: test helper exercise
    const profileQuery = (gql.query as any)(
      "ProfilePageQuery",
      {
        userId: gql.scalar("ID", "!"),
      },
      ({ $ }: any) => ({
        user: userSliceFactory({ id: $.userId }),
      }),
    );

    expect(profileQuery.name).toBe("ProfilePageQuery");
    expect(typeof profileQuery.transform).toBe("function");
    expect(profileQuery.variables).toHaveProperty("userId");
  });
});
