import { describe, expect, it } from "bun:test";
import {
  type AnyGraphqlRuntimeAdapter,
  type AnyGraphqlSchema,
  createGqlInvoker,
  define,
  defineOperationRoots,
  defineScalar,
  Projection,
  unsafeInputRef,
  unsafeOutputRef,
} from "../../../packages/core";
import { createRuntimeAdapter } from "../../../packages/runtime";

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
        user: unsafeOutputRef.object("User:!", {
          arguments: {
            id: unsafeInputRef.scalar("ID:!", {}),
          },
          directives: {},
        }),
      },
      {},
    ),
    ...define("Mutation").object({}, {}),
    ...define("Subscription").object({}, {}),
    ...define("User").object(
      {
        id: unsafeOutputRef.scalar("ID:!", { directives: {} }),
        name: unsafeOutputRef.scalar("String:!", { directives: {} }),
      },
      {},
    ),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const adapter = createRuntimeAdapter(({ type }) => ({
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
})) satisfies AnyGraphqlRuntimeAdapter;

describe("createGqlInvoker", () => {
  const gql = createGqlInvoker<Schema, typeof adapter>(schema);

  it("provides variable builders sourced from schema metadata", () => {
    let idVarRef: Record<string, any> | undefined;
    let fieldArgRef: any;

    const userModel = gql(({ model }, { $ }) => {
      idVarRef = $("id").scalar("ID:!");
      fieldArgRef = $("id").byField("Query", "user", "id");

      return model(
        { typename: "User" },
        ({ f }) => ({
          ...f.id(),
          ...f.name(),
        }),
        (selected) => ({
          id: selected.id,
          label: selected.name,
        }),
      );
    });

    expect(userModel.typename).toBe("User");
    expect(idVarRef?.id.kind).toBe("scalar");
    expect(idVarRef?.id.name).toBe("ID");
    expect(idVarRef?.id.modifier).toBe("!");
    expect(fieldArgRef?.kind).toBe("scalar");
    expect(fieldArgRef?.name).toBe("ID");
    expect(fieldArgRef?.modifier).toBe("!");
  });

  it("creates model descriptors with fragment + normalize wiring", () => {
    const userModel = gql(({ model }) =>
      model(
        { typename: "User" },
        ({ f }) => ({
          ...f.id(),
          ...f.name(),
        }),
        (selected) => ({
          id: selected.id,
          label: selected.name,
        }),
      ),
    );

    expect(userModel.typename).toBe("User");
    const fragment = userModel.fragment({} as never);
    expect(fragment).toHaveProperty("id");
    expect(fragment).toHaveProperty("name");
    expect(userModel.normalize({ id: "1", name: "Ada" })).toEqual({
      id: "1",
      label: "Ada",
    });
  });

  it("creates query slices and operations that reuse registered models", () => {
    const userModel = gql(({ model }) =>
      model(
        { typename: "User" },
        ({ f }) => ({
          ...f.id(),
          ...f.name(),
        }),
        (selected) => ({
          id: selected.id,
          name: selected.name,
        }),
      ),
    );

    const userSlice = gql(({ slice }, { $ }) =>
      slice.query(
        { variables: $("id").scalar("ID:!") },
        ({ _: f, $: $$ }) => ({
          ...f.user({ id: $$.id }, () => ({
            ...userModel.fragment(),
          })),
        }),
        ({ select }) => select(["$.user"], (result) => result.safeUnwrap(([data]) => userModel.normalize(data))),
      ),
    );

    const sliceFragment = userSlice.build({ id: "1" });
    expect(sliceFragment.projection).toBeInstanceOf(Projection);

    const profileQuery = gql(({ operation }, { $ }) =>
      operation.query(
        {
          operationName: "ProfilePageQuery",
          variables: $("userId").scalar("ID:!"),
        },
        ({ $: $$ }) => ({
          user: userSlice.build({ id: $$.userId }),
        }),
      ),
    );

    expect(profileQuery.operationName).toBe("ProfilePageQuery");
    expect(typeof profileQuery.parse).toBe("function");
  });
});
