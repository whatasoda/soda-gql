# RFC: Minimal Schema & Syntax Reform

## Status

**Draft**

## Summary

This RFC resolves the open items from [Tagged Template API Unification](./tagged-template-unification/index.md) by eliminating `$var`, reforming the callback builder syntax, and reducing the schema type surface to a minimal "graph shape" representation. These changes drastically reduce type-checking cost for consuming applications by shifting type safety from TypeScript-level schema inference to codegen-generated concrete types.

## Navigation

- Prior art: [Tagged Template API Unification](./tagged-template-unification/index.md)

## Motivation

### Type-checking cost scales with schema size

The current architecture requires applications to load the **full schema type** as a generic type parameter (`TSchema`). Every operation instantiates `VarBuilder<TSchema>`, which expands a mapped type over all input type names. `ApplyTypeModifier` runs a 32-branch conditional type per field. `InferField` recursively resolves nested selections through the schema. These costs compound linearly with `operations x fields` and become noticeable at ~50 operations.

### `$var` adds cognitive load without proportional value

The `$var("id").ID("!")` syntax is a custom DSL that users must learn on top of standard GraphQL. Tagged templates already accept standard GraphQL variable syntax (`$id: ID!`). Maintaining two variable declaration systems increases the API surface for no benefit — especially when AI-driven implementation is the primary authoring model.

### Codegen-first workflow enables deferred type safety

With the assumption that **codegen runs before typecheck**, argument types and output types can be provided as pre-computed concrete types in `types.prebuilt.ts`. The type-checker no longer needs to infer these from the schema at the TypeScript level. This eliminates the most expensive type-level computation paths entirely.

## Design Principles

1. **Tagged template handles the common case** — most fragments and operations are expressible in standard GraphQL syntax
2. **Schema provides graph shape only** — the minimal information needed for field validation and type resolution at runtime
3. **Type safety via codegen output** — `types.prebuilt.ts` provides concrete types; no schema-level type inference
4. **AI-first, consistency over brevity** — a two-step model (`define → finalize`) is acceptable if it's consistent across all paths
5. **Standard GraphQL syntax for variables** — eliminate custom DSLs; use what developers and AI already know

## Decisions

### D1: Unified two-step model for operations

**Decision**: `query("Name")` returns a value that accepts either a tagged template or an options object. Both paths return a `TemplateResult` that must be invoked with `()` or `({ metadata })` to produce a final `Operation`.

**Chosen over**:
- Options object returning `Operation` directly (inconsistent with tagged template path)
- Metadata inside the options object (metadata depends on `$` and `document` from step 1)

**Rationale**: Metadata callbacks receive `$` (variable references) and `document` (built AST), which are only available after step 1 completes. Placing metadata in step 2 matches the information flow. A uniform two-step model reduces cognitive overhead — both paths follow the same pattern.

```typescript
// Path A: tagged template
query("GetUser")`($id: ID!) {
  employee(id: $id) { id name }
}`()

// Path B: options object
query("GetUser")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ... }),
})()

// Both paths: metadata in step 2
query("GetUser")`...`({ metadata: ({ $, document }) => ({ ... }) })
query("GetUser")({ ... })({ metadata: ({ $, document }) => ({ ... }) })
```

**Overload dispatch**: Runtime checks `typeof firstArg` — `TemplateStringsArray` (has `.raw`) routes to tagged template, plain object routes to options.

**Return type**:

```typescript
type CurriedOperation =
  & ((strings: TemplateStringsArray, ...values: Interpolation[]) => TemplateResult)
  & ((options: OperationOptions) => TemplateResult);

type TemplateResult = {
  (): Operation<...>;
  (options: { metadata: MetadataBuilder }): Operation<...>;
};
```

### D2: `$var` eliminated — variables use GraphQL syntax everywhere

**Decision**: Remove `$var`, `VarBuilder`, `createVarMethodFactory`, and `inputTypeMethods` entirely. Variables are declared in standard GraphQL syntax in both tagged templates and options objects.

**Chosen over**:
- Keeping `$var` for callback builders only (two systems for the same concept)
- A simplified `$var` without schema dependency (still a custom DSL)

**Rationale**: Tagged templates already parse GraphQL variable declarations via `buildVarSpecifiers`. The same parser handles the options object's `variables` string. The `$` proxy is constructed from parse results identically in both paths. No new infrastructure is needed.

**What is deleted**:

