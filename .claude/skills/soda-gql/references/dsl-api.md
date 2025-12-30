# DSL API Reference

Complete API documentation for soda-gql's Domain Specific Language.

## gql.default() Callback

All soda-gql definitions use the `gql.default()` pattern:

```typescript
import { gql } from "@/graphql-system";

export const element = gql.default((context) => {
  // Return a fragment or operation
});
```

### Callback Context

The callback receives a context object with the following properties:

| Property | Description |
|----------|-------------|
| `fragment` | Fragment builder for creating reusable field selections |
| `query` | Query operation builder |
| `mutation` | Mutation operation builder |
| `subscription` | Subscription operation builder |
| `$var` | Variable declaration helper |

## Fragment Builder

### fragment.TypeName(config)

Create a fragment for a specific GraphQL type:

```typescript
fragment.User({
  variables: { /* optional */ },
  fields: ({ f, $ }) => ({ /* field selections */ }),
})
```

**Config Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `variables` | `object` | No | Fragment variable declarations |
| `fields` | `function` | Yes | Field selection callback |

### Fields Callback

The `fields` callback receives:

| Property | Description |
|----------|-------------|
| `f` | Field selector for the type |
| `$` | Variable references |

## Operation Builder

### query/mutation/subscription.operation(config)

Create a complete GraphQL operation:

```typescript
query.operation({
  name: "GetUser",
  variables: { ...$var("id").ID("!") },
  metadata: ({ $ }) => ({ /* optional */ }),
  fields: ({ f, $ }) => ({ /* field selections */ }),
})
```

**Config Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Operation name |
| `variables` | `object` | No | Operation variable declarations |
| `metadata` | `function` | No | Metadata callback for headers/custom data |
| `fields` | `function` | Yes | Root field selection callback |

## Variable Declaration ($var)

### $var(name).Type(modifier)

Declare a variable with a specific type:

```typescript
$var("userId").ID("!")      // Required ID
$var("name").String("?")    // Optional String
$var("ids").ID("![]!")      // Required list of required IDs
```

**Type Methods:**

Built-in scalar types:
- `ID(modifier)`
- `String(modifier)`
- `Int(modifier)`
- `Float(modifier)`
- `Boolean(modifier)`

Custom scalars are available based on schema:
- `DateTime(modifier)`
- `JSON(modifier)`
- etc.

Input types:
- `MyInputType(modifier)`

**Modifiers:**

| Modifier | Meaning | GraphQL |
|----------|---------|---------|
| `"!"` | Required | `Type!` |
| `"?"` | Optional | `Type` |
| `"![]!"` | Required list, required items | `[Type!]!` |
| `"![]?"` | Optional list, required items | `[Type!]` |
| `"?[]!"` | Required list, optional items | `[Type]!` |
| `"?[]?"` | Optional list, optional items | `[Type]` |

## Field Selection

### Basic Field Selection

```typescript
fields: ({ f }) => ({
  ...f.id(),           // Select id field
  ...f.name(),         // Select name field
  ...f.email(),        // Select email field
})
```

### Field with Arguments

```typescript
fields: ({ f, $ }) => ({
  ...f.posts({ limit: 10, offset: 0 }),
  ...f.user({ id: $.userId }),
})
```

### Nested Field Selection (Curried)

For object/interface fields, use curried selection:

```typescript
fields: ({ f, $ }) => ({
  ...f.user({ id: $.userId })(({ f }) => ({
    ...f.id(),
    ...f.name(),
    ...f.posts()(({ f }) => ({
      ...f.id(),
      ...f.title(),
    })),
  })),
})
```

### Field Alias

```typescript
fields: ({ f }) => ({
  ...f.id(null, { alias: "uuid" }),
  ...f.name(null, { alias: "displayName" }),
})
```

### Conditional Field

Include a field conditionally based on a variable:

```typescript
fields: ({ f, $ }) => ({
  ...f.id(),
  ...f.email({ if: $.includeEmail }),
})
```

## Fragment Spreading

### fragment.spread(variableMappings)

Spread a fragment's fields into an operation or another fragment:

```typescript
// Define fragment
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("includeEmail").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email({ if: $.includeEmail }),
    }),
  }),
);

// Use in operation
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!"), ...$var("showEmail").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...userFragment.spread({ includeEmail: $.showEmail }),
      })),
    }),
  }),
);
```

**Variable Mapping:**

When spreading a fragment, map operation variables to fragment variables:

```typescript
...userFragment.spread({
  includeEmail: $.showEmail,  // Map $.showEmail to fragment's $.includeEmail
})
```

## Element Extensions

### element.attach(attachment)

Extend a gql element with custom properties:

```typescript
import type { GqlElementAttachment } from "@soda-gql/core";

const analytics: GqlElementAttachment<typeof userFragment, "analytics", { track: () => void }> = {
  name: "analytics",
  createValue: (element) => ({
    track: () => console.log("tracked"),
  }),
};

export const userFragment = gql
  .default(({ fragment }) =>
    fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) })
  )
  .attach(analytics);

// Usage
userFragment.analytics.track();
```

## Complete Example

```typescript
import { gql } from "@/graphql-system";

// Fragment with variables
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: {
      ...$var("includeEmail").Boolean("?"),
      ...$var("postLimit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email({ if: $.includeEmail }),
      ...f.posts({ limit: $.postLimit })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.createdAt(),
      })),
    }),
  }),
);

// Operation with spread fragment
export const getUsersQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUsers",
    variables: {
      ...$var("ids").ID("![]!"),
      ...$var("showEmail").Boolean("?"),
      ...$var("limit").Int("?"),
    },
    metadata: ({ $ }) => ({
      headers: { "X-Request-ID": "get-users" },
      custom: { requiresAuth: true },
    }),
    fields: ({ f, $ }) => ({
      ...f.users({ ids: $.ids })(({ f }) => ({
        ...userFragment.spread({
          includeEmail: $.showEmail,
          postLimit: $.limit,
        }),
      })),
    }),
  }),
);
```
