---
name: gql:scaffold
description: Generate GraphQL fragments and operations with type-safe syntax
user-invocable: true
argument-hint: [description of what to query]
allowed-tools: Bash(bun *), Read, Grep, Glob, Write, AskUserQuestion
---

# GraphQL Scaffold Skill

This skill generates type-safe GraphQL fragments and operations from schema introspection. It intelligently chooses between tagged template and callback builder syntax based on feature requirements.

## Workflow

### 1. Detect Project Configuration

First, detect the soda-gql project configuration:

!`bun ${CLAUDE_PLUGIN_ROOT}/scripts/detect-project.ts`

The output includes:
- `found`: Whether a soda-gql project was detected
- `configPath`: Path to the config file
- `schemas`: Schema names and their file paths
- `outdir`: Output directory for generated files
- `hasLsp`: Whether LSP is available

### 2. Check Project Found

If `found: false`, inform the user:
> No soda-gql project detected. Make sure you have a `soda-gql.config.{ts,js,mjs}` file and have run `bun install`.

Exit the skill.

### 3. Read Schema Files

Use the Read tool to read schema files from the detected paths:

```bash
# For each schema file in schemas object
Read <schema-file-path>
```

This gives you the GraphQL schema definition including:
- Types (objects, interfaces, unions, enums)
- Fields with their types and arguments
- Directives
- Descriptions

### 4. Parse User Intent

Parse `$ARGUMENTS` to understand what the user wants to query. If unclear or empty, use AskUserQuestion:

**Question:** "What would you like to query?"

**Examples:**
- "Get a user by ID"
- "List all projects with their tasks"
- "Create a new task"
- "Update employee details"

### 5. Determine Element Type

Based on the user's intent, determine whether to create:

1. **Fragment** — Reusable field selection for a specific type
2. **Query operation** — Fetch data query
3. **Mutation operation** — Modify data mutation
4. **Subscription operation** — Real-time data subscription

If uncertain, use AskUserQuestion to clarify.

### 6. Apply Syntax Decision Tree

**CRITICAL: Use this decision tree to choose between tagged template and callback builder syntax.**

#### Fragment Definition

```
Does it need field aliases?
├─ YES → Callback builder required
└─ NO → Tagged template ✓
```

**Tagged template fragment:**
```typescript
const userFields = fragment('User')`
  id
  name
  email
`;
```

**Callback builder fragment (with aliases):**
```typescript
const userFields = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({
      ...f.id(null, { alias: "userId" }),
      ...f.name(null, { alias: "displayName" }),
    }),
  }),
);
```

#### Operation Definition

```
Does it have fragment spreads?
├─ YES → Callback builder required (.spread() method)
└─ NO → Continue below

Does it need any of: aliases, $colocate, metadata callbacks?
├─ YES → Callback builder required
└─ NO → Tagged template ✓
```

**Tagged template operation (simple):**
```typescript
const getUserQuery = query`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;
```

**Callback builder operation (with fragment spreads):**
```typescript
const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(() => ({
        ...userFields.spread({}),
      })),
    }),
  }),
);
```

#### Fragment Spreading Patterns

**Fragment → Fragment spreading:**
```typescript
// ✅ Tagged template interpolation works
const extendedFields = fragment('User')`
  ${userBasicFields}
  createdAt
  updatedAt
`;
```

**Operation → Fragment spreading:**
```typescript
// ❌ Tagged template interpolation does NOT work
// ✅ Callback builder .spread() required
const query = gql.default(({ query }) =>
  query.operation({
    fields: () => ({
      ...userFields.spread({}),
    }),
  }),
);
```

### 7. Variable Declaration Pattern

**"Fragments declare requirements; operations declare contract"**

- Fragments CAN declare variables they need
- Operations MUST explicitly declare ALL variables (no auto-merge from fragments)
- When spreading a fragment, the operation must declare all fragment variables

**Fragment with variables:**
```typescript
const userConditional = fragment('User', { includeEmail: 'Boolean!' })`
  id
  name
  email @include(if: $includeEmail)
`;
```

**Operation spreading fragment (callback builder):**
```typescript
const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: {
      ...$var("id").ID("!"),
      // MUST explicitly declare fragment's variables
      ...$var("includeEmail").Boolean("!"),
    },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(() => ({
        // Pass variables explicitly to fragment
        ...userConditional.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  }),
);
```

### 8. Code Generation Templates

Use these templates based on the decision tree outcome:

#### Template 1: Tagged Template Fragment

```typescript
import { fragment } from './graphql/generated/runtime';