| Target | File |
|--------|------|
| `VarBuilder<TSchema>` type | `packages/core/src/composer/var-builder.ts` |
| `createVarMethodFactory` | `packages/core/src/composer/var-builder.ts` |
| `inputTypeMethods` generation | codegen output |
| `AllInputTypeNames<TSchema>` mapped type | `packages/core/src/composer/var-builder.ts` |
| `$var` in composer context | `packages/core/src/composer/gql-composer.ts` |

### D3: Field accessor changes from property access to function call

**Decision**: Change `f.fieldName(args)` to `f("fieldName", args)`.

**Chosen over**:
- Keeping `f.fieldName` with `Record<string, Function>` (breaks `noUncheckedIndexedAccess`)
- A proxy-based approach (unnecessary complexity)

**Rationale**: Under `noUncheckedIndexedAccess`, `Record<string, Function>` returns `Function | undefined`, requiring non-null assertions everywhere. `f("fieldName")` returns a non-optional type from a function call. After codegen, string literal overloads provide type safety per field:

```typescript
// Pre-codegen: generic
type FieldAccessor = (field: string, args?: Record<string, unknown>) => FieldFactory;

// Post-codegen: overloaded per operation
type FieldAccessor_GetUser = {
  (field: "employee", args: { id: VarRef | string }): NestedSelector;
  (field: "employees", args?: { limit?: VarRef | number }): NestedSelector;
  (field: string, args?: Record<string, unknown>): FieldFactory;
};
```

**Syntax**:

```typescript
// Before
f.employee({ id: $.userId })(({ f }) => ({
  ...f.name(),
  ...f.tasks({ completed: true })(({ f }) => ({
    ...f.id(),
    ...f.title(),
  })),
}))

// After
f("employee", { id: $.userId })(({ f }) => ({
  ...f("name")(),
  ...f("tasks", { completed: true })(({ f }) => ({
    ...f("id")(),
    ...f("title")(),
  })),
}))
```

### D4: `$colocate` remains in composer context

**Decision**: `$colocate` is provided via the composer context callback, not injected into the `fields` callback arguments.

**Chosen over**:
- Injecting into `fields: ({ f, $, $colocate }) => ...` (spreads injection points)
- Standalone import from `@soda-gql/core` (breaks consistency with other context tools)

**Rationale**: `query`, `fragment`, and other tools already come from the composer context. Keeping `$colocate` there maintains a single injection point. The `fields` callback stays minimal with just `{ f, $ }`.

```typescript
gql.default(({ query, $colocate }) =>
  query("GetUserData")({
    variables: `(
      $userId: ID!
      $profileId: ID!
    )`,
    fields: ({ f, $ }) =>
      $colocate({
        userCard: { ...f("user", { id: $.userId })(() => ({ ... })) },
        userProfile: { ...f("user", { id: $.profileId })(() => ({ ... })) },
      }),
  })()
)
```

### D5: Fragment syntax unchanged

**Decision**: Fragment definition syntax remains as-is. No options object path for fragments.

**Rationale**: Fragments rarely need programmatic field construction. Tagged template + `()` / `({ metadata })` covers all practical cases. Adding an options object path for fragments would increase API surface without clear benefit.

```typescript
// Simple fragment
fragment("EmployeeFragment", "Employee")`{ id name email }`()

// Fragment with variables
fragment("EmployeeFragment", "Employee")`($taskLimit: Int) {
  id name tasks(limit: $taskLimit) { id title }
}`()

// Fragment with metadata
fragment("EmployeeFragment", "Employee")`{ id name }`({
  metadata: { headers: { "X-Cache": "fragment" } },
})
```

### D6: Fragment interpolation in tagged templates unchanged

**Decision**: Fragment spreading syntax in tagged templates remains as-is.

```typescript
// Without variables
query("GetUser")`($id: ID!) {
  employee(id: $id) { ...${employeeFragment} }
}`()

// With variable pass-through
query("GetUser")`($id: ID!, $taskLimit: Int) {
  employee(id: $id) { ...${({ $ }) => employeeFragment.spread({ taskLimit: $.taskLimit })} }
}`()
```

**Rationale**: Variable-bound spreads inherently need a callback to access `$`. GraphQL has no native syntax for passing variables to fragment spreads, so a custom form is unavoidable. The existing syntax works and has low usage frequency.

### D7: Composer context changes

**Decision**: The composer context is updated as follows:

| Property | Before | After |
|----------|--------|-------|
| `query` | curried + `.operation()` + `.compat()` | curried (tagged template / options object) + `.compat()` |
| `mutation` | same as query | same as query |
| `subscription` | same as query | same as query |
| `fragment` | curried tagged template | unchanged |
| `$var` | `VarBuilder<TSchema>` | **deleted** |
| `$colocate` | colocate helper | unchanged |
| `$dir` | directive builder | unchanged |
| `define` | GqlDefine factory | unchanged |
| `extend` | compat → Operation | unchanged |

