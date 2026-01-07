import { describe, expect, it } from "bun:test";
import { type DocumentNode, Kind, print, visit } from "graphql";
import { define } from "../../test/utils/schema";
import { defineAdapter } from "../adapter/define-adapter";
import { defineOperationRoots, defineScalar } from "../schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../schema/type-specifier-builder";
import type { DocumentTransformArgs, OperationDocumentTransformArgs } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema/schema";
import type { StandardDirectives } from "./directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "./gql-composer";
import { createVarMethod } from "./var-builder";

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
      email: unsafeOutputType.scalar("String:", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const inputTypeMethods = {
  Boolean: createVarMethod("scalar", "Boolean"),
  ID: createVarMethod("scalar", "ID"),
  Int: createVarMethod("scalar", "Int"),
  String: createVarMethod("scalar", "String"),
};

describe("document transformation via adapter", () => {
  it("applies transformDocument to operation document", () => {
    const adapter = defineAdapter({
      transformDocument: ({ document }) => {
        // Add @example directive to all fields
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      }),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@example");
    // Should have @example on user field and nested id, name fields
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
    );

    // Access document to trigger transformation
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@cached(ttl: 60)");
  });

  it("can remove directives from fields", () => {
    const adapter = defineAdapter({
      transformDocument: ({ document }) => {
        // First pass: add directives
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

        // Second pass: remove specific directive
        return visit(withDirectives, {
          Directive: (node) => (node.name.value === "toRemove" ? null : node),
        });
      },
    });

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
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
    } satisfies AnyGraphqlSchema;

    type MutationSchema = typeof mutationSchema & { _?: never };

    const adapter = defineAdapter({
      transformDocument: ({ operationType, document }) => {
        capturedOperationType = operationType;
        return document;
      },
    });

    const gql = createGqlElementComposer<MutationSchema, FragmentBuildersAll<MutationSchema>, StandardDirectives, typeof adapter>(
      mutationSchema,
      { adapter, inputTypeMethods },
    );

    const operation = gql(({ mutation, $var }) =>
      mutation.operation({
        name: "CreateUser",
        variables: { ...$var("name").String("!") },
        fields: ({ f, $ }) => ({
          ...f.createUser({ name: $.name })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      }),
    );

    // Access document to trigger transformation
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      }),
    );

    // Access document to trigger transformation
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
          // Add @production directive in production
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
      }),
    );

    const printed = print(operation.document);
    expect(printed).toContain("@production");
  });
});

describe("operation-level transformDocument", () => {
  it("receives typed operation metadata", () => {
    type OperationMeta = { cacheHint: number; requiresAuth: boolean };
    let capturedArgs: OperationDocumentTransformArgs<OperationMeta> | undefined;

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, {
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        metadata: () => ({ cacheHint: 120, requiresAuth: true }),
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
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
    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, {
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        metadata: () => ({ addCacheDirective: true, ttl: 300 }),
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives, typeof adapter>(schema, {
      adapter,
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
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

    // Operation transform runs first, then adapter transform
    expect(transformOrder).toEqual(["operation", "adapter"]);

    const printed = print(operation.document);
    expect(printed).toContain("@fromOperation");
    expect(printed).toContain("@fromAdapter");
  });

  it("works with only operation transform (no adapter transform)", () => {
    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, {
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
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

    const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(schema, {
      inputTypeMethods,
    });

    const operation = gql(({ query, $var }) =>
      query.operation({
        name: "GetUser",
        variables: { ...$var("id").ID("!") },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.id })(({ f }) => ({
            ...f.id(),
          })),
        }),
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
