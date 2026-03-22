# Topic: Directive

## Concept

GraphQL directives modify field behavior (`@include`, `@skip`) or provide metadata for tools. soda-gql supports standard and custom directives in tagged template syntax.

### Directive Types

1. **Standard directives:** `@include(if: Boolean)`, `@skip(if: Boolean)`
2. **Custom directives:** Defined in schema, used for metadata or tooling
3. **Inline fragment directives:** `... on Type @defer { ... }`

### Directive Syntax in Tagged Templates

**With static values:**
```typescript
gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    name
    email @include(if: true)
  }`(),
);
```

**With GraphQL variables (use `$varName` syntax in template string):**
```typescript
gql.default(({ fragment }) =>
  fragment("ConditionalUser", "User")`($includeEmail: Boolean!) {
    id
    name
    email @include(if: $includeEmail)
  }`(),
);
```

## Code Examples

**@include directive:**
```typescript
const conditionalFields = gql.default(({ fragment }) =>
  fragment("ConditionalUser", "User")`($showEmail: Boolean!) {
    id
    name
    email @include(if: $showEmail)
  }`(),
);
```

**@skip directive:**
```typescript
const fields = gql.default(({ fragment }) =>
  fragment("SkipEmail", "User")`($hideEmail: Boolean!) {
    id
    name
    email @skip(if: $hideEmail)
  }`(),
);
```

**Custom directive:**
```typescript
// Assuming schema has: directive @sensitive on FIELD_DEFINITION
const userFields = gql.default(({ fragment }) =>
  fragment("SensitiveUser", "User")`{
    id
    name
    socialSecurityNumber @sensitive
  }`(),
);
```

**Inline fragment directive:**
```typescript
const searchQuery = gql.default(({ query }) =>
  query("Search")`($term: String!) {
    search(term: $term) {
      __typename
      ... on User @defer {
        id
        name
      }
    }
  }`(),
);
```

**Conditional field inclusion with operation spread:**
```typescript
const detailsFragment = gql.default(({ fragment }) =>
  fragment("UserDetails", "User")`($includeDetails: Boolean!) {
    bio @include(if: $includeDetails)
    website @include(if: $includeDetails)
  }`(),
);

const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!, $includeDetails: Boolean!) {
    user(id: $id) {
      id
      name
      ...${detailsFragment}
    }
  }`(),
);
```

## Common Patterns

✅ **Variable-driven conditional field:**
```typescript
gql.default(({ fragment }) =>
  fragment("UserDetails", "User")`($includeDetails: Boolean!) {
    bio @include(if: $includeDetails)
    website @include(if: $includeDetails)
  }`(),
);
```

✅ **Custom schema directive for tooling:**
```typescript
gql.default(({ fragment }) =>
  fragment("SensitiveUser", "User")`{
    id
    name
    ssn @sensitive
  }`(),
);
```

❌ **Using JavaScript variable in template (raw interpolation — throws):**
```typescript
const showEmail = true;
gql.default(({ fragment }) =>
  fragment("Bad", "User")`{
    email @include(if: ${showEmail})  // throws — use $varName syntax instead
  }`(),
);
```

## Related Topics

- **fragment** — Directives in fragment definitions
- **operation** — Directives in operation fields
- **union** — Inline fragment directives like @defer
- **tagged-template** — Interpolation rules and constraints
