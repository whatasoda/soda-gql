import { describe, expect, it } from "bun:test";

import {
  type AnyGraphqlSchema,
  createGqlSingle,
  define,
  defineOperationRoots,
  defineScalar,
  ExecutionResultProjection,
  type GraphqlRuntimeAdapter,
  pseudoTypeAnnotation,
  unsafeInputRef,
  unsafeOutputRef,
} from "../../../packages/core";

const schema = {
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
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
  },
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
      },
      {},
    ),
    ...define("Mutation").object({}, {}),
    ...define("Subscription").object({}, {}),
    ...define("User").object(
      {
        id: unsafeOutputRef.scalar(["ID", "!"], {}, {}),
        name: unsafeOutputRef.scalar(["String", "!"], {}, {}),
      },
      {},
    ),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema;

const nonGraphqlErrorType = pseudoTypeAnnotation<{ type: "non-graphql-error"; cause: unknown }>();

const adapter = {
  nonGraphqlErrorType,
} satisfies GraphqlRuntimeAdapter;

describe("createGql", () => {
  const gql = createGqlSingle<Schema, typeof adapter>({ schema, adapter });

  it("exposes ref factories and schema helpers", () => {
    expect(typeof gql.scalar).toBe("function");
    expect(typeof gql.fieldArg).toBe("function");

    const idRef = gql.scalar(["ID", "!"]);
    expect(idRef.kind).toBe("scalar");
    expect(idRef.name).toBe("ID");
    expect(idRef.modifier).toBe("!");

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
          id: gql.scalar(["ID", "!"]),
        },
      ],
      ({ f, $ }) => ({
        ...f.user({ id: $.id }, () => ({
          ...userModel.fragment(),
        })),
      }),
      ({ select }) => select("$.user", (result) => result.safeUnwrap((data) => userModel.transform(data))),
    );

    const slice = userSliceFactory({ id: "1" });
    expect(slice.operationType).toBe("query");
    expect(slice.projections).toBeInstanceOf(ExecutionResultProjection);

    const profileQuery = gql.query(
      "ProfilePageQuery",
      {
        userId: gql.scalar(["ID", "!"]),
      },
      ({ $ }) => ({
        user: userSliceFactory({ id: $.userId }),
      }),
    );

    expect(profileQuery.name).toBe("ProfilePageQuery");
    expect(typeof profileQuery.parse).toBe("function");
  });
});
