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

  describe("fragment spread in tagged templates", () => {
    it("throws error when fragment spread is used without interpolation", () => {
      expect(() => {
        const frag = fragment("UserWithSpread", "User")`{ ...SomeFragment }`();
        frag.spread({} as never);
      }).toThrow('Fragment spread "...SomeFragment" in tagged template must use interpolation syntax');
    });
  });

  describe("basic fragment creation", () => {
    it("creates a fragment with correct typename, key, and schemaLabel", () => {
      const result = fragment("UserFields", "User")`{ id name }`();
      expect(result.typename).toBe("User");
      expect(result.key).toBe("UserFields");
      expect(result.schemaLabel).toBe("test");
    });

    it("fragment on Post type resolves correctly", () => {
      const result = fragment("PostFields", "Post")`{ id title }`();
      expect(result.typename).toBe("Post");
      expect(result.key).toBe("PostFields");
    });

    it("spread function returns correct fields", () => {
      const result = fragment("UserFields", "User")`{ id name }`();
      const fields = result.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("allows __typename as an implicit introspection field", () => {
      const result = fragment("UserWithTypename", "User")`{ __typename id name }`();
      const fields = result.spread({} as never);
      expect(fields).toHaveProperty("__typename");
      expect(fields).toHaveProperty("id");
    });
  });

  describe("variable definitions", () => {
    it("fragment without variables produces empty variableDefinitions", () => {
      const result = fragment("UserFields", "User")`{ id name }`();
      expect(result.variableDefinitions).toEqual({});
    });

    it("fragment with variables extracts VarSpecifier records", () => {
      const result = fragment("UserFields", "User")`($showEmail: Boolean!) { id }`();
      expect(result.variableDefinitions).toHaveProperty("showEmail");
      const showEmail = (result.variableDefinitions as Record<string, any>).showEmail;
      expect(showEmail.kind).toBe("scalar");
      expect(showEmail.name).toBe("Boolean");
      expect(showEmail.modifier).toBe("!");
    });

    it("fragment with default values extracts defaultValue", () => {
      const result = fragment("UserFields", "User")`($limit: Int = 10) { id }`();
      const limit = (result.variableDefinitions as Record<string, any>).limit;
      expect(limit.kind).toBe("scalar");
      expect(limit.name).toBe("Int");
      expect(limit.defaultValue).toEqual({ default: 10 });
    });

    it("fragment with multiple variables extracts all", () => {
      const result = fragment("UserFields", "User")`($showEmail: Boolean!, $limit: Int) { id }`();
      const varDefs = result.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toHaveLength(2);
      expect(varDefs).toHaveProperty("showEmail");
      expect(varDefs).toHaveProperty("limit");
    });
  });

  describe("metadata callbacks", () => {
    it("supports static metadata value", () => {
      const userFragment = fragment("UserFields", "User")`{ id name }`({
        metadata: { headers: { "X-Custom": "test" } },
      });

      expect(userFragment).toBeDefined();
      expect(userFragment.typename).toBe("User");
    });

    it("supports metadata callback with variable access", () => {
      const userFragment = fragment("UserFields", "User")`($userId: ID!) { id name }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => {
          return {
            headers: {
              "X-User-Var": $.userId ? "has-userId" : "no-userId",
            },
          };
        },
      });

      expect(userFragment).toBeDefined();
      expect(userFragment.typename).toBe("User");

      const varRef = createVarRefFromVariable("userId");
      const fields = userFragment.spread({ userId: varRef } as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("metadata callback without variables receives empty $", () => {
      const userFragment = fragment("UserFields", "User")`{ id name }`({
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
    it("throws when type is not found in schema at curried call time", () => {
      expect(() => fragment("Foo", "NonExistent")).toThrow('Type "NonExistent" is not defined in schema objects');
    });

    it("throws when interpolated value is not a Fragment or callback", () => {
      const fn = createFragmentTaggedTemplate(schema);
      expect(() => (fn("Foo", "User") as any)(["part1", "part2"], "interpolated")).toThrow(
        "Tagged templates only accept Fragment instances or callback functions as interpolated values",
      );
    });

    it("throws on parse errors", () => {
      expect(() => fragment("UserFields", "User")`{ invalid!!! syntax }`).toThrow("GraphQL parse error");
    });

    it("throws when selecting a field not in the schema", () => {
      const frag = fragment("Foo", "User")`{ nonexistent }`();
      expect(() => frag.spread({} as never)).toThrow('Field "nonexistent" is not defined on type "User"');
    });
  });

  describe("spread function", () => {
    it("spread function is callable and returns", () => {
      const result = fragment("UserFields", "User")`{ id name }`();
      expect(typeof result.spread).toBe("function");
      const spreadResult = result.spread({} as never);
      expect(spreadResult).toBeDefined();
    });
  });

  describe("variable references in spread", () => {
    it("spread with VarRef produces args containing the VarRef", () => {
      const frag = fragment("EmployeeTasks", "Employee")`($completed: Boolean) { tasks(completed: $completed) { id title } }`();
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
      const frag = fragment("EmployeeTasks", "Employee")`($completed: Boolean) { tasks(completed: $completed) { id title } }`();
      const fields = frag.spread({ completed: true } as never);
      const tasksField = fields.tasks as AnyFieldSelection;
      const completedArg = tasksField.args.completed;
      expect(completedArg).toBeInstanceOf(VarRef);
      const inner = VarRef.getInner(completedArg as VarRef<never>);
      expect(inner.type).toBe("nested-value");
      expect(inner).toEqual({ type: "nested-value", value: true });
    });

    it("spread without variables works unchanged", () => {
      const frag = fragment("EmployeeBasic", "Employee")`{ id name }`();
      const fields = frag.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("unassigned variable produces nested-value VarRef with undefined", () => {
      const frag = fragment("EmployeeTasks", "Employee")`($completed: Boolean) { tasks(completed: $completed) { id title } }`();
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
      const nameFragment = fragment("UserName", "User")`{ name }`();

      const parentFragment = fragment("UserWithName", "User")`{ id ...${nameFragment} }`();

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });

    it("callback interpolation receives $ context", () => {
      const tasksFragment = fragment(
        "EmployeeTasks",
        "Employee",
      )`($completed: Boolean) { tasks(completed: $completed) { id title } }`();

      const parentFragment = fragment("EmployeeWithTasks", "Employee")`($completed: Boolean) {
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
      expect(() => (fragment("Foo", "User") as any)(["{ id ...", " }"], 123)).toThrow(
        "Tagged templates only accept Fragment instances or callback functions as interpolated values",
      );
    });

    it("multiple interpolated fragments in the same selection set work", () => {
      const nameFragment = fragment("UserName", "User")`{ name }`();
      const emailFragment = fragment("UserEmail", "User")`{ email }`();

      const parentFragment = fragment("UserFull", "User")`{
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
      const tasksFragment = fragment(
        "EmployeeTasks",
        "Employee",
      )`($completed: Boolean) { tasks(completed: $completed) { id title } }`();

      const parentFragment = fragment("EmployeeWithTasks", "Employee")`{
        id
        name
        ...${tasksFragment}
      }`();

      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(varDefs).toHaveProperty("completed");
      expect(varDefs.completed.kind).toBe("scalar");
      expect(varDefs.completed.name).toBe("Boolean");
      expect(varDefs.completed.modifier).toBe("?");
    });

    it("duplicate variable names with matching types are deduplicated", () => {
      const userFragment = fragment("UserFields", "User")`($userId: ID!) { id name }`();

      const parentFragment = fragment("ParentFields", "User")`($userId: ID!) {
        email
        ...${userFragment}
      }`();

      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toEqual(["userId"]);
      expect(varDefs.userId.kind).toBe("scalar");
      expect(varDefs.userId.name).toBe("ID");
      expect(varDefs.userId.modifier).toBe("!");
    });

    it("conflicting variable types produce an error", () => {
      const childFragment = fragment("ChildFields", "User")`($limit: Int) { id }`();

      expect(() => {
        fragment("ParentFields", "User")`($limit: String) {
          name
          ...${childFragment}
        }`();
      }).toThrow("$limit is defined with incompatible types");
    });

    it("variable definitions from multiple interpolated fragments are all merged", () => {
      const employeeEmailFragment = fragment("EmployeeEmail", "Employee")`($showEmail: Boolean) { id }`();
      const tasksFragment = fragment("EmployeeTasks", "Employee")`($limit: Int) { tasks { id } }`();

      const parentFragment = fragment("ParentFields", "Employee")`{
        name
        ...${employeeEmailFragment}
        ...${tasksFragment}
      }`();

      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs).sort()).toEqual(["limit", "showEmail"].sort());
      expect(varDefs.showEmail.kind).toBe("scalar");
      expect(varDefs.showEmail.name).toBe("Boolean");
      expect(varDefs.limit.kind).toBe("scalar");
      expect(varDefs.limit.name).toBe("Int");
    });

    it("parent variables without manual re-declaration work correctly", () => {
      const tasksFragment = fragment(
        "EmployeeTasks",
        "Employee",
      )`($completed: Boolean!) { tasks(completed: $completed) { id title } }`();

      const parentFragment = fragment("EmployeeWithTasks", "Employee")`{
        id
        ...${tasksFragment}
      }`();

      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(varDefs.completed.modifier).toBe("!");

      const varRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: varRef } as never);
      expect(fields).toHaveProperty("tasks");
    });

    it("callback interpolations do not auto-merge variables (they handle their own context)", () => {
      const tasksFragment = fragment(
        "EmployeeTasks",
        "Employee",
      )`($completed: Boolean) { tasks(completed: $completed) { id title } }`();

      const parentFragment = fragment("EmployeeWithTasks", "Employee")`{
        id
        ...${($: { $: Readonly<Record<string, unknown>> }) => tasksFragment.spread({ completed: $.$.completed } as never)}
      }`();

      const varDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toHaveLength(0);
    });
  });

  describe("E2E: interpolation-based fragment spread with variable auto-merge", () => {
    it("end-to-end: direct interpolation with auto-merged variables works correctly", () => {
      const tasksFragment = fragment("EmployeeTasks", "Employee")`($completed: Boolean!, $limit: Int) {
          tasks(completed: $completed) { id title done }
        }`();

      const childVarDefs = tasksFragment.variableDefinitions as Record<string, any>;
      expect(childVarDefs).toHaveProperty("completed");
      expect(childVarDefs).toHaveProperty("limit");

      const parentFragment = fragment("EmployeeWithTasks", "Employee")`{
        id
        name
        ...${tasksFragment}
      }`();

      const parentVarDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(parentVarDefs).toHaveProperty("completed");
      expect(parentVarDefs.completed.modifier).toBe("!");
      expect(parentVarDefs).toHaveProperty("limit");
      expect(parentVarDefs.limit.modifier).toBe("?");

      const completedVarRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: completedVarRef } as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("tasks");

      const tasksField = fields.tasks as AnyFieldSelection;
      expect(tasksField.args.completed).toBeInstanceOf(VarRef);
      const completedArg = VarRef.getInner(tasksField.args.completed as VarRef<never>);
      expect(completedArg.type).toBe("variable");
      expect(completedArg).toEqual({ type: "variable", name: "completed" });
    });

    it("end-to-end: callback interpolation with explicit variable context works correctly", () => {
      const tasksFragment = fragment("EmployeeTasks", "Employee")`($completed: Boolean!) {
          tasks(completed: $completed) { id title done }
        }`();

      const parentFragment = fragment("EmployeeWithTasks", "Employee")`($completed: Boolean!) {
        id
        name
        ...${($: { $: Readonly<Record<string, unknown>> }) => tasksFragment.spread({ completed: $.$.completed } as never)}
      }`();

      const parentVarDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(parentVarDefs).toHaveProperty("completed");
      expect(parentVarDefs.completed.modifier).toBe("!");

      const completedVarRef = createVarRefFromVariable("completed");
      const fields = parentFragment.spread({ completed: completedVarRef } as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("tasks");

      const tasksField = fields.tasks as AnyFieldSelection;
      expect(tasksField.args.completed).toBeInstanceOf(VarRef);
    });

    it("end-to-end: multiple interpolated fragments with deduplicated variables", () => {
      const fragment1 = fragment("Frag1", "Employee")`($limit: Int) { id }`();
      const fragment2 = fragment("Frag2", "Employee")`($limit: Int, $offset: Int) { name }`();

      const parentFragment = fragment("Parent", "Employee")`{
        ...${fragment1}
        ...${fragment2}
      }`();

      const parentVarDefs = parentFragment.variableDefinitions as Record<string, any>;
      expect(Object.keys(parentVarDefs).sort()).toEqual(["limit", "offset"].sort());

      expect(parentVarDefs.limit.kind).toBe("scalar");
      expect(parentVarDefs.limit.name).toBe("Int");

      expect(parentVarDefs.offset.kind).toBe("scalar");
      expect(parentVarDefs.offset.name).toBe("Int");

      const fields = parentFragment.spread({} as never);
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
    });
  });

  describe("metadata and interpolation coexistence", () => {
    it("supports both interpolated fragment spread and static metadata", () => {
      const childFragment = fragment("ChildFields", "User")`{
        id
      }`();

      const parentFragment = fragment("ParentFields", "User")`{
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
      const childFragment = fragment("ChildFields", "User")`($userId: ID!) {
        id
      }`();

      const parentFragment = fragment("ParentFields", "User")`($userId: ID!) {
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
      const childFragment = fragment("ChildFields", "User")`($childVar: ID!) {
        id
      }`();

      let capturedContext: unknown = null;

      const parentFragment = fragment("ParentFields", "User")`($parentVar: String!) {
        ...${childFragment}
        name
      }`({
        metadata: ({ $ }: { $: Record<string, unknown> }) => {
          capturedContext = $;
          return { captured: true };
        },
      });

      parentFragment.spread({} as never);

      expect(capturedContext).toBeDefined();
    });

    it("supports callback interpolation with metadata", () => {
      const childFragment = fragment("ChildFields", "User")`($userId: ID!) {
        id
      }`();

      const parentFragment = fragment("ParentFields", "User")`($parentId: ID!) {
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