export const <name>Fragment = fragment('<TypeName>')`
  <field1>
  <field2>
  <nestedField> {
    <subField1>
  }
`;
```

#### Template 2: Tagged Template Fragment with Variables

```typescript
import { fragment } from './graphql/generated/runtime';

export const <name>Fragment = fragment('<TypeName>', { <var1>: '<Type1>!', <var2>: '<Type2>' })`
  <field1>
  <field2> @include(if: $<var1>)
  <field3> @skip(if: $<var2>)
`;
```

#### Template 3: Fragment → Fragment Spread (Tagged Template)

```typescript
import { fragment } from './graphql/generated/runtime';
import { <baseFragment> } from './<baseFragmentFile>';

export const <name>Fragment = fragment('<TypeName>')`
  ${<baseFragment>}
  <additionalField1>
  <additionalField2>
`;
```

#### Template 4: Tagged Template Operation (No Spreads)

```typescript
import { query } from './graphql/generated/runtime';

export const <name>Query = query`
  query <OperationName>($<var1>: <Type1>!, $<var2>: <Type2>) {
    <rootField>(<arg1>: $<var1>, <arg2>: $<var2>) {
      <field1>
      <field2>
      <nestedField> {
        <subField1>
      }
    }
  }
`;
```

#### Template 5: Callback Builder Operation with Fragment Spreads

```typescript
import { gql } from './graphql/generated/runtime';
import { <fragment1>, <fragment2> } from './<fragmentFile>';

export const <name>Query = gql.default(({ query, $var }) =>
  query.operation({
    name: "<OperationName>",
    variables: {
      ...$var("<var1>").<Type1>("!"),
      ...$var("<var2>").<Type2>("?"),
      // Include ALL fragment variables
      ...$var("<fragmentVar1>").<FragmentVarType1>("!"),
    },
    fields: ({ f, $ }) => ({
      ...f.<rootField>({ <arg1>: $.<var1> })(() => ({
        // Spread fragments with explicit variable passing
        ...<fragment1>.spread({ <fragmentVar1>: $.<fragmentVar1> }),
        // Additional fields
        ...f.<field1>(),
        ...f.<nestedField>()(() => ({
          ...f.<subField1>(),
        })),
      })),
    }),
  }),
);
```

#### Template 6: Callback Builder Operation with Multiple Fragment Spreads

```typescript
import { gql } from './graphql/generated/runtime';
import { <fragment1>, <fragment2> } from './<fragmentFile>';

export const <name>Query = gql.default(({ query, $var }) =>
  query.operation({
    name: "<OperationName>",
    variables: {
      ...$var("<var1>").<Type1>("!"),
      // All variables from ALL fragments
      ...$var("<frag1Var>").<Frag1VarType>("?"),
      ...$var("<frag2Var>").<Frag2VarType>("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.<rootField>({ <arg>: $.<var1> })(() => ({
        ...<fragment1>.spread({ <frag1Var>: $.<frag1Var> }),
        ...<fragment2>.spread({ <frag2Var>: $.<frag2Var> }),
      })),
    }),
  }),
);
```

#### Template 7: Mutation Operation (Tagged Template)

```typescript
import { mutation } from './graphql/generated/runtime';

export const <name>Mutation = mutation`
  mutation <OperationName>($<inputVar>: <InputType>!) {
    <mutationField>(input: $<inputVar>) {
      <resultField1>
      <resultField2>
    }
  }
`;
```

#### Template 8: Callback Builder Mutation with Fragment Spread

```typescript
import { gql } from './graphql/generated/runtime';
import { <resultFragment> } from './<fragmentFile>';

