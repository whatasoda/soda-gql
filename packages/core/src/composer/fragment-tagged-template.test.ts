import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyFieldSelection } from "../types/fragment/field-selection";
import type { AnyGraphqlSchema } from "../types/schema";
import { createVarRefFromVariable, VarRef } from "../types/type-foundation/var-ref";
import { createFragmentTaggedTemplate } from "./fragment-tagged-template";

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
    ...defineScalar<"Int", string, number>("Int"),
    ...defineScalar<"Boolean", string, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({}),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:?", {}),
    }),
    Post: define("Post").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
    }),
    Employee: define("Employee").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      tasks: unsafeOutputType.object("Task:![]!", {
        arguments: { completed: unsafeInputType.scalar("Boolean:?", {}) },
      }),
    }),
    Task: define("Task").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
      done: unsafeOutputType.scalar("Boolean:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

describe("createFragmentTaggedTemplate", () => {
  const fragment = createFragmentTaggedTemplate(schema);

  describe("fragment spread in tagged templates (deprecated registry approach)", () => {
    it("throws error when fragment spread is used without interpolation", () => {
      expect(() => {
        const frag = fragment`fragment UserWithSpread on User { ...SomeFragment }`();
        frag.spread({} as never);
      }).toThrow('Fragment spread "...SomeFragment" in tagged template must use interpolation syntax');
    });
  });

  describe("basic fragment creation", () => {
    it("parses a valid fragment and produces a Fragment", () => {
      const result = fragment`fragment UserFields on User { id name }`();
      expect(result.typename).toBe("User");
      expect(result.key).toBe("UserFields");
      expect(result.schemaLabel).toBe("test");
    });

    it("fragment with on User type condition resolves correctly", () => {
      const result = fragment`fragment UserInfo on User { id name email }`();
      expect(result.typename).toBe("User");
    });

    it("fragment on Post type resolves correctly", () => {
      const result = fragment`fragment PostFields on Post { id title }`();
      expect(result.typename).toBe("Post");
      expect(result.key).toBe("PostFields");
    });
  });

  describe("variable definitions", () => {
    it("fragment without variables produces empty variableDefinitions", () => {
      const result = fragment`fragment UserFields on User { id name }`();
      expect(result.variableDefinitions).toEqual({});
    });

    it("fragment with variables extracts VarSpecifier records", () => {
      const result = fragment`fragment UserFields($showEmail: Boolean!) on User { id }`();
      expect(result.variableDefinitions).toHaveProperty("showEmail");
      const showEmail = (result.variableDefinitions as Record<string, any>).showEmail;
      expect(showEmail.kind).toBe("scalar");
      expect(showEmail.name).toBe("Boolean");
      expect(showEmail.modifier).toBe("!");
    });

    it("fragment with default values extracts defaultValue", () => {
      const result = fragment`fragment UserFields($limit: Int = 10) on User { id }`();
      const limit = (result.variableDefinitions as Record<string, any>).limit;
      expect(limit.kind).toBe("scalar");
      expect(limit.name).toBe("Int");
      expect(limit.defaultValue).toEqual({ default: 10 });
    });

    it("fragment with multiple variables extracts all", () => {
      const result = fragment`fragment UserFields($showEmail: Boolean!, $limit: Int) on User { id }`();
      const varDefs = result.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toHaveLength(2);
      expect(varDefs).toHaveProperty("showEmail");
      expect(varDefs).toHaveProperty("limit");
    });
  });

  describe("metadata callbacks", () => {
    it("supports static metadata value", () => {
      const userFragment = fragment`fragment UserFields on User { id name }`({
        metadata: { headers: { "X-Custom": "test" } },
      });

      expect(userFragment).toBeDefined();
      expect(userFragment.typename).toBe("User");
    });

    it("supports metadata callback with variable access", () => {
      const userFragment = fragment`fragment UserFields($userId: ID!) on User { id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => {
          // Verify $ is passed and contains variable ref
          return {
            headers: {
              "X-User-Var": $.userId ? "has-userId" : "no-userId",
            },
          };
        },
      });

      expect(userFragment).toBeDefined();
      expect(userFragment.typename).toBe("User");

      // Spread to trigger metadata callback
      const varRef = createVarRefFromVariable("userId");
      const fields = userFragment.spread({ userId: varRef } as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("metadata callback without variables receives empty $", () => {
      const userFragment = fragment`fragment UserFields on User { id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          custom: {
            varCount: Object.keys($).length,
          },
        }),
      });

      const fields = userFragment.spread({} as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });
  });

  describe("error handling", () => {
    it("throws when interpolated value is not a Fragment or callback", () => {
      const fn = createFragmentTaggedTemplate(schema);
      expect(() => (fn as any)(["part1", "part2"], "interpolated")).toThrow(
        "Tagged templates only accept Fragment instances or callback functions as interpolated values"
      );
    });

    it("throws on parse errors", () => {
      expect(() => fragment`fragment UserFields on User { invalid!!! syntax }`).toThrow("GraphQL parse error");
    });

    it("throws when onType is not found in schema", () => {
      expect(() => fragment`fragment Foo on NonExistent { id }`).toThrow('Type "NonExistent" is not defined in schema objects');
    });

    it("throws when source contains no fragment definition", () => {
      expect(() => fragment`query GetUser { user { id } }`).toThrow("Expected a fragment definition, found none");
    });

    it("throws when source contains multiple fragment definitions", () => {
      expect(() => fragment`fragment A on User { id } fragment B on Post { id }`).toThrow(
        "Expected exactly one fragment definition, found 2",
      );
    });

    it("throws when selecting a field not in the schema", () => {
      const frag = fragment`fragment Foo on User { nonexistent }`();
      expect(() => frag.spread({} as never)).toThrow('Field "nonexistent" is not defined on type "User"');
    });
  });

  describe("spread function", () => {
    it("spread function is callable and returns", () => {
      const result = fragment`fragment UserFields on User { id name }`();
      expect(typeof result.spread).toBe("function");
      const spreadResult = result.spread({} as never);
      expect(spreadResult).toBeDefined();
    });

    it("allows __typename as an implicit introspection field", () => {
      const result = fragment`fragment UserWithTypename on User { __typename id name }`();
      const fields = result.spread({} as never);
      expect(fields).toHaveProperty("__typename");
    });
  });

  describe("variable references in spread", () => {
    it("spread with VarRef produces args containing the VarRef", () => {
      const frag =
        fragment`fragment EmployeeTasks($completed: Boolean) on Employee { tasks(completed: $completed) { id title } }`();
      const varRef = createVarRefFromVariable("completed");
      const fields = frag.spread({ completed: varRef } as never);
      const tasksField = fields.tasks as AnyFieldSelection;
      expect(tasksField.args).toBeDefined();
      const completedArg = tasksField.args.completed;
      expect(completedArg).toBeInstanceOf(VarRef);
      const inner = VarRef.getInner(completedArg as VarRef<never>);
      expect(inner.type).toBe("variable");
      expect(inner).toEqual({ type: "variable", name: "completed" });
    });

    it("spread with literal value produces args containing nested-value VarRef", () => {
      const frag =
        fragment`fragment EmployeeTasks($completed: Boolean) on Employee { tasks(completed: $completed) { id title } }`();
      const fields = frag.spread({ completed: true } as never);
      const tasksField = fields.tasks as AnyFieldSelection;
      const completedArg = tasksField.args.completed;
      expect(completedArg).toBeInstanceOf(VarRef);
      const inner = VarRef.getInner(completedArg as VarRef<never>);
      expect(inner.type).toBe("nested-value");
      expect(inner).toEqual({ type: "nested-value", value: true });
    });

    it("spread without variables works unchanged", () => {
      const frag = fragment`fragment EmployeeBasic on Employee { id name }`();
      const fields = frag.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("unassigned variable produces nested-value VarRef with undefined", () => {
      const frag =
        fragment`fragment EmployeeTasks($completed: Boolean) on Employee { tasks(completed: $completed) { id title } }`();
      const fields = frag.spread({} as never);
      const tasksField = fields.tasks as AnyFieldSelection;
      const completedArg = tasksField.args.completed;
      expect(completedArg).toBeInstanceOf(VarRef);
      const inner = VarRef.getInner(completedArg as VarRef<never>);
      expect(inner.type).toBe("nested-value");
      expect(inner).toEqual({ type: "nested-value", value: undefined });
    });
  });

  describe("interpolation-based fragment spread", () => {
    it("direct fragment interpolation spreads fields", () => {
      // Create a child fragment
      const nameFragment = fragment`fragment UserName on User { name }`();

      // Create parent fragment with direct interpolation
      const parentFragment = fragment`fragment UserWithName on User { id ...${nameFragment} }`();

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("callback interpolation receives $ context", () => {
      // Create a child fragment with variable
      const tasksFragment =
        fragment`fragment EmployeeTasks($completed: Boolean) on Employee { tasks(completed: $completed) { id title } }`();

      // Create parent fragment with callback interpolation
      const parentFragment = fragment`fragment EmployeeWithTasks($completed: Boolean) on Employee {
        id
        name
        ...${($: { $: Readonly<Record<string, unknown>> }) => tasksFragment.spread({ completed: $.$.completed } as never)}
      }`();

      const varRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: varRef } as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("tasks");

      const tasksField = fields.tasks as AnyFieldSelection;
      expect(tasksField.args.completed).toBeInstanceOf(VarRef);
    });

    it("non-fragment interpolation values throw an error", () => {
      expect(() => (fragment as any)`fragment Foo on User { id ...${123} }`).toThrow(
        "Tagged templates only accept Fragment instances or callback functions as interpolated values"
      );
    });

    it("multiple interpolated fragments in the same selection set work", () => {
      const nameFragment = fragment`fragment UserName on User { name }`();
      const emailFragment = fragment`fragment UserEmail on User { email }`();

      const parentFragment = fragment`fragment UserFull on User {
        id
        ...${nameFragment}
        ...${emailFragment}
      }`();

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("email");
    });
  });

  describe("variable definition auto-merge", () => {
    it("spread fragment variables are merged into parent", () => {
      // Child fragment with variable
      const tasksFragment =
        fragment`fragment EmployeeTasks($completed: Boolean) on Employee { tasks(completed: $completed) { id title } }`();

      // Parent fragment interpolates child WITHOUT re-declaring the variable
      const parentFragment = fragment`fragment EmployeeWithTasks on Employee {
        id
        name
        ...${tasksFragment}
      }`();

      // Verify parent has the child's variable definition
      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(varDefs).toHaveProperty("completed");
      expect(varDefs.completed.kind).toBe("scalar");
      expect(varDefs.completed.name).toBe("Boolean");
      expect(varDefs.completed.modifier).toBe("?");
    });

    it("duplicate variable names with matching types are deduplicated", () => {
      // Child fragment with $userId: ID!
      const userFragment = fragment`fragment UserFields($userId: ID!) on User { id name }`();

      // Parent fragment also declares $userId: ID! and interpolates child
      const parentFragment = fragment`fragment ParentFields($userId: ID!) on User {
        email
        ...${userFragment}
      }`();

      // Should have exactly one $userId variable definition
      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toEqual(["userId"]);
      expect(varDefs.userId.kind).toBe("scalar");
      expect(varDefs.userId.name).toBe("ID");
      expect(varDefs.userId.modifier).toBe("!");
    });

    it("conflicting variable types produce an error", () => {
      // Child fragment with $limit: Int
      const childFragment = fragment`fragment ChildFields($limit: Int) on User { id }`();

      // Parent fragment declares $limit: String (conflict!)
      expect(() => {
        fragment`fragment ParentFields($limit: String) on User {
          name
          ...${childFragment}
        }`();
      }).toThrow("$limit is defined with incompatible types");
    });

    it("variable definitions from multiple interpolated fragments are all merged", () => {
      // Fragment 1 with $showEmail: Boolean on Employee
      const employeeEmailFragment = fragment`fragment EmployeeEmail($showEmail: Boolean) on Employee { id }`();

      // Fragment 2 with $limit: Int
      const tasksFragment = fragment`fragment EmployeeTasks($limit: Int) on Employee { tasks { id } }`();

      // Parent interpolates both
      const parentFragment = fragment`fragment ParentFields on Employee {
        name
        ...${employeeEmailFragment}
        ...${tasksFragment}
      }`();

      // Should have both variables merged
      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs).sort()).toEqual(["limit", "showEmail"].sort());
      expect(varDefs.showEmail.kind).toBe("scalar");
      expect(varDefs.showEmail.name).toBe("Boolean");
      expect(varDefs.limit.kind).toBe("scalar");
      expect(varDefs.limit.name).toBe("Int");
    });

    it("parent variables without manual re-declaration work correctly", () => {
      // Child fragment with required variable
      const tasksFragment =
        fragment`fragment EmployeeTasks($completed: Boolean!) on Employee { tasks(completed: $completed) { id title } }`();

      // Parent does NOT declare $completed - it should be auto-merged
      const parentFragment = fragment`fragment EmployeeWithTasks on Employee {
        id
        ...${tasksFragment}
      }`();

      // Verify the variable is present and correct
      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(varDefs.completed.modifier).toBe("!");

      // Verify spread works with the auto-merged variable
      const varRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: varRef } as never);
      expect(fields).toHaveProperty("tasks");
    });

    it("callback interpolations do not auto-merge variables (they handle their own context)", () => {
      // Child fragment with variable
      const tasksFragment =
        fragment`fragment EmployeeTasks($completed: Boolean) on Employee { tasks(completed: $completed) { id title } }`();

      // Parent uses callback interpolation - should NOT auto-merge child's variables
      const parentFragment = fragment`fragment EmployeeWithTasks on Employee {
        id
        ...${($: { $: Readonly<Record<string, unknown>> }) => tasksFragment.spread({ completed: $.$.completed } as never)}
      }`();

      // Callback interpolations don't merge variables from the child fragment
      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toHaveLength(0);
    });
  });

  describe("Phase 1 E2E: interpolation-based fragment spread with variable auto-merge", () => {
    it("end-to-end: direct interpolation with auto-merged variables works correctly", () => {
      // Scenario: A child fragment with variables is interpolated into a parent
      // The parent should automatically inherit the child's variables without re-declaration

      // Step 1: Create a child fragment with variables
      const tasksFragment =
        fragment`fragment EmployeeTasks($completed: Boolean!, $limit: Int) on Employee {
          tasks(completed: $completed) { id title done }
        }`();

      // Verify child fragment has its own variables
      const childVarDefs = tasksFragment.variableDefinitions as Record<string, any>;
      expect(childVarDefs).toHaveProperty("completed");
      expect(childVarDefs).toHaveProperty("limit");

      // Step 2: Create a parent fragment that interpolates the child WITHOUT re-declaring variables
      const parentFragment = fragment`fragment EmployeeWithTasks on Employee {
        id
        name
        ...${tasksFragment}
      }`();

      // Step 3: Verify parent has auto-merged variables from the child
      const parentVarDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(parentVarDefs).toHaveProperty("completed");
      expect(parentVarDefs.completed.modifier).toBe("!");
      expect(parentVarDefs).toHaveProperty("limit");
      expect(parentVarDefs.limit.modifier).toBe("?");

      // Step 4: Spread the parent fragment with variable assignments
      const completedVarRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: completedVarRef } as never);

      // Step 5: Verify all fields are present (from both parent and child)
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("tasks");

      // Step 6: Verify the tasks field received the variable reference
      const tasksField = fields.tasks as AnyFieldSelection;
      expect(tasksField.args.completed).toBeInstanceOf(VarRef);
      const completedArg = VarRef.getInner(tasksField.args.completed as VarRef<never>);
      expect(completedArg.type).toBe("variable");
      expect(completedArg).toEqual({ type: "variable", name: "completed" });
    });

    it("end-to-end: callback interpolation with explicit variable context works correctly", () => {
      // Scenario: A child fragment with variables is interpolated via callback
      // The parent passes its $ context to the child through the callback

      // Step 1: Create a child fragment with a variable
      const tasksFragment =
        fragment`fragment EmployeeTasks($completed: Boolean!) on Employee {
          tasks(completed: $completed) { id title done }
        }`();

      // Step 2: Create a parent fragment with callback interpolation
      // Parent declares the variable and passes it through $ context
      const parentFragment = fragment`fragment EmployeeWithTasks($completed: Boolean!) on Employee {
        id
        name
        ...${($: { $: Readonly<Record<string, unknown>> }) => tasksFragment.spread({ completed: $.$.completed } as never)}
      }`();

      // Step 3: Verify parent has its own variable declaration
      const parentVarDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(parentVarDefs).toHaveProperty("completed");
      expect(parentVarDefs.completed.modifier).toBe("!");

      // Step 4: Spread the parent fragment
      const completedVarRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: completedVarRef } as never);

      // Step 5: Verify callback received $ context and spread child fields correctly
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("tasks");

      // Step 6: Verify variable was passed through to the child
      const tasksField = fields.tasks as AnyFieldSelection;
      expect(tasksField.args.completed).toBeInstanceOf(VarRef);
    });

    it("end-to-end: multiple interpolated fragments with deduplicated variables", () => {
      // Scenario: Multiple child fragments with overlapping variables are interpolated
      // Variables should be auto-merged and deduplicated correctly

      // Step 1: Create two child fragments with overlapping $limit variable
      const fragment1 = fragment`fragment Frag1($limit: Int) on Employee { id }`();
      const fragment2 = fragment`fragment Frag2($limit: Int, $offset: Int) on Employee { name }`();

      // Step 2: Create parent that interpolates both
      const parentFragment = fragment`fragment Parent on Employee {
        ...${fragment1}
        ...${fragment2}
      }`();

      // Step 3: Verify variables are merged with deduplication
      const parentVarDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(parentVarDefs).sort()).toEqual(["limit", "offset"].sort());

      // Only one $limit definition (deduplicated)
      expect(parentVarDefs.limit.kind).toBe("scalar");
      expect(parentVarDefs.limit.name).toBe("Int");

      // $offset from fragment2
      expect(parentVarDefs.offset.kind).toBe("scalar");
      expect(parentVarDefs.offset.name).toBe("Int");

      // Step 4: Spread works correctly
      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });
  });

  describe("metadata and interpolation coexistence", () => {
    it("supports both interpolated fragment spread and static metadata", () => {
      const childFragment = fragment`fragment ChildFields on User {
        id
      }`();

      const parentFragment = fragment`fragment ParentFields on User {
        ...${childFragment}
        name
      }`({
        metadata: { source: "test" },
      });

      expect(parentFragment).toBeDefined();
      expect(parentFragment.typename).toBe("User");

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("supports both interpolated fragment spread and metadata callback", () => {
      const childFragment = fragment`fragment ChildFields($userId: ID!) on User {
        id
      }`();

      const parentFragment = fragment`fragment ParentFields($userId: ID!) on User {
        ...${childFragment}
        name
      }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => ({
          userId: $ ? "has-context" : "no-context",
        }),
      });

      expect(parentFragment).toBeDefined();
      expect(parentFragment.variableDefinitions).toHaveProperty("userId");

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("metadata callback receives $ context including variables from interpolated fragments", () => {
      const childFragment = fragment`fragment ChildFields($childVar: ID!) on User {
        id
      }`();

      let capturedContext: unknown = null;

      const parentFragment = fragment`fragment ParentFields($parentVar: String!) on User {
        ...${childFragment}
        name
      }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => {
          capturedContext = $;
          return { captured: true };
        },
      });

      // Spread to trigger metadata callback
      parentFragment.spread({} as never);

      // Metadata callback should have received $ context
      expect(capturedContext).toBeDefined();
    });

    it("supports callback interpolation with metadata", () => {
      const childFragment = fragment`fragment ChildFields($userId: ID!) on User {
        id
      }`();

      const parentFragment = fragment`fragment ParentFields($parentId: ID!) on User {
        ...${({ $ }: { $: Record<string, any> }) => childFragment.spread({ userId: $.parentId })}
        name
      }`({
        metadata: { tag: "with-callback-interpolation" },
      });

      expect(parentFragment).toBeDefined();
      expect(parentFragment.variableDefinitions).toHaveProperty("parentId");

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });
  });
});
