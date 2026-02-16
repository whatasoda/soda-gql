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
    it("spreads another fragment's fields into parent fragment", () => {
      // Create base fragment
      const userBaseFields = fragment`fragment UserBaseFields on User { id name }`();

      // Create parent fragment that spreads the base fragment
      const userExtendedFields = fragment`fragment UserExtendedFields on User { ...UserBaseFields email }`({
        fragments: { UserBaseFields: userBaseFields },
      });

      // Spread parent fragment to get fields
      const fields = userExtendedFields.spread({} as never);

      // Verify that fields from base fragment are present
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("email");
    });

    it("throws error when fragment spread references undefined fragment", () => {
      expect(() => {
        const frag = fragment`fragment UserWithSpread on User { ...UndefinedFragment }`({
          fragments: {},
        });
        frag.spread({} as never);
      }).toThrow('Fragment "UndefinedFragment" is not defined in the fragment registry');
    });

    it("throws error when fragment spread is used without fragment registry", () => {
      expect(() => {
        const frag = fragment`fragment UserWithSpread on User { ...SomeFragment }`();
        frag.spread({} as never);
      }).toThrow('Fragment spread "...SomeFragment" requires a fragment registry');
    });

    it("spreads multiple fragments in same selection set", () => {
      const userIdFragment = fragment`fragment UserIdFields on User { id }`();
      const userNameFragment = fragment`fragment UserNameFields on User { name }`();

      const userCombinedFragment = fragment`fragment UserCombinedFields on User { ...UserIdFields ...UserNameFields email }`({
        fragments: {
          UserIdFields: userIdFragment,
          UserNameFields: userNameFragment,
        },
      });

      const fields = userCombinedFragment.spread({} as never);

      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("name");
      expect(fields).toHaveProperty("email");
    });

    it("forwards variable assignments through fragment spread", () => {
      // Fragment with variable that affects field arguments
      const taskFragment = fragment`fragment TaskFields($completed: Boolean) on Employee { id tasks(completed: $completed) { id title } }`();

      // Parent fragment that spreads the task fragment
      const employeeFragment = fragment`fragment EmployeeFields($completed: Boolean) on Employee { ...TaskFields name }`({
        fragments: { TaskFields: taskFragment },
      });

      // Create variable reference
      const varRef = createVarRefFromVariable("completed");

      // Spread with variable assignment
      const fields = employeeFragment.spread({ completed: varRef } as never);

      // Verify fields are present (runtime behavior check)
      expect(fields).toHaveProperty("id");
      expect(fields).toHaveProperty("tasks");
      expect(fields).toHaveProperty("name");
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
});
