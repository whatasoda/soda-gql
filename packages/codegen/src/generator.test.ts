import { describe, expect, test } from "bun:test";
import { parse } from "graphql";
import { createSchemaIndex, generateMultiSchemaModule } from "./generator";

describe("createSchemaIndex", () => {
  test("indexes object types", () => {
    const document = parse(`
      type User {
        id: ID!
        name: String!
        email: String
      }
    `);

    const index = createSchemaIndex(document);

    expect(index.objects.size).toBe(1);
    expect(index.objects.has("User")).toBe(true);

    const userRecord = index.objects.get("User");
    expect(userRecord?.name).toBe("User");
    expect(userRecord?.fields.size).toBe(3);
    expect(userRecord?.fields.has("id")).toBe(true);
    expect(userRecord?.fields.has("name")).toBe(true);
    expect(userRecord?.fields.has("email")).toBe(true);
  });

  test("indexes input types", () => {
    const document = parse(`
      input CreateUserInput {
        name: String!
        email: String!
      }
    `);

    const index = createSchemaIndex(document);

    expect(index.inputs.size).toBe(1);
    expect(index.inputs.has("CreateUserInput")).toBe(true);

    const inputRecord = index.inputs.get("CreateUserInput");
    expect(inputRecord?.name).toBe("CreateUserInput");
    expect(inputRecord?.fields.size).toBe(2);
  });

  test("indexes enum types", () => {
    const document = parse(`
      enum Status {
        ACTIVE
        INACTIVE
        PENDING
      }
    `);

    const index = createSchemaIndex(document);

    expect(index.enums.size).toBe(1);
    expect(index.enums.has("Status")).toBe(true);

    const enumRecord = index.enums.get("Status");
    expect(enumRecord?.name).toBe("Status");
    expect(enumRecord?.values.size).toBe(3);
    expect(enumRecord?.values.has("ACTIVE")).toBe(true);
    expect(enumRecord?.values.has("INACTIVE")).toBe(true);
    expect(enumRecord?.values.has("PENDING")).toBe(true);
  });

  test("indexes union types", () => {
    const document = parse(`
      type Dog { name: String! }
      type Cat { name: String! }
      union Pet = Dog | Cat
    `);

    const index = createSchemaIndex(document);

    expect(index.unions.size).toBe(1);
    expect(index.unions.has("Pet")).toBe(true);

    const unionRecord = index.unions.get("Pet");
    expect(unionRecord?.name).toBe("Pet");
    expect(unionRecord?.members.size).toBe(2);
    expect(unionRecord?.members.has("Dog")).toBe(true);
    expect(unionRecord?.members.has("Cat")).toBe(true);
  });

  test("indexes scalar types", () => {
    const document = parse(`
      scalar DateTime
      scalar JSON
    `);

    const index = createSchemaIndex(document);

    expect(index.scalars.size).toBe(2);
    expect(index.scalars.has("DateTime")).toBe(true);
    expect(index.scalars.has("JSON")).toBe(true);
  });

  test("detects operation types from schema definition", () => {
    const document = parse(`
      schema {
        query: RootQuery
        mutation: RootMutation
        subscription: RootSubscription
      }
      type RootQuery { version: String! }
      type RootMutation { noop: Boolean }
      type RootSubscription { events: String! }
    `);

    const index = createSchemaIndex(document);

    expect(index.operationTypes.query).toBe("RootQuery");
    expect(index.operationTypes.mutation).toBe("RootMutation");
    expect(index.operationTypes.subscription).toBe("RootSubscription");
  });

  test("uses default operation type names when schema definition is absent", () => {
    const document = parse(`
      type Query { version: String! }
      type Mutation { noop: Boolean }
      type Subscription { events: String! }
    `);

    const index = createSchemaIndex(document);

    expect(index.operationTypes.query).toBe("Query");
    expect(index.operationTypes.mutation).toBe("Mutation");
    expect(index.operationTypes.subscription).toBe("Subscription");
  });

  test("merges type extensions with definitions", () => {
    const document = parse(`
      type User {
        id: ID!
      }
      extend type User {
        name: String!
      }
    `);

    const index = createSchemaIndex(document);

    expect(index.objects.size).toBe(1);
    const userRecord = index.objects.get("User");
    expect(userRecord?.fields.size).toBe(2);
    expect(userRecord?.fields.has("id")).toBe(true);
    expect(userRecord?.fields.has("name")).toBe(true);
  });

  test("handles extension-only types", () => {
    const document = parse(`
      extend type Query {
        users: [User!]!
      }
      type User { id: ID! }
    `);

    const index = createSchemaIndex(document);

    expect(index.objects.has("Query")).toBe(true);
    const queryRecord = index.objects.get("Query");
    expect(queryRecord?.fields.has("users")).toBe(true);
  });

  test("indexes field arguments", () => {
    const document = parse(`
      type Query {
        user(id: ID!): User
        users(limit: Int = 10, offset: Int): [User!]!
      }
      type User { id: ID! }
    `);

    const index = createSchemaIndex(document);

    const queryRecord = index.objects.get("Query");
    const userField = queryRecord?.fields.get("user");
    expect(userField?.arguments?.length).toBe(1);
    expect(userField?.arguments?.[0]?.name.value).toBe("id");

    const usersField = queryRecord?.fields.get("users");
    expect(usersField?.arguments?.length).toBe(2);
  });

  test("indexes directives on types", () => {
    const document = parse(`
      type User @deprecated(reason: "Use Person instead") {
        id: ID!
      }
    `);

    const index = createSchemaIndex(document);

    const userRecord = index.objects.get("User");
    expect(userRecord?.directives?.length).toBe(1);
    expect(userRecord?.directives?.[0]?.name.value).toBe("deprecated");
  });
});

