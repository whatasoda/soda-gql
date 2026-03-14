import { describe, expect, it } from "bun:test";
import { type DocumentNode, Kind, print, visit } from "graphql";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineAdapter } from "../adapter/define-adapter";
import { defineOperationRoots, defineScalar } from "../schema/schema-builder";
import type { DocumentTransformArgs, OperationDocumentTransformArgs } from "../types/metadata";
import type { MinimalSchema } from "../types/schema/schema";
import type { StandardDirectives } from "./directive-builder";
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
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
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
      email: unsafeOutputType.scalar("String:?", {}),
    }),
  },
  union: {},
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies MinimalSchema;

type Schema = typeof schema & { _?: never };

describe("document transformation via adapter", () => {
  it("applies transformDocument to operation document", () => {
    const adapter = defineAdapter({
      transformDocument: ({ document }) => {
        return visit(document, {
          Field: (node) => ({
            ...node,
            directives: [
              ...(node.directives ?? []),
              {
                kind: Kind.DIRECTIVE,
                name: { kind: Kind.NAME, value: "example" },
              },
            ],
          }),
        });
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
            ...f("name")(),
          })),
        }),
      })({}),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@example");
    expect(printed.match(/@example/g)?.length).toBe(3);
  });

  it("receives correct context in transformDocument", () => {
    let capturedContext: DocumentTransformArgs | undefined;

    const adapter = defineAdapter({
      metadata: {
        aggregateFragmentMetadata: (fragments) => ({ count: fragments.length }),
        schemaLevel: { apiVersion: "v2" },
      },
      transformDocument: (args) => {
        capturedContext = args;
        return args.document;
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    void operation.document;

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.operationName).toBe("GetUser");
    expect(capturedContext?.operationType).toBe("query");
    expect(capturedContext?.variableNames).toEqual(["id"]);
    expect(capturedContext?.schemaLevel).toEqual({ apiVersion: "v2" });
    expect(capturedContext?.fragmentMetadata).toEqual({ count: 0 });
  });

  it("does not transform when transformDocument is not provided", () => {
    const adapter = defineAdapter({
      helpers: { test: () => "test" },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    const printed = print(operation.document);
    expect(printed).not.toContain("@");
  });

  it("can add directive to operation definition", () => {
    const adapter = defineAdapter({
      transformDocument: ({ document, operationType }) => {
        if (operationType === "query") {
          return visit(document, {
            OperationDefinition: (node) => ({
              ...node,
              directives: [
                ...(node.directives ?? []),
                {
                  kind: Kind.DIRECTIVE,
                  name: { kind: Kind.NAME, value: "cached" },
                  arguments: [
                    {
                      kind: Kind.ARGUMENT,
                      name: { kind: Kind.NAME, value: "ttl" },
                      value: { kind: Kind.INT, value: "60" },
                    },
                  ],
                },
              ],
            }),
          });
        }
        return document;
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@cached(ttl: 60)");
  });

  it("can remove directives from fields", () => {
    const adapter = defineAdapter({
      transformDocument: ({ document }) => {
        const withDirectives = visit(document, {
          Field: (node) =>
            node.name.value === "id"
              ? {
                  ...node,
                  directives: [
                    ...(node.directives ?? []),
                    { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "toRemove" } },
                    { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "toKeep" } },
                  ],
                }
              : node,
        });

        return visit(withDirectives, {
          Directive: (node) => (node.name.value === "toRemove" ? null : node),
        });
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    const printed = print(operation.document);
    expect(printed).not.toContain("@toRemove");
    expect(printed).toContain("@toKeep");
  });

  it("works with mutation operation type", () => {
    let capturedOperationType: string | undefined;

    const mutationSchema = {
      ...schema,
      object: {
        ...schema.object,
        Mutation: define("Mutation").object({
          createUser: unsafeOutputType.object("User:!", {
            arguments: {
              name: unsafeInputType.scalar("String:!", {}),
            },
          }),
        }),
      },
    } satisfies MinimalSchema;

    type MutationSchema = typeof mutationSchema & { _?: never };

    const adapter = defineAdapter({
      transformDocument: ({ operationType, document }) => {
        capturedOperationType = operationType;
        return document;
      },
    });

    const gql = createGqlElementComposer<MutationSchema, StandardDirectives, typeof adapter>(mutationSchema, {
      adapter,
    });

    const operation = gql(({ mutation }) =>
      mutation("CreateUser")({
        variables: `($name: String!)`,
        fields: ({ f, $ }) => ({
          ...f("createUser", { name: $.name })(({ f }) => ({
            ...f("id")(),
            ...f("name")(),
          })),
        }),
      })({}),
    );

    void operation.document;

    expect(capturedOperationType).toBe("mutation");
  });

  it("transform receives document with correct structure", () => {
    let capturedDocument: DocumentNode | undefined;

    const adapter = defineAdapter({
      transformDocument: ({ document }) => {
        capturedDocument = document;
        return document;
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
            ...f("name")(),
          })),
        }),
      })({}),
    );

    void operation.document;

    expect(capturedDocument).toBeDefined();
    expect(capturedDocument?.kind).toBe(Kind.DOCUMENT);
    expect(capturedDocument?.definitions).toHaveLength(1);
    expect(capturedDocument?.definitions[0]?.kind).toBe(Kind.OPERATION_DEFINITION);
  });

  it("can use schemaLevel to conditionally transform", () => {
    const adapter = defineAdapter({
      metadata: {
        aggregateFragmentMetadata: (fragments) => fragments,
        schemaLevel: { isProduction: true },
      },
      transformDocument: ({ document, schemaLevel }) => {
        if (schemaLevel?.isProduction) {
          return visit(document, {
            OperationDefinition: (node) => ({
              ...node,
              directives: [...(node.directives ?? []), { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "production" } }],
            }),
          });
        }
        return document;
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({}),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@production");
  });
});

describe("operation-level transformDocument", () => {
  it("receives typed operation metadata", () => {
    type OperationMeta = { cacheHint: number; requiresAuth: boolean };
    let capturedArgs: OperationDocumentTransformArgs<OperationMeta> | undefined;

    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({
        metadata: () => ({ cacheHint: 120, requiresAuth: true }),
        transformDocument: (args) => {
          capturedArgs = args;
          return args.document;
        },
      }),
    );

    void operation.document;

    expect(capturedArgs).toBeDefined();
    expect(capturedArgs?.metadata).toEqual({ cacheHint: 120, requiresAuth: true });
  });

  it("can modify document based on typed metadata", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({
        metadata: () => ({ addCacheDirective: true, ttl: 300 }),
        transformDocument: ({ document, metadata }) => {
          if (metadata?.addCacheDirective) {
            return visit(document, {
              OperationDefinition: (node) => ({
                ...node,
                directives: [
                  ...(node.directives ?? []),
                  {
                    kind: Kind.DIRECTIVE,
                    name: { kind: Kind.NAME, value: "cache" },
                    arguments: [
                      {
                        kind: Kind.ARGUMENT,
                        name: { kind: Kind.NAME, value: "ttl" },
                        value: { kind: Kind.INT, value: String(metadata.ttl) },
                      },
                    ],
                  },
                ],
              }),
            });
          }
          return document;
        },
      }),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@cache(ttl: 300)");
  });

  it("applies operation transform before adapter transform", () => {
    const transformOrder: string[] = [];

    const adapter = defineAdapter({
      transformDocument: ({ document }) => {
        transformOrder.push("adapter");
        return visit(document, {
          OperationDefinition: (node) => ({
            ...node,
            directives: [...(node.directives ?? []), { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "fromAdapter" } }],
          }),
        });
      },
    });

    const gql = createGqlElementComposer<Schema, StandardDirectives, typeof adapter>(schema, {
      adapter,
    });

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({
        transformDocument: ({ document }) => {
          transformOrder.push("operation");
          return visit(document, {
            OperationDefinition: (node) => ({
              ...node,
              directives: [
                ...(node.directives ?? []),
                { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "fromOperation" } },
              ],
            }),
          });
        },
      }),
    );

    void operation.document;

    expect(transformOrder).toEqual(["operation", "adapter"]);

    const printed = print(operation.document);
    expect(printed).toContain("@fromOperation");
    expect(printed).toContain("@fromAdapter");
  });

  it("works with only operation transform (no adapter transform)", () => {
    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({
        transformDocument: ({ document }) => {
          return visit(document, {
            Field: (node) => ({
              ...node,
              directives: [...(node.directives ?? []), { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "tracked" } }],
            }),
          });
        },
      }),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@tracked");
  });

  it("receives undefined metadata when no metadata builder", () => {
    let receivedMetadata: unknown = "not-called";

    const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

    const operation = gql(({ query }) =>
      query("GetUser")({
        variables: `($id: ID!)`,
        fields: ({ f, $ }) => ({
          ...f("user", { id: $.id })(({ f }) => ({
            ...f("id")(),
          })),
        }),
      })({
        transformDocument: ({ document, metadata }) => {
          receivedMetadata = metadata;
          return document;
        },
      }),
    );

    void operation.document;

    expect(receivedMetadata).toBeUndefined();
  });
});
