# Topic: Fragment

## Concept

Fragments define reusable field selections with type safety. They can be spread into operations or composed into other fragments. Tagged template syntax is the primary way to define fragments.

### Fragment Types

1. **Tagged template fragment** — Simple field selection, aliases, spreads, metadata
2. **Callback builder fragment** — For programmatic field control (rare)
3. **Fragment spreading** — Composing fragments together

### Variable Declaration Pattern

**"Fragments declare requirements; operations declare contract"**

- Fragments can declare variables they need in the GraphQL definition
- Operations must explicitly declare ALL variables, including fragment requirements
- No auto-merge: operation variables are the source of truth

## Code Examples

**Simple fragment:**
```typescript
const userBasic = gql.default(({ fragment }) =>
  fragment("UserBasic", "User")`{
    id
    name
    email
  }`(),
);
```

**Fragment with variables:**
```typescript
const userConditional = gql.default(({ fragment }) =>
  fragment("ConditionalUser", "User")`($includeEmail: Boolean!) {
    id
    name
    email @include(if: $includeEmail)
  }`(),
);
```

**Fragment spreading another fragment (tagged template):**
```typescript
const userExtended = gql.default(({ fragment }) =>
  fragment("ExtendedUser", "User")`{
    ...${userBasic}
    createdAt
    updatedAt
  }`(),
);
```

**Operation spreading fragment with variable binding (callback builder):**
```typescript
const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($id: ID!, $includeEmail: Boolean!)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...userConditional.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  })({}),
);
```

**Operation spreading fragment (tagged template — primary pattern):**
```typescript
const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      ...${userBasic}
    }
  }`(),
);
```

## Common Patterns

✅ **Fragment composition via tagged template:**
```typescript
const baseFields = gql.default(({ fragment }) =>
  fragment("UserBase", "User")`{ id name }`(),
);
const extendedFields = gql.default(({ fragment }) =>
  fragment("UserExtended", "User")`{
    ...${baseFields}
    email
  }`(),
);
```

✅ **Operation declares all variables:**
```typescript
const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($id: ID!, $includeEmail: Boolean!)`, // ALL variables, including fragment requirements
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...userConditional.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  })({}),
);
```

❌ **Auto-merge expectation (WRONG — operations must declare all variables):**
```typescript
// Fragment declares $includeEmail
const frag = gql.default(({ fragment }) =>
  fragment("F", "User")`($includeEmail: Boolean!) {
    id name email @include(if: $includeEmail)
  }`(),
);

// Operation does NOT auto-inherit variables — must declare includeEmail explicitly
const badQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($id: ID!)`, // Missing includeEmail!
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...frag.spread(), // Will fail — $includeEmail not in scope
      })),
    }),
  })({}),
);
```

## Related Topics

- **tagged-template** — Syntax for fragment definitions
- **operation** — How operations use fragments
- **metadata** — Fragment-level metadata callbacks
- **colocation** — Placing fragments near components