`.operation()` is removed from `query`/`mutation`/`subscription` — its functionality is absorbed by the options object path of the curried function. `.compat()` remains on the curried function as a property.

### D8: `getNameAt` / `getValueAt` use PrebuiltTypes instead of full schema

**Decision**: These utilities continue to work but resolve types from `PrebuiltTypes` operation-specific `varTypes` instead of the full schema.

**Rationale**: At runtime, these functions are schema-independent (Proxy-based object navigation). At the type level, they only need the input type's field structure. Codegen generates the concrete type per operation in `types.prebuilt.ts`, eliminating the need for `ResolveTypeFromMeta<TSchema, ...>`.

## Before / After Reference

### 4.1 Application code — all patterns

```typescript
import { gql } from "@/graphql-system";

// ─── Fragment (unchanged) ──────────────────────────────
export const employeeFragment = gql.default(({ fragment }) =>
  fragment("EmployeeFragment", "Employee")`($taskLimit: Int) {
    id name email role
    tasks(limit: $taskLimit) { id title completed }
  }`(),
);

// ─── Operation: tagged template (unchanged) ────────────
export const getUsers = gql.default(({ query }) =>
  query("GetUsers")`{ employees { id name } }`()
);

// ─── Operation: tagged template + fragment spread ──────
export const getEmployee = gql.default(({ query }) =>
  query("GetEmployee")`($id: ID!) {
    employee(id: $id) { ...${employeeFragment} }
  }`()
);

// ─── Operation: options object ($var eliminated) ───────
//
// BEFORE:
// gql.default(({ query, $var }) =>
//   query.operation({
//     name: "GetEmployee",
//     variables: { ...$var("employeeId").ID("!"), ...$var("taskLimit").Int("?") },
//     fields: ({ f, $ }) => ({
//       ...f.employee({ id: $.employeeId })(({ f }) => ({
//         ...employeeFragment.spread({ taskLimit: $.taskLimit }),
//       })),
//     }),
//     metadata: ({ $ }) => ({ ... }),
//   })
// )
//
// AFTER:
export const getEmployeeById = gql.default(({ query }) =>
  query("GetEmployee")({
    variables: `(
      $employeeId: ID!
      $taskLimit: Int
    )`,
    fields: ({ f, $ }) => ({
      ...f("employee", { id: $.employeeId })(({ f }) => ({
        ...employeeFragment.spread({ taskLimit: $.taskLimit }),
      })),
    }),
  })({
    metadata: ({ $ }) => ({ ... }),
  })
);

// ─── Operation: $colocate ──────────────────────────────
//
// BEFORE:
// gql.default(({ query, $var, $colocate }) =>
//   query.operation({
//     name: "GetUserData",
//     variables: { ...$var("userId").ID("!"), ...$var("profileId").ID("!") },
//     fields: ({ f, $ }) =>
//       $colocate({
//         userCard: { ...f.user({ id: $.userId })(() => ({ ...UserCardFields.spread() })) },
//         userProfile: { ...f.user({ id: $.profileId })(() => ({ ...UserIdFields.spread() })) },
//       }),
//   })
// )
//
// AFTER:
export const getUserData = gql.default(({ query, $colocate }) =>
  query("GetUserData")({
    variables: `(
      $userId: ID!
      $profileId: ID!
    )`,
    fields: ({ f, $ }) =>
      $colocate({
        userCard: {
          ...f("user", { id: $.userId })(({ f }) => ({
            ...UserCardFields.spread(),
          })),
        },
        userProfile: {
          ...f("user", { id: $.profileId })(({ f }) => ({
            ...UserIdFields.spread(),
          })),
        },
      }),
  })()
);

// ─── Type extraction (unchanged) ───────────────────────
type Input = typeof getEmployee.$infer.input;
type Output = typeof getEmployee.$infer.output;
```

### 4.2 Codegen output

#### `_defs/graph.ts` (NEW — replaces `_defs/objects.ts`)