describe("generateMultiSchemaModule", () => {
  test("generates code for a simple schema", () => {
    const document = parse(`
      type Query {
        hello: String!
      }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain("@soda-gql/core");
    expect(result.code).toContain("createGqlElementComposer");
    expect(result.code).toContain('label: "default"');
    expect(result.code).toContain('query: "Query"');
    expect(result.stats.objects).toBe(1);
  });

  test("generates code for multiple schemas", () => {
    const schema1 = parse(`
      type Query { users: [User!]! }
      type User { id: ID!, name: String! }
    `);

    const schema2 = parse(`
      type Query { products: [Product!]! }
      type Product { id: ID!, title: String! }
    `);

    const schemas = new Map([
      ["users", schema1],
      ["products", schema2],
    ]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain('label: "users"');
    expect(result.code).toContain('label: "products"');
    expect(result.stats.objects).toBe(4); // Query + User + Query + Product
  });

  test("generates enum definitions", () => {
    const document = parse(`
      type Query { status: Status! }
      enum Status { ACTIVE, INACTIVE }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain('Status: { name: "Status"');
    expect(result.code).toContain("values:");
    expect(result.code).toContain("ACTIVE: true");
    expect(result.code).toContain("INACTIVE: true");
    expect(result.stats.enums).toBe(1);
  });

  test("generates input definitions", () => {
    const document = parse(`
      type Query { user(id: ID!): User }
      type Mutation { createUser(input: CreateUserInput!): User }
      type User { id: ID! }
      input CreateUserInput {
        name: String!
        email: String
      }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain('CreateUserInput: { name: "CreateUserInput"');
    expect(result.code).toContain("fields:");
    expect(result.stats.inputs).toBe(1);
  });

  test("generates union definitions", () => {
    const document = parse(`
      type Query { search: [SearchResult!]! }
      type User { id: ID!, name: String! }
      type Post { id: ID!, title: String! }
      union SearchResult = User | Post
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain('SearchResult: { name: "SearchResult"');
    expect(result.code).toContain("types:");
    expect(result.code).toContain("User: true");
    expect(result.code).toContain("Post: true");
    expect(result.stats.unions).toBe(1);
  });

  test("generates scalar definitions for custom scalars", () => {
    const document = parse(`
      scalar DateTime
      type Query { now: DateTime! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain('DateTime: { name: "DateTime"');
    expect(result.code).toContain("$type:");
  });

  test("handles builtin scalar types", () => {
    const document = parse(`
      type Query {
        id: ID!
        name: String!
        count: Int!
        rate: Float!
        active: Boolean!
      }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Builtin scalars should be defined
    expect(result.code).toContain('ID: { name: "ID"');
    expect(result.code).toContain('String: { name: "String"');
    expect(result.code).toContain('Int: { name: "Int"');
    expect(result.code).toContain('Float: { name: "Float"');
    expect(result.code).toContain('Boolean: { name: "Boolean"');
  });

  test("excludes introspection types", () => {
    const document = parse(`
      type Query { version: String! }
      type __Schema { types: [__Type!]! }
      type __Type { name: String }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Introspection types starting with __ should be excluded
    expect(result.code).not.toContain("__Schema");
    expect(result.code).not.toContain("__Type");
    expect(result.stats.objects).toBe(1); // Only Query
  });

  test("generates type exports", () => {
    const document = parse(`
      type Query { hello: String! }
    `);

    const schemas = new Map([["api", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).toContain("export type Schema_api");
  });

  test("handles injection options", () => {
    const document = parse(`
      type Query { hello: String! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      injection: new Map([
        [
          "default",
          {
            scalarImportPath: "./scalars",
            adapterImportPath: "./adapter",
          },
        ],
      ]),
    });

    expect(result.code).toContain('from "./scalars"');
    expect(result.code).toContain('from "./adapter"');
    expect(result.code).toContain("scalar_default");
    expect(result.code).toContain("adapter_default");
  });

  test("handles complex field types with modifiers", () => {
    const document = parse(`
      type Query {
        required: String!
        optional: String
        list: [String!]!
        optionalList: [String!]
        listOfOptional: [String]!
        nested: [[String!]!]!
      }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Code should contain type modifiers in the new format
    expect(result.code).toContain('modifier: "!"');
    expect(result.code).toContain('modifier: "?"');
    expect(result.code).toContain('modifier: "![]!"');
    expect(result.code).toContain('modifier: "![]?"');
  });

  test("generates sorted field definitions", () => {
    const document = parse(`
      type User {
        zField: String!
        aField: String!
        mField: String!
      }
      type Query { user: User }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Fields should be sorted alphabetically
    const aFieldIndex = result.code.indexOf("aField:");
    const mFieldIndex = result.code.indexOf("mField:");
    const zFieldIndex = result.code.indexOf("zField:");

    expect(aFieldIndex).toBeLessThan(mFieldIndex);
    expect(mFieldIndex).toBeLessThan(zFieldIndex);
  });

  test("generates fragment builder types", () => {
    const document = parse(`
      type Query { users: [User!]! }
      type User { id: ID!, name: String! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Should import FragmentBuilderFor
    expect(result.code).toContain("type FragmentBuilderFor");

    // Should generate FragmentBuilders type
    expect(result.code).toContain("type FragmentBuilders_default");
    expect(result.code).toContain('FragmentBuilderFor<Schema_default, "Query">');
    expect(result.code).toContain('FragmentBuilderFor<Schema_default, "User">');

    // Should use FragmentBuilders type in createGqlElementComposer
    expect(result.code).toContain("createGqlElementComposer<Schema_default, FragmentBuilders_default>");
  });

  test("generates fragment builder types for multiple schemas", () => {
    const schema1 = parse(`
      type Query { users: [User!]! }
      type User { id: ID! }
    `);

    const schema2 = parse(`
      type Query { posts: [Post!]! }
      type Post { id: ID! }
    `);

    const schemas = new Map([
      ["api", schema1],
      ["blog", schema2],
    ]);
    const result = generateMultiSchemaModule(schemas);

    // Should generate separate FragmentBuilders for each schema
    expect(result.code).toContain("type FragmentBuilders_api");
    expect(result.code).toContain("type FragmentBuilders_blog");
    expect(result.code).toContain('FragmentBuilderFor<Schema_api, "User">');
    expect(result.code).toContain('FragmentBuilderFor<Schema_blog, "Post">');
  });

  test("generates __inputDepthOverrides when provided", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
      input UserBoolExp {
        _and: [UserBoolExp!]
        _or: [UserBoolExp!]
        id: IDComparisonExp
      }
      input IDComparisonExp {
        _eq: ID
      }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      inputDepthOverrides: new Map([["default", { UserBoolExp: 5, OtherInput: 10 }]]),
    });

    expect(result.code).toContain("__inputDepthOverrides:");
    expect(result.code).toContain('"UserBoolExp":5');
    expect(result.code).toContain('"OtherInput":10');
  });

  test("does not generate __inputDepthOverrides when empty", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      inputDepthOverrides: new Map([["default", {}]]),
    });

    expect(result.code).not.toContain("__inputDepthOverrides");
  });

  test("does not generate __inputDepthOverrides when not provided", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).not.toContain("__inputDepthOverrides");
  });
});
