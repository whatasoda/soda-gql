# Scalars and Inject Module

Guide to defining custom scalar types and configuring the inject module.

## What is the Inject Module?

The inject module bridges GraphQL schema scalars with TypeScript types. It's a hand-written file that:

- Defines TypeScript types for each GraphQL scalar
- Maps input types (variables) to output types (results)
- Remains under version control for explicit type behavior

## Creating the Inject Module

### Scaffold Template

Generate a starter inject file:

```bash
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

This creates a template with built-in scalars:

```typescript
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;
```

## defineScalar API

### Generic Syntax

```typescript
defineScalar<Name, InputType, OutputType>(name)
```

| Parameter | Description |
|-----------|-------------|
| `Name` | GraphQL scalar name (string literal type) |
| `InputType` | TypeScript type for variables (what you pass in) |
| `OutputType` | TypeScript type for results (what you get back) |
| `name` | Runtime scalar name (must match GraphQL schema) |

### Examples

**Basic scalars (same input/output):**

```typescript
...defineScalar<"ID", string, string>("ID"),
...defineScalar<"String", string, string>("String"),
...defineScalar<"Int", number, number>("Int"),
```

**Custom scalars with type transformation:**

```typescript
// DateTime: Send as ISO string, receive as Date object
...defineScalar<"DateTime", string, Date>("DateTime"),

// JSON: Generic object type
...defineScalar<"JSON", Record<string, unknown>, Record<string, unknown>>("JSON"),

// BigInt: Send as string, receive as bigint
...defineScalar<"BigInt", string, bigint>("BigInt"),

// URL: Send as string, receive as URL object
...defineScalar<"URL", string, URL>("URL"),
```

### Callback Syntax

Alternative syntax with more control:

```typescript
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),
    output: type<Date>(),
    directives: {},
  })),

  ...defineScalar("Money", ({ type }) => ({
    input: type<number>(),
    output: type<{ amount: number; currency: string }>(),
    directives: {},
  })),
} as const;
```

## Common Custom Scalar Patterns

### DateTime

```typescript
// ISO string input, Date object output
...defineScalar<"DateTime", string, Date>("DateTime"),
```

Usage:
```typescript
// Variable type: string
const query = gql.default(({ query, $var }) =>
  query.operation({
    variables: { ...$var("after").DateTime("!") },
    // ...
  })
);

// Result type: Date
type Result = typeof query.$infer.output.projected;
// { createdAt: Date }
```

### JSON

```typescript
// Generic object/array type
...defineScalar<"JSON", unknown, unknown>("JSON"),

// Or with stricter typing
...defineScalar<"JSON", Record<string, unknown>, Record<string, unknown>>("JSON"),

// Or with JsonValue type
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
...defineScalar<"JSON", JsonValue, JsonValue>("JSON"),
```

### UUID

```typescript
// String format for UUIDs
...defineScalar<"UUID", string, string>("UUID"),

// Or with branded type for type safety
type UUID = string & { readonly __brand: "UUID" };
...defineScalar<"UUID", string, UUID>("UUID"),
```

### Upload

```typescript
// For file upload scalars (GraphQL multipart)
...defineScalar<"Upload", File, never>("Upload"),
```

### Void

```typescript
// For mutations that return nothing
...defineScalar<"Void", never, null>("Void"),
```

## Complete Inject Module Example

```typescript
import { defineScalar } from "@soda-gql/core";

// Custom types
type UUID = string & { readonly __brand: "UUID" };
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const scalar = {
  // Built-in scalars
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),

  // Date/Time
  ...defineScalar<"DateTime", string, Date>("DateTime"),
  ...defineScalar<"Date", string, Date>("Date"),
  ...defineScalar<"Time", string, string>("Time"),
  ...defineScalar<"Timestamp", number, Date>("Timestamp"),

  // Identifiers
  ...defineScalar<"UUID", string, UUID>("UUID"),

  // Data
  ...defineScalar<"JSON", JsonValue, JsonValue>("JSON"),
  ...defineScalar<"JSONObject", Record<string, unknown>, Record<string, unknown>>("JSONObject"),

  // Network
  ...defineScalar<"URL", string, URL>("URL"),
  ...defineScalar<"Email", string, string>("Email"),

  // Numbers
  ...defineScalar<"BigInt", string, bigint>("BigInt"),
  ...defineScalar<"Decimal", string, number>("Decimal"),

  // Files
  ...defineScalar<"Upload", File, never>("Upload"),

  // Special
  ...defineScalar<"Void", never, null>("Void"),
} as const;
```

## Adapter Configuration

For advanced use cases, define an adapter alongside scalars:

```typescript
// default.inject.ts
import { defineScalar, defineAdapter } from "@soda-gql/core";

export const scalar = {
  // ... scalar definitions
} as const;

export const adapter = defineAdapter({
  helpers: {
    formatDate: (date: Date) => date.toISOString(),
  },
  metadata: {
    version: "1.0.0",
  },
});
```

Configure in `soda-gql.config.ts`:

```typescript
schemas: {
  default: {
    schema: "./schema.graphql",
    inject: {
      scalars: "./src/graphql-system/default.inject.ts",
      adapter: "./src/graphql-system/adapter.ts",
    },
  },
}
```

## Version Control

**Commit the inject file:**
- Contains intentional type mappings
- Changes should be reviewed
- Part of your API contract

**Do NOT commit generated files:**
- `index.ts` - Generated from schema
- `index.js`, `index.cjs` - Bundled output

Add to `.gitignore`:
```
src/graphql-system/index.ts
src/graphql-system/index.js
src/graphql-system/index.cjs
```
