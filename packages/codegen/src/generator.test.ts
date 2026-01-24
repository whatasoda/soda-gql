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

  test("indexes custom directive definitions", () => {
    const document = parse(`
      directive @auth(role: String!) on FIELD_DEFINITION | OBJECT
      directive @cached(ttl: Int!) repeatable on FIELD
      type Query { hello: String! }
    `);

    const index = createSchemaIndex(document);

    // Should extract custom directives
    expect(index.directives.size).toBe(2);

    const authDirective = index.directives.get("auth");
    expect(authDirective).toBeDefined();
    expect(authDirective?.name).toBe("auth");
    expect(authDirective?.locations).toEqual(["FIELD_DEFINITION", "OBJECT"]);
    expect(authDirective?.args.size).toBe(1);
    expect(authDirective?.args.get("role")).toBeDefined();
    expect(authDirective?.isRepeatable).toBe(false);

    const cachedDirective = index.directives.get("cached");
    expect(cachedDirective).toBeDefined();
    expect(cachedDirective?.name).toBe("cached");
    expect(cachedDirective?.locations).toEqual(["FIELD"]);
    expect(cachedDirective?.isRepeatable).toBe(true);
  });

  test("skips built-in directives", () => {
    const document = parse(`
      directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
      directive @custom on FIELD
      type Query { hello: String! }
    `);

    const index = createSchemaIndex(document);

    // Should skip built-in directives (skip, include, deprecated, specifiedBy)
    expect(index.directives.has("skip")).toBe(false);
    expect(index.directives.has("custom")).toBe(true);
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

    // In split mode, enum definitions are in categoryVars
    const enumDef = result.categoryVars?.default?.enums.find((e) => e.name.includes("Status"));
    expect(enumDef).toBeDefined();

    // Factory function format: defineEnum<"Status", ...>
    const enumCode = enumDef?.code ?? "";
    expect(enumCode).toContain('enum_default_Status = defineEnum<"Status"');
    expect(enumCode).toContain("ACTIVE: true");
    expect(enumCode).toContain("INACTIVE: true");
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

    // In split mode, input definitions are in categoryVars
    const inputDef = result.categoryVars?.default?.inputs.find((i) => i.name.includes("CreateUserInput"));
    expect(inputDef).toBeDefined();

    // Input definition should have correct format
    const inputCode = inputDef?.code ?? "";
    expect(inputCode).toContain('name: "CreateUserInput", fields:');
    expect(inputCode).toContain("} as const");
    // Deferred specifier format
    expect(inputCode).toContain('"s|String|!"');
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

    // In split mode, union definitions are in categoryVars
    const unionDef = result.categoryVars?.default?.unions.find((u) => u.name.includes("SearchResult"));
    expect(unionDef).toBeDefined();

    // Union definition should have correct format
    const unionCode = unionDef?.code ?? "";
    expect(unionCode).toContain('name: "SearchResult", types:');
    expect(unionCode).toContain("} as const");
    expect(unionCode).toContain("User: true");
    expect(unionCode).toContain("Post: true");
    expect(result.stats.unions).toBe(1);
  });

  test("generates scalar definitions for custom scalars", () => {
    const document = parse(`
      scalar DateTime
      type Query { now: DateTime! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Granular format: const scalar_default_DateTime = { name: "DateTime", ...
    expect(result.code).toContain('const scalar_default_DateTime = { name: "DateTime"');
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

    // Builtin scalars should be defined (granular format)
    expect(result.code).toContain('const scalar_default_ID = { name: "ID"');
    expect(result.code).toContain('const scalar_default_String = { name: "String"');
    expect(result.code).toContain('const scalar_default_Int = { name: "Int"');
    expect(result.code).toContain('const scalar_default_Float = { name: "Float"');
    expect(result.code).toContain('const scalar_default_Boolean = { name: "Boolean"');
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

    // _internal.ts imports from _internal-injects.ts
    expect(result.code).toContain('from "./_internal-injects"');
    expect(result.code).toContain("scalar_default");
    expect(result.code).toContain("adapter_default");

    // _internal-injects.ts contains the actual import paths
    expect(result.injectsCode).toContain('from "./scalars"');
    expect(result.injectsCode).toContain('from "./adapter"');
    expect(result.injectsCode).toContain("export { scalar_default }");
    expect(result.injectsCode).toContain("export { adapter_default }");
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

    // In split mode, object definitions are in categoryVars
    const queryObjectDef = result.categoryVars?.default?.objects.find((o) => o.name.includes("Query"));
    expect(queryObjectDef).toBeDefined();

    // Object code should contain type modifiers in deferred specifier format
    const objectCode = queryObjectDef?.code ?? "";
    // Deferred specifiers contain modifiers at the end after the second |
    expect(objectCode).toContain('|!"');       // Required scalar
    expect(objectCode).toContain('|?"');       // Optional scalar
    expect(objectCode).toContain('|![]!"');    // Required list of required
    expect(objectCode).toContain('|![]?"');    // Optional list of required
    expect(objectCode).toContain('|?[]!"');    // Required list of optional
    expect(objectCode).toContain('|![]![]!"'); // Nested list
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

    // In split mode, object definitions are in categoryVars
    const userObjectDef = result.categoryVars?.default?.objects.find((o) => o.name.includes("User"));
    expect(userObjectDef).toBeDefined();

    // Fields should be sorted alphabetically in the object definition
    const objectCode = userObjectDef?.code ?? "";
    const aFieldIndex = objectCode.indexOf("aField:");
    const mFieldIndex = objectCode.indexOf("mField:");
    const zFieldIndex = objectCode.indexOf("zField:");

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
    expect(result.code).toContain(
      "createGqlElementComposer<Schema_default, FragmentBuilders_default, typeof customDirectives_default>",
    );
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

  test("generates __defaultInputDepth when non-default value provided", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      defaultInputDepth: new Map([["default", 5]]),
    });

    expect(result.code).toContain("__defaultInputDepth: 5");
  });

  test("does not generate __defaultInputDepth when value is 3 (default)", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      defaultInputDepth: new Map([["default", 3]]),
    });

    expect(result.code).not.toContain("__defaultInputDepth");
  });

  test("does not generate __defaultInputDepth when not provided", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    expect(result.code).not.toContain("__defaultInputDepth");
  });

  test("generates both __defaultInputDepth and __inputDepthOverrides when both provided", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      defaultInputDepth: new Map([["default", 5]]),
      inputDepthOverrides: new Map([["default", { special_type: 10 }]]),
    });

    expect(result.code).toContain("__defaultInputDepth: 5");
    expect(result.code).toContain("__inputDepthOverrides:");
    expect(result.code).toContain('"special_type":10');
  });

  test("generates typed directive methods with argument specifiers", () => {
    const document = parse(`
      directive @auth(role: String!) on FIELD
      directive @cached(ttl: Int!, scope: CacheScope = PUBLIC) on FIELD | OBJECT
      enum CacheScope { PUBLIC PRIVATE }
      type Query { hello: String! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Should generate custom directive methods
    expect(result.code).toContain("customDirectives_default");
    expect(result.code).toContain("createStandardDirectives()");

    // Should use createTypedDirectiveMethod for directives with arguments
    expect(result.code).toContain('auth: createTypedDirectiveMethod("auth", ["FIELD"] as const,');
    expect(result.code).toContain('role: "s|String|!"');

    // Should include enum type in argument specifiers (deferred string format)
    expect(result.code).toContain('cached: createTypedDirectiveMethod("cached", ["FIELD","OBJECT"] as const,');
    expect(result.code).toContain('scope: "e|CacheScope|?"');
    expect(result.code).toContain('ttl: "s|Int|!"');

    // Should pass directiveMethods to createGqlElementComposer
    expect(result.code).toContain("directiveMethods: customDirectives_default");
  });

  test("generates simple directive methods for directives without arguments", () => {
    const document = parse(`
      directive @internal on FIELD | OBJECT
      type Query { hello: String! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Should use simple createDirectiveMethod for directives without arguments
    expect(result.code).toContain('internal: createDirectiveMethod("internal", ["FIELD","OBJECT"] as const)');
    // Should NOT use createTypedDirectiveMethod
    expect(result.code).not.toContain('createTypedDirectiveMethod("internal"');
  });

  test("generates empty custom directives when no custom directives in schema", () => {
    const document = parse(`
      type Query { hello: String! }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas);

    // Should still generate customDirectives with standard directives
    expect(result.code).toContain("customDirectives_default = { ...createStandardDirectives(), ...{} }");
  });

  test("excludes types matching filter", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
      input users_stddev_order_by { id: order_by }
      input users_order_by {
        id: order_by
        stddev: users_stddev_order_by
      }
      enum order_by { asc desc }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      typeFilters: new Map([["default", { exclude: [{ pattern: "*_stddev_*", category: "input" }] }]]),
    });

    // Excluded type should not be generated
    const stddevInput = result.categoryVars?.default?.inputs.find((i) => i.name.includes("stddev"));
    expect(stddevInput).toBeUndefined();

    // Non-excluded type should be generated
    const orderByInput = result.categoryVars?.default?.inputs.find(
      (i) => i.name.includes("users_order_by") && !i.name.includes("stddev"),
    );
    expect(orderByInput).toBeDefined();

    // Reference to excluded type should have kind: "excluded"
    const orderByCode = orderByInput?.code ?? "";
    expect(orderByCode).toContain('kind: "excluded"');
    expect(orderByCode).toContain('name: "users_stddev_order_by"');
  });

  test("excludes types using function-based filter", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
      input internal_config { value: String }
      input public_config { value: String }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      typeFilters: new Map([["default", ({ name }) => !name.startsWith("internal_")]]),
    });

    // internal_config should be excluded
    const internalInput = result.categoryVars?.default?.inputs.find((i) => i.name.includes("internal_config"));
    expect(internalInput).toBeUndefined();

    // public_config should be included
    const publicInput = result.categoryVars?.default?.inputs.find((i) => i.name.includes("public_config"));
    expect(publicInput).toBeDefined();
  });

  test("handles multiple exclude patterns", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
      input users_stddev_order_by { id: order_by }
      input users_variance_order_by { id: order_by }
      input users_order_by { id: order_by }
      enum order_by { asc desc }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      typeFilters: new Map([
        [
          "default",
          {
            exclude: [{ pattern: "*_stddev_*" }, { pattern: "*_variance_*" }],
          },
        ],
      ]),
    });

    // Both stddev and variance should be excluded
    const stddevInput = result.categoryVars?.default?.inputs.find((i) => i.name.includes("stddev"));
    const varianceInput = result.categoryVars?.default?.inputs.find((i) => i.name.includes("variance"));
    expect(stddevInput).toBeUndefined();
    expect(varianceInput).toBeUndefined();

    // users_order_by should be included
    const orderByInput = result.categoryVars?.default?.inputs.find(
      (i) => i.name.includes("users_order_by") && !i.name.includes("stddev") && !i.name.includes("variance"),
    );
    expect(orderByInput).toBeDefined();
  });

  test("excludes union members when object type is excluded", () => {
    const document = parse(`
      type Query { search: SearchResult }
      type User { id: ID! }
      type Post { id: ID! }
      type InternalType { id: ID! }
      union SearchResult = User | Post | InternalType
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      typeFilters: new Map([["default", { exclude: [{ pattern: "InternalType", category: "object" }] }]]),
    });

    // Union should not include excluded member
    const unionDef = result.categoryVars?.default?.unions.find((u) => u.name.includes("SearchResult"));
    expect(unionDef).toBeDefined();
    const unionCode = unionDef?.code ?? "";
    expect(unionCode).toContain("User: true");
    expect(unionCode).toContain("Post: true");
    expect(unionCode).not.toContain("InternalType");
  });

  test("excludes variable methods for excluded input types", () => {
    const document = parse(`
      type Query { user: User }
      type User { id: ID! }
      input users_stddev_order_by { id: order_by }
      input users_order_by { id: order_by }
      enum order_by { asc desc }
    `);

    const schemas = new Map([["default", document]]);
    const result = generateMultiSchemaModule(schemas, {
      typeFilters: new Map([["default", { exclude: [{ pattern: "*_stddev_*", category: "input" }] }]]),
    });

    // Variable methods should not include excluded type
    expect(result.code).toContain("users_order_by:");
    expect(result.code).not.toContain("users_stddev_order_by:");
  });
});
