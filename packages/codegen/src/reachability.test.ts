import { describe, expect, test } from "bun:test";
import { parse } from "graphql";
import { computeReachabilityFilter } from "./reachability";

describe("computeReachabilityFilter", () => {
  test("linear path: Query → User → Post, fragment on Post includes all on path", () => {
    const schema = parse(`
      type Query {
        user: User
      }
      type User {
        name: String
        posts: [Post]
      }
      type Post {
        title: String
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["Post"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "Post", category: "object" })).toBe(true);
    // Builtin scalars referenced by reachable types should be included
    expect(filter({ name: "String", category: "scalar" })).toBe(true);
  });

  test("pruning: Query → User, Query → Admin; fragment on User excludes Admin", () => {
    const schema = parse(`
      type Query {
        user: User
        admin: Admin
      }
      type User {
        name: String
      }
      type Admin {
        level: Int
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "Admin", category: "object" })).toBe(false);
    expect(filter({ name: "Int", category: "scalar" })).toBe(false);
    expect(filter({ name: "String", category: "scalar" })).toBe(true);
  });

  test("union: Query → SearchResult (User | Post), fragment on User includes union", () => {
    const schema = parse(`
      type Query {
        search: SearchResult
      }
      union SearchResult = User | Post
      type User {
        name: String
      }
      type Post {
        title: String
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "SearchResult", category: "union" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    // Post is also a member of SearchResult on the path, so it should be included
    // because the union is on the path and all its members are forward-reachable
    // Actually: the forward pass only follows types in the backward set.
    // Post is NOT in the backward set from User, so Post is excluded.
    expect(filter({ name: "Post", category: "object" })).toBe(false);
  });

  test("input types: field arguments include transitive inputs", () => {
    const schema = parse(`
      type Query {
        users(filter: UserFilter): [User]
      }
      type User {
        name: String
      }
      input UserFilter {
        dateRange: DateRange
        status: Status
      }
      input DateRange {
        from: String
        to: String
      }
      enum Status {
        ACTIVE
        INACTIVE
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "UserFilter", category: "input" })).toBe(true);
    expect(filter({ name: "DateRange", category: "input" })).toBe(true);
    expect(filter({ name: "Status", category: "enum" })).toBe(true);
  });

  test("circular input refs: no infinite loop", () => {
    const schema = parse(`
      type Query {
        items(filter: FilterA): [Item]
      }
      type Item {
        value: String
      }
      input FilterA {
        nested: FilterB
      }
      input FilterB {
        back: FilterA
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["Item"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "Item", category: "object" })).toBe(true);
    expect(filter({ name: "FilterA", category: "input" })).toBe(true);
    expect(filter({ name: "FilterB", category: "input" })).toBe(true);
  });

  test("multiple targets: union of paths", () => {
    const schema = parse(`
      type Query {
        user: User
        post: Post
        admin: Admin
      }
      type User {
        name: String
      }
      type Post {
        title: String
      }
      type Admin {
        level: Int
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User", "Post"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "Post", category: "object" })).toBe(true);
    expect(filter({ name: "Admin", category: "object" })).toBe(false);
  });

  test("empty targets: pass-all filter includes everything", () => {
    const schema = parse(`
      type Query {
        user: User
      }
      type User {
        name: String
      }
    `);

    const { filter, warnings } = computeReachabilityFilter(schema, new Set());

    expect(warnings).toEqual([]);
    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "String", category: "scalar" })).toBe(true);
  });

  test("non-existent targetType: warns and filters correctly", () => {
    const schema = parse(`
      type Query {
        user: User
      }
      type User {
        name: String
      }
    `);

    const { filter, warnings } = computeReachabilityFilter(schema, new Set(["NonExistent", "User"]));

    expect(warnings).toEqual(['Target type "NonExistent" not found in schema']);
    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
  });

  test("all targets non-existent: pass-all filter with warnings", () => {
    const schema = parse(`
      type Query {
        user: User
      }
      type User {
        name: String
      }
    `);

    const { filter, warnings } = computeReachabilityFilter(schema, new Set(["Foo", "Bar"]));

    expect(warnings).toHaveLength(2);
    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
  });

  test("enum and custom scalar collection: included when referenced by reachable types", () => {
    const schema = parse(`
      type Query {
        user: User
        other: Other
      }
      type User {
        role: Role
        createdAt: DateTime
      }
      type Other {
        status: OtherStatus
      }
      enum Role {
        ADMIN
        USER
      }
      enum OtherStatus {
        ACTIVE
      }
      scalar DateTime
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "Role", category: "enum" })).toBe(true);
    expect(filter({ name: "DateTime", category: "scalar" })).toBe(true);
    expect(filter({ name: "OtherStatus", category: "enum" })).toBe(false);
    expect(filter({ name: "Other", category: "object" })).toBe(false);
  });

  test("mutation root type: paths through Mutation are found", () => {
    const schema = parse(`
      type Query {
        viewer: Viewer
      }
      type Mutation {
        createUser(input: CreateUserInput): User
      }
      type Viewer {
        id: ID
      }
      type User {
        name: String
      }
      input CreateUserInput {
        name: String
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "Mutation", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "CreateUserInput", category: "input" })).toBe(true);
    // Viewer is only reachable from Query, not on path to User
    expect(filter({ name: "Viewer", category: "object" })).toBe(false);
    // Query has no path to User, so Query itself should not be included
    expect(filter({ name: "Query", category: "object" })).toBe(false);
  });

  test("union member scalars/enums: collected from members on the path", () => {
    const schema = parse(`
      type Query {
        search: SearchResult
      }
      union SearchResult = User | Post
      type User {
        name: String
        role: Role
        createdAt: DateTime
      }
      type Post {
        title: String
      }
      enum Role {
        ADMIN
        USER
      }
      scalar DateTime
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "SearchResult", category: "union" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "Role", category: "enum" })).toBe(true);
    expect(filter({ name: "DateTime", category: "scalar" })).toBe(true);
    expect(filter({ name: "String", category: "scalar" })).toBe(true);
  });

  test("deep chain: only types on the path are included", () => {
    const schema = parse(`
      type Query {
        a: A
      }
      type A {
        b: B
        x: X
      }
      type B {
        c: C
      }
      type C {
        value: String
      }
      type X {
        unrelated: String
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["C"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "A", category: "object" })).toBe(true);
    expect(filter({ name: "B", category: "object" })).toBe(true);
    expect(filter({ name: "C", category: "object" })).toBe(true);
    // X is reachable from Query→A but not on path to C
    expect(filter({ name: "X", category: "object" })).toBe(false);
  });

  test("shared input type: does not contaminate unrelated branches", () => {
    const schema = parse(`
      type Query {
        users(filter: SharedInput): User
        admins(filter: SharedInput): Admin
      }
      type User {
        name: String
      }
      type Admin {
        level: Int
      }
      input SharedInput {
        value: String
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "SharedInput", category: "input" })).toBe(true);
    // Admin is NOT on the path from Query to User
    expect(filter({ name: "Admin", category: "object" })).toBe(false);
    expect(filter({ name: "Int", category: "scalar" })).toBe(false);
  });

  test("usedArgumentTypes: includes enum variable types directly used as arguments", () => {
    const schema = parse(`
      type Query {
        users(status: Status): User
      }
      type User {
        name: String
      }
      enum Status {
        ACTIVE
        INACTIVE
      }
    `);

    // Status is an enum used directly as a variable type
    const { filter } = computeReachabilityFilter(schema, new Set(["User"]), new Set(["Status"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "Status", category: "enum" })).toBe(true);
  });

  test("usedArgumentTypes: includes scalar variable types directly used as arguments", () => {
    const schema = parse(`
      type Query {
        events(after: DateTime): Event
      }
      type Event {
        title: String
      }
      scalar DateTime
    `);

    // DateTime is a custom scalar used directly as a variable type
    const { filter } = computeReachabilityFilter(schema, new Set(["Event"]), new Set(["DateTime"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "Event", category: "object" })).toBe(true);
    expect(filter({ name: "DateTime", category: "scalar" })).toBe(true);
  });

  test("usedArgumentTypes: excludes unused argument input types", () => {
    const schema = parse(`
      type Query {
        users(filter: UserFilter): User
      }
      type User {
        name: String
        posts(sort: SortInput): [Post]
      }
      type Post {
        title: String
      }
      input UserFilter {
        status: Status
      }
      input SortInput {
        field: String
        order: SortOrder
      }
      enum Status {
        ACTIVE
        INACTIVE
      }
      enum SortOrder {
        ASC
        DESC
      }
    `);

    // Fragment only uses UserFilter, not SortInput
    const { filter } = computeReachabilityFilter(schema, new Set(["User"]), new Set(["UserFilter"]));

    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "User", category: "object" })).toBe(true);
    expect(filter({ name: "UserFilter", category: "input" })).toBe(true);
    expect(filter({ name: "Status", category: "enum" })).toBe(true);
    // SortInput and SortOrder are NOT used by any fragment
    expect(filter({ name: "SortInput", category: "input" })).toBe(false);
    expect(filter({ name: "SortOrder", category: "enum" })).toBe(false);
    // Return type scalars are still collected
    expect(filter({ name: "String", category: "scalar" })).toBe(true);
  });

  test("usedArgumentTypes: transitive input dependencies are included", () => {
    const schema = parse(`
      type Query {
        items(filter: FilterA): [Item]
      }
      type Item {
        value: String
      }
      input FilterA {
        nested: FilterB
      }
      input FilterB {
        value: String
      }
    `);

    const { filter } = computeReachabilityFilter(schema, new Set(["Item"]), new Set(["FilterA"]));

    expect(filter({ name: "FilterA", category: "input" })).toBe(true);
    expect(filter({ name: "FilterB", category: "input" })).toBe(true);
  });

  test("warns and returns pass-all when reachable set is empty", () => {
    const schema = parse(`
      type Query {
        hello: String
      }
      type Orphan {
        value: String
      }
    `);

    // Orphan exists in schema but is unreachable from Query
    const { filter, warnings } = computeReachabilityFilter(schema, new Set(["Orphan"]));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("No types reachable from root operations to target types");
    expect(warnings[0]).toContain("Orphan");
    // Pass-all filter
    expect(filter({ name: "Query", category: "object" })).toBe(true);
    expect(filter({ name: "Orphan", category: "object" })).toBe(true);
    expect(filter({ name: "String", category: "scalar" })).toBe(true);
  });

  test("usedArgumentTypes: undefined falls back to collecting all arguments", () => {
    const schema = parse(`
      type Query {
        users(filter: UserFilter): User
      }
      type User {
        name: String
      }
      input UserFilter {
        status: String
      }
    `);

    // No usedArgumentTypes → current behavior (all arguments collected)
    const { filter } = computeReachabilityFilter(schema, new Set(["User"]));

    expect(filter({ name: "UserFilter", category: "input" })).toBe(true);
  });
});