```typescript
// BEFORE (_defs/objects.ts):
// export const object_default_Employee = {
//   name: "Employee",
//   fields: {
//     id: { spec: "s|ID|!", arguments: {} },
//     name: { spec: "s|String|!", arguments: {} },
//     tasks: { spec: "o|Task|![]!", arguments: { completed: "s|Boolean|?", limit: "s|Int|?" } },
//   },
// } as const;

// AFTER (_defs/graph.ts):
export const object_default = {
  Query: {
    employee: "o|Employee|?",
    employees: "o|Employee|![]!",
  },
  Employee: {
    id: "s|ID|!",
    name: "s|String|!",
    email: "s|String|!",
    role: "e|EmployeeRole|!",
    tasks: "o|Task|![]!",
    manager: "o|Employee|?",
  },
  Task: {
    id: "s|ID|!",
    title: "s|String|!",
    completed: "s|Boolean|!",
    priority: "e|TaskPriority|?",
  },
  // ...
} as const;
```

#### `_defs/unions.ts` (simplified)

```typescript
// BEFORE:
// export const union_default_ActivityItem = {
//   name: "ActivityItem",
//   types: { Comment: true, Task: true },
// } as const;

// AFTER:
export const union_default = {
  ActivityItem: ["Comment", "Task"],
  SearchResult: ["Employee", "Project", "Task"],
} as const;
```

#### `_defs/type-names.ts` (NEW — replaces `_defs/enums.ts`, `_defs/inputs.ts`)

```typescript
// BEFORE: full enum/input definitions with values and field structures
//
// AFTER: names only for type kind resolution
export const typeNames_default = {
  scalar: ["ID", "String", "Int", "Float", "Boolean", "DateTime", "BigInt", "JSON"],
  enum: ["EmployeeRole", "ProjectStatus", "SortOrder", "TaskPriority"],
  input: ["CreateProjectInput", "CreateTaskInput", "BigIntFilter", "BooleanFilter"],
} as const;
```

#### `_internal.ts` (drastically simplified)

```typescript
// BEFORE: ~93 lines with full schema assembly, inputTypeMethods, createVarMethodFactory
//
// AFTER:
import { createGqlElementComposer, createStandardDirectives } from "@soda-gql/core";
import { object_default } from "./_defs/graph";
import { union_default } from "./_defs/unions";
import { typeNames_default } from "./_defs/type-names";

const defaultSchema = {
  label: "default" as const,
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" } as const,
  object: object_default,
  union: union_default,
  typeNames: typeNames_default,
} as const;

const customDirectives_default = { ...createStandardDirectives(), ...{} };

export const __gql_default = createGqlElementComposer(
  defaultSchema,
  { directiveMethods: customDirectives_default },
);
```

Note: `_internal-injects.ts` (scalar definitions) is retained — it is referenced by `types.prebuilt.ts` for `ScalarInput_default` / `ScalarOutput_default` type helpers, but is **not** part of the MinimalSchema object. Scalars are listed by name only in `typeNames_default`.

#### `types.prebuilt.ts` (extended)

```typescript
import type { PrebuiltTypeRegistry } from "@soda-gql/core";
import type { scalar_default } from "./_internal-injects";

type ScalarInput_default<T extends keyof typeof scalar_default> = typeof scalar_default[T]["$type"]["input"];
type ScalarOutput_default<T extends keyof typeof scalar_default> = typeof scalar_default[T]["$type"]["output"];

export type PrebuiltTypes_default = {
  readonly fragments: {
    readonly "EmployeeFragment": {
      readonly typename: "Employee";
      readonly input: { readonly taskLimit?: number | null };
      readonly output: {
        readonly id: ScalarOutput_default<"ID">;
        readonly name: ScalarOutput_default<"String">;
        readonly email: ScalarOutput_default<"String">;
        readonly role: "DIRECTOR" | "ENGINEER" | "EXECUTIVE" | "INTERN" | "MANAGER";
        readonly tasks: ({
          readonly id: ScalarOutput_default<"ID">;
          readonly title: ScalarOutput_default<"String">;
          readonly completed: ScalarOutput_default<"Boolean">;
        })[];
      };
    };
  };
  readonly operations: {
    readonly "GetEmployee": {
      readonly input: {
        readonly employeeId: ScalarInput_default<"ID">;
        readonly taskLimit?: ScalarInput_default<"Int"> | null;
      };
      readonly output: {
        readonly employee: ({
          readonly id: ScalarOutput_default<"ID">;
          readonly name: ScalarOutput_default<"String">;
          // ... (spread from EmployeeFragment)
        }) | null;
      };
      // NEW: variable type structures for getValueAt/getNameAt
      readonly varTypes: {
        readonly employeeId: ScalarInput_default<"ID">;
        readonly taskLimit: ScalarInput_default<"Int"> | null;
      };
      // NEW: field accessor overloads per selection depth
      readonly fields: {
        readonly "Query": {
          readonly employee: {
            args: { id: string | VarRef };
            returns: "Employee";
          };
        };
        readonly "Employee": {
          readonly id: { args: never; returns: null };
          readonly name: { args: never; returns: null };
          readonly email: { args: never; returns: null };
          readonly role: { args: never; returns: null };
          readonly tasks: {
            args: { completed?: boolean | VarRef; limit?: number | VarRef };
            returns: "Task";
          };
        };
        readonly "Task": {
          readonly id: { args: never; returns: null };
          readonly title: { args: never; returns: null };
          readonly completed: { args: never; returns: null };
        };
      };
    };
  };
};
```