export const <name>Mutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "<OperationName>",
    variables: { ...$var("<inputVar>").<InputType>("!") },
    fields: ({ f, $ }) => ({
      ...f.<mutationField>({ input: $.<inputVar> })(() => ({
        ...f.success(),
        ...f.<resultObject>()(() => ({
          ...<resultFragment>.spread({}),
        })),
      })),
    }),
  }),
);
```

### 9. Generate Import Statements

Based on the chosen syntax:

**Tagged template imports:**
```typescript
import { fragment } from './graphql/generated/runtime';
// or
import { query } from './graphql/generated/runtime';
// or
import { mutation } from './graphql/generated/runtime';
```

**Callback builder imports:**
```typescript
import { gql } from './graphql/generated/runtime';
```

**Fragment imports (when spreading):**
```typescript
import { fragmentName } from './fragments';
// or
import { frag1, frag2 } from './fragments';
```

### 10. Determine File Location

Use AskUserQuestion to determine where to write the generated code:

**Question:** "Where should I create the generated code?"

**Options:**
- "Create new file" → Ask for filename (default: based on operation name)
- "Append to existing fragments file" → Use Glob to find `**/fragments.{ts,tsx}`
- "Append to existing operations file" → Use Glob to find `**/operations.{ts,tsx}`

### 11. Write Generated Code

Use the Write tool to create or append the generated code:

```typescript
// If creating new file
Write <file-path> <generated-code>

// If appending to existing file
// 1. Read existing file
// 2. Append generated code
// 3. Write updated content
```

### 12. Validate Generated Code

Run validation to ensure the generated code is correct:

**Step 1: Run typegen**
```bash
bun run soda-gql typegen
```

**Expected output:**
- Success: "✓ Type generation complete" (or no output)
- Errors: Field errors, type mismatches, syntax errors

**Step 2: Run typecheck**
```bash
bun typecheck
```

**Expected output:**
- Success: No type errors (or only pre-existing errors)
- Errors: Type errors in generated code

### 13. Handle Validation Errors

If validation fails, analyze the error and fix the code:

#### Common Errors:

**Error: Field does not exist on type**
```
Error: Field 'fieldName' does not exist on type 'TypeName'
```

**Analysis:**
- Field name typo or field doesn't exist in schema
- Check schema for correct field name

**Fix:**
1. Read schema file again
2. Find correct field name
3. Update generated code
4. Retry validation (count attempt)

**Error: Unknown type referenced**
```
Error: Unknown type 'TypeName'
```

**Analysis:**
- Type name typo or type doesn't exist in schema
- Check schema for correct type name

**Fix:**
1. Read schema file to find correct type name
2. Update generated code
3. Retry validation (count attempt)

**Error: Missing required variable**
```
TypeError: Variable 'varName' is not defined in operation
```

**Analysis:**
- Fragment variable not declared in operation
- Operation must declare ALL variables

**Fix:**
1. Identify all fragment variables
2. Add missing variable declarations to operation
3. Retry validation (count attempt)

**Error: Invalid fragment spread**
```
Error: Fragment spread target type mismatch
```

**Analysis:**
- Fragment defined for one type, spread on different type
- Check fragment type vs spread location type

**Fix:**
1. Verify fragment type matches field type
2. Update fragment type or field selection
3. Retry validation (count attempt)

### 14. Retry Logic

Track validation attempts:
- **Max retries:** 3 attempts total
- **On success:** Report success and show generated code path
- **On failure after 3 retries:** Report failure with error details and suggest manual fix

### 15. Report Results

**On Success (after validation passes):**
```markdown
✅ GraphQL code generated successfully!

Generated files:
- <file-path> — <Fragment/Operation name>

Summary:
- Type: <Fragment/Query/Mutation>
- Syntax: <Tagged Template/Callback Builder>
- Lines added: <N>

Next steps:
- Import and use the generated code in your components
- Run `gql:doctor` to verify overall project health
- Use `gql:guide` for help with advanced patterns
```

**On Failure (after 3 retries):**
```markdown
❌ Code generation failed after 3 validation attempts.

