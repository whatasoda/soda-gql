import { describe, expect, it } from "bun:test";
import { define, defineOperationRoots, defineScalar, unsafeInputType, unsafeOutputType } from "../schema";
import type { AnyGraphqlSchema } from "../types/schema";
import { createGqlElementComposer } from "./gql-composer";

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

describe("createGqlInvoker", () => {
  const gql = createGqlElementComposer<Schema>(schema);

  it("provides variable builders sourced from schema metadata", () => {
    let idVarRef: Record<string, any> | undefined;
    let fieldArgRef: any;

    const userModel = gql(({ model }, { $var }) => {
      idVarRef = $var("id").scalar("ID:!");
      fieldArgRef = $var("id").byField("Query", "user", "id");

      return model.User({}, ({ f }) => [
        //
        f.id(),
        f.name(),
      ]);
    });

    expect(userModel.typename).toBe("User");
    expect(idVarRef?.id.kind).toBe("scalar");
    expect(idVarRef?.id.name).toBe("ID");
    expect(idVarRef?.id.modifier).toBe("!");
    expect(fieldArgRef?.kind).toBe("scalar");
    expect(fieldArgRef?.name).toBe("ID");
    expect(fieldArgRef?.modifier).toBe("!");
  });

  it("creates model descriptors with fragment wiring", () => {
    const userModel = gql(({ model }) =>
      model.User({}, ({ f }) => [
        //
        f.id(),
        f.name(),
      ]),
    );

    expect(userModel.typename).toBe("User");
    const fragment = userModel.fragment({} as never);
    expect(fragment).toHaveProperty("id");
    expect(fragment).toHaveProperty("name");
  });

  it("creates inline operations with variable references", () => {
    const userModel = gql(({ model }) =>
      model.User({}, ({ f }) => [
        //
        f.id(),
        f.name(),
      ]),
    );

    const profileQuery = gql(({ query }, { $var }) =>
      query.operation(
        {
          operationName: "ProfilePageQuery",
          variables: [$var("userId").scalar("ID:!")],
        },
        ({ f, $ }) => [
          //
          f.user({ id: $.userId })(({ f }) => [
            //
            f.id(),
            f.name(),
          ]),
        ],
      ),
    );

    expect(profileQuery.operationName).toBe("ProfilePageQuery");
    expect(profileQuery.operationType).toBe("query");
  });
});