### 4.3 Composer context

```typescript
// BEFORE:
gql.default(({
  query,          // curried + .operation() + .compat()
  mutation,       // same
  subscription,   // same
  fragment,       // curried tagged template
  $var,           // VarBuilder<TSchema> ← HEAVY mapped type
  $colocate,      // colocate helper
  $dir,           // directive builder
  define,         // GqlDefine factory
  extend,         // compat → Operation
}) => ...);

// AFTER:
gql.default(({
  query,          // curried (tagged template / options object) + .compat()
  mutation,       // same
  subscription,   // same
  fragment,       // curried tagged template (unchanged)
  // $var        ← DELETED
  $colocate,      // unchanged
  $dir,           // unchanged
  define,         // unchanged
  extend,         // unchanged
}) => ...);
```

### 4.4 Formatter rules

Variables and fields at each nesting level follow the same rule:

| Count | Behavior |
|-------|----------|
| 0 | Omit (variables) or empty braces |
| 1 | Single line by default. If user has already inserted a line break, preserve it |
| 2+ | Always break — one item per line |

Formatter enforces template literals for variables in options objects (rejects regular string literals `"..."`).

```typescript
// 1 variable: single line
query("GetUser")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ... }),
})()

// 2+ variables: always break
query("GetEmployee")({
  variables: `(
    $employeeId: ID!
    $taskLimit: Int
  )`,
  fields: ({ f, $ }) => ({ ... }),
})()

// 1 field: single line (or broken if user chose)
query("GetUser")`($id: ID!) { employee(id: $id) { id } }`()

// 2+ fields: always break
query("GetUser")`($id: ID!) {
  employee(id: $id) { id }
  department { name }
}`()
```

## Deletion Inventory

### Files to delete

| File | Reason |
|------|--------|
| `packages/core/src/composer/var-builder.ts` | `$var` eliminated |
| `packages/core/src/types/element/fields-builder.ts` | Property-based `f.field` replaced by `f("field")` |

### Types to delete

| Type | Location | Reason |
|------|----------|--------|
| `VarBuilder<TSchema>` | `var-builder.ts` | `$var` eliminated |
| `AllInputTypeNames<TSchema>` | `var-builder.ts` | No longer needed |
| `VarBuilderMethods<TVarName, TSchema>` | `var-builder.ts` | No longer needed |
| `FieldSelectionFactories<TSchema, TTypeName>` | `fields-builder.ts` | Replaced by `f()` function |
| `inputTypeMethods` mapped type | codegen output | No longer generated |

### Codegen output changes

| Before | After |
|--------|-------|
| `_defs/objects.ts` (fields + arguments) | `_defs/graph.ts` (spec strings only) |
| `_defs/enums.ts` (full enum definitions) | `_defs/type-names.ts` (names only) |
| `_defs/inputs.ts` (full input field structures) | `_defs/type-names.ts` (names only) |
| `inputTypeMethods_default` in `_internal.ts` | deleted |
| `createVarMethodFactory` call in `_internal.ts` | deleted |

## Implementation Order

All changes are made without migration paths (pre-release v0.2.0).

| Step | Scope | Content | Dependencies |
|------|-------|---------|--------------|
| 1 | Core | Define `MinimalSchema` type, replacing `AnyGraphqlSchema` for composer use | None |
| 2 | Codegen | Generate `_defs/graph.ts`, `_defs/type-names.ts`, simplified `_internal.ts` | Step 1 |
| 3 | Typegen | Extend `types.prebuilt.ts` with `varTypes` and `fields` entries | Step 2 |
| 4-6 | Core (single PR) | Delete `$var` / `VarBuilder` / `inputTypeMethods`; implement `f("field", args)` accessor; implement `query("Name")({ variables, fields })` options object path | Steps 1-3 |
| 7 | Tools | Update formatter for variables/fields line break rules and template literal enforcement | Step 4-6 |
| 8 | All | Rewrite tests and fixtures to new syntax | Steps 4-7 |

Steps 4-6 are done in a single PR due to strong interdependencies. The before/after reference in section 4 serves as the mechanical rewrite guide for step 8.
