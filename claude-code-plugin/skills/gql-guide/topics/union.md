# Topic: Union

## Concept

Union types in GraphQL represent a value that could be one of several types. soda-gql handles union types using standard GraphQL inline fragment syntax in tagged templates. Always include `__typename` for type discrimination.

### Union Member Selection

Union handling uses `... on TypeName { fields }` syntax inline in tagged templates:

```typescript
const searchQuery = gql.default(({ query }) =>
  query("Search")`($term: String!) {
    search(term: $term) {
      __typename
      ... on User {
        id
        name
      }
      ... on Organization {
        id
        name
        members
      }
    }
  }`(),
);
```

## Code Examples

**Union field selection (tagged template):**
```typescript
const searchQuery = gql.default(({ query }) =>
  query("Search")`($term: String!) {
    search(term: $term) {
      __typename
      ... on User {
        id
        name
        email
      }
      ... on Post {
        id
        title
        content
      }
    }
  }`(),
);
```

**Union with fragment spreads (tagged template):**
```typescript
const userFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{ id name email }`(),
);
const postFields = gql.default(({ fragment }) =>
  fragment("PostFields", "Post")`{ id title content }`(),
);

const searchQuery = gql.default(({ query }) =>
  query("Search")`($term: String!) {
    search(term: $term) {
      __typename
      ... on User { ...${userFields} }
      ... on Post { ...${postFields} }
    }
  }`(),
);
```

**Union with inline fragment directive (tagged template):**
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

**Union with fragment spreads (callback builder — for $colocate):**
```typescript
const userFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{ id name email }`(),
);
const postFields = gql.default(({ fragment }) =>
  fragment("PostFields", "Post")`{ id title content }`(),
);

const searchQuery = gql.default(({ query }) =>
  query("Search")({
    variables: `($term: String!)`,
    fields: ({ f, $ }) => ({
      ...f("search", { term: $.term })(({ f }) => ({
        ...f("__typename")(),
        ...userFields.spread({ $colocate: true }),
        ...postFields.spread({ $colocate: true }),
      })),
    }),
  })({}),
);
```

## Common Patterns

✅ **Always include `__typename` for discriminated unions:**
```typescript
const q = gql.default(({ query }) =>
  query("Search")`($term: String!) {
    search(term: $term) {
      __typename
      ... on TypeA { id fieldA }
      ... on TypeB { id fieldB }
    }
  }`(),
);
```

✅ **Exhaustive member handling:**
```typescript
const q = gql.default(({ query }) =>
  query("SearchAll")`($term: String!) {
    search(term: $term) {
      __typename
      ... on User { id name }
      ... on Organization { id name }
      ... on Bot { id label }
    }
  }`(),
);
```

❌ **Missing `__typename` (unable to discriminate at runtime):**
```typescript
const q = gql.default(({ query }) =>
  query("Search")`($term: String!) {
    search(term: $term) {
      ... on User { id name }
      ... on Post { id title }
      // No __typename — cannot discriminate in application code
    }
  }`(),
);
```

## Related Topics

- **fragment** — Using fragments with union members
- **metadata** — Type-specific metadata callbacks
- **directive** — Inline fragment directives like @defer
