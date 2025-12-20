import { describe, expect, it } from "bun:test";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime/runtime-adapter";
import type { AnyGraphqlSchema } from "../types/schema/schema";
import { Projection } from "../types/runtime/projection";
import { createGqlElementComposer } from "./gql-composer";
import { define, defineOperationRoots, defineScalar } from "../schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../schema/type-specifier-builder";
import { createRuntimeAdapter } from "../runtime/runtime-adapter";

const schema = {
  label: "test" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:!", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const adapter = createRuntimeAdapter(({ type }) => ({
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
})) satisfies AnyGraphqlRuntimeAdapter;

describe("createGqlInvoker", () => {
  const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

  it("provides variable builders sourced from schema metadata", () => {
    let idVarRef: Record<string, any> | undefined;
    let fieldArgRef: any;

    const userModel = gql(({ model }, { $var }) => {
      idVarRef = $var("id").scalar("ID:!");
      fieldArgRef = $var("id").byField("Query", "user", "id");

      return model.User(
        {},
        ({ f }) => [
          //
          f.id(),
          f.name(),
        ],
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
      model.User(
        {},
        ({ f }) => [
          //
          f.id(),
          f.name(),
        ],
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
      model.User(
        {},
        ({ f }) => [
          //
          f.id(),
          f.name(),
        ],
        (selected) => ({
          id: selected.id,
          name: selected.name,
        }),
      ),
    );

    const userSlice = gql(({ query }, { $var }) =>
      query.slice(
        { variables: [$var("id").scalar("ID:!")] },
        ({ f, $ }) => [
          //
          f.user({ id: $.id })(() => [
            //
            userModel.fragment(),
          ]),
        ],
        ({ select }) => select(["$.user"], (result) => result.safeUnwrap(([data]) => userModel.normalize(data))),
      ),
    );

    const sliceFragment = userSlice.embed({ id: "1" });
    expect(sliceFragment.projection).toBeInstanceOf(Projection);

    const profileQuery = gql(({ query }, { $var }) =>
      query.composed(
        {
          operationName: "ProfilePageQuery",
          variables: [$var("userId").scalar("ID:!")],
        },
        ({ $ }) => ({
          user: userSlice.embed({ id: $.userId }),
        }),
      ),
    );

    expect(profileQuery.operationName).toBe("ProfilePageQuery");
    expect(typeof profileQuery.parse).toBe("function");
  });
});