Last error:
<error message>

Generated code location:
- <file-path> (may contain errors)

Suggested fixes:
<specific fix suggestions based on error type>

Manual steps:
1. Review the generated code at <file-path>
2. Check the schema file for correct types and fields
3. Use `gql:guide` for syntax help
4. Run `bun run soda-gql typegen` to see detailed errors
```

## Decision Tree Reference

**Quick reference for syntax selection:**

| Feature Needed | Syntax Required |
|----------------|----------------|
| Simple field selection | Tagged template ✓ |
| Field aliases | Callback builder |
| Fragment → Fragment spread | Tagged template (with `${...}`) |
| Operation → Fragment spread | Callback builder (with `.spread()`) |
| Variables in directives | Both (fragment must declare vars) |
| Metadata callbacks | Callback builder (advanced) |
| $colocate pattern | Callback builder |
| Union member selection (`$on`) | Callback builder |

**Key Principle:**
- Fragments declare requirements (can have variables)
- Operations declare contract (must declare ALL variables, including fragment vars)
- No auto-merge of variables from fragments

## Advanced Features

### Union Type Handling

When generating code for union types, use callback builder with `$on`:

```typescript
const searchQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "Search",
    variables: { ...$var("term").String("!") },
    fields: ({ f, $ }) => ({
      ...f.search({ term: $.term })(() => ({
        ...f.__typename(),
        // Use $on for union member selection
        ...$on("User", ({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
        ...$on("Post", ({ f }) => ({
          ...f.id(),
          ...f.title(),
        })),
      })),
    }),
  }),
);
```

**Note:** Union handling requires callback builder syntax. Always include `__typename` for type discrimination.

### Metadata and Colocation

For component colocation patterns:

```typescript
const componentFragment = gql.default(({ fragment }) =>
  fragment.User({
    metadata: { component: "UserCard" },
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);
```

**Note:** Metadata callbacks and $colocate require callback builder syntax.

## Validation Checklist

Before completing this skill, ensure:
- ✅ Project was detected successfully
- ✅ Schema files were read and analyzed
- ✅ User intent was clarified (fragment vs operation, what to query)
- ✅ Syntax decision tree was applied correctly
- ✅ Variable declaration pattern followed ("operations declare ALL variables")
- ✅ Code was generated using appropriate template
- ✅ Code was written to correct file location
- ✅ Validation passed (typegen + typecheck) OR 3 retries exhausted
- ✅ User received clear summary of results

## Example Workflows

### Example 1: Generate Simple Fragment

**User:** "Create a fragment for User with id, name, email"

**Process:**
1. Detect project → found
2. Read schema → User type has id, name, email fields
3. Apply decision tree → No aliases needed → Tagged template
4. Generate code using Template 1
5. Write to fragments.ts
6. Validate → Success
7. Report success

**Generated code:**
```typescript
export const userBasicFragment = fragment('User')`
  id
  name
  email
`;
```

### Example 2: Generate Query with Fragment Spread

**User:** "Create a query to get a user by ID using the userBasic fragment"

**Process:**
1. Detect project → found
2. Read schema → user(id: ID!) field on Query
3. Apply decision tree → Has fragment spread → Callback builder required
4. Generate code using Template 5
5. Write to operations.ts
6. Validate → Success
7. Report success

**Generated code:**
```typescript
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(() => ({
        ...userBasicFragment.spread({}),
      })),
    }),
  }),
);
```

### Example 3: Generate Mutation

**User:** "Create a mutation to update a task's title and completion status"

**Process:**
1. Detect project → found
2. Read schema → updateTask(id: ID!, input: UpdateTaskInput!) mutation
3. Apply decision tree → No fragment spreads → Tagged template
4. Generate code using Template 7
5. Write to operations.ts
6. Validate → Success
7. Report success

**Generated code:**
```typescript
export const updateTaskMutation = mutation`
  mutation UpdateTask($taskId: ID!, $title: String, $completed: Boolean) {
    updateTask(id: $taskId, input: { title: $title, completed: $completed }) {
      id
      title
      completed
    }
  }
`;
```
