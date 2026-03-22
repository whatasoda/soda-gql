# Topic: Tagged Template Syntax

## Concept

soda-gql uses tagged template syntax as the **default recommended approach** for writing GraphQL fragments and operations. Tagged templates support the full set of features: field aliases, directives, fragment spreads (both fragment→fragment and operation→fragment), and metadata callbacks.

Only `gql` is exported from the generated runtime:

```typescript
import { gql } from "<outdir-path>"; // e.g. "@/graphql-system"
```

### Basic syntax

```typescript
// Fragment
const userFragment = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    name
    email
  }`(),
);

// Operation
const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }`(),
);
```

## Code Examples

**Fragment with field alias (tagged template):**
```typescript
const userFragment = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    displayName: name
    contactEmail: email
  }`(),
);
```

**Fragment spreading another fragment (tagged template):**
```typescript
const extendedFields = gql.default(({ fragment }) =>
  fragment("ExtendedUser", "User")`{
    ...${userFragment}
    createdAt
    updatedAt
  }`(),
);
```

**Operation with fragment spread (tagged template — primary pattern):**
```typescript
const userQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      ...${userFragment}
    }
  }`(),
);
```

**Variable-bound spread with callback interpolation:**
```typescript
const userQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!, $includeEmail: Boolean!) {
    user(id: $id) {
      ...${({ $ }) => conditionalFrag.spread({ includeEmail: $.includeEmail })}
    }
  }`(),
);
```

**Static metadata on a fragment (tagged template):**
```typescript
const userFragment = gql.default(({ fragment }) =>
  fragment("UserCard", "User")`{
    id
    name
  }`({
    metadata: { component: "UserCard" },
  }),
);
```

**Callback metadata on a fragment (tagged template):**
```typescript
const userFragment = gql.default(({ fragment }) =>
  fragment("CachedUser", "User")`($userId: ID!) {
    id
    name
  }`({
    metadata: ({ $ }: { $: { userId: string } }) => ({
      cacheKey: `user:${$.userId}`,
    }),
  }),
);
```

## When to Use Options-Object Path

The options-object (callback builder) path is needed only for:
- **`$colocate`** — fragment colocation directive (must be in spread options)
- **Programmatic field control** — dynamically constructing field lists at build time

Everything else — aliases, fragment spreads, metadata, directives — works in tagged templates.

```typescript
// Options-object path: needed for $colocate
const userQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($id: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...userFragment.spread({ $colocate: true }),
      })),
    }),
  })({}),
);
```

## Key Constraint

**Tagged templates only accept Fragment instances and callback functions as interpolations:**
- `...${fragment}` — Fragment spreading in fragments and operations
- `...${({ $ }) => fragment.spread({ key: $.var })}` — Callback-form spreading with variable binding
- `${stringValue}` — Throws error (raw values not allowed)
- `query.compat("Name")\`${anything}\`` — Compat rejects all interpolation

## Common Patterns

✅ **Simple fragment definition:**
```typescript
const fields = gql.default(({ fragment }) =>
  fragment("UserBasic", "User")`{
    id
    name
    email
  }`(),
);
```

✅ **Fragment spreading another fragment:**
```typescript
const extendedFields = gql.default(({ fragment }) =>
  fragment("ExtendedUser", "User")`{
    ...${userFields}
    createdAt
    updatedAt
  }`(),
);
```

✅ **Operation with fragment spread (tagged template):**
```typescript
const goodQuery = gql.default(({ query }) =>
  query("GetUser")`{
    user(id: "1") {
      ...${userFields}
    }
  }`(),
);
```

❌ **Fragment spread without `...` prefix (runtime error):**
```typescript
const badQuery = gql.default(({ query }) =>
  query("BadQuery")`{
    user {
      ${userFields}
    }
  }`(),
);
```

❌ **Raw string interpolation (runtime error):**
```typescript
const fieldName = "email";
const bad = gql.default(({ fragment }) =>
  fragment("Bad", "User")`{ id ${fieldName} }`(), // throws
);
```

## Related Topics

- **fragment** — Fragment definitions and composition patterns
- **operation** — Operation structure and variable handling
- **metadata** — Metadata on fragments and operations
- **colocation** — The one case where options-object path is required ($colocate)
