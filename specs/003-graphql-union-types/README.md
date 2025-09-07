# GraphQL Union Types Specification

## Overview

This specification defines how GraphQL union types are handled in the zero-runtime GraphQL query generation system.

## Key Concepts

### `__typename` Field

In GraphQL, union types use the `__typename` field for type discrimination. This is a standard GraphQL feature that allows clients to determine which concrete type a union member is at runtime.

```graphql
union SearchResult = User | Post | Comment

type User {
  id: ID!
  name: String!
}

type Post {
  id: ID!
  title: String!
}

type Comment {
  id: ID!
  content: String!
}
```

When querying a union type, the `__typename` field must be included:

```graphql
query {
  search(query: "test") {
    __typename
    ... on User {
      id
      name
    }
    ... on Post {
      id
      title
    }
    ... on Comment {
      id
      content
    }
  }
}
```

## TypeScript Representation

Union types in TypeScript should use `__typename` as the discriminator field:

```typescript
type SearchResult =
  | { __typename: "User"; id: string; name: string }
  | { __typename: "Post"; id: string; title: string }
  | { __typename: "Comment"; id: string; content: string };
```

## Field Selection for Union Types

When selecting fields from a union type, the `__typename` field is **required**:

```typescript
const selection: FieldSelection<SearchResult> = {
  __typename: true, // Required for type discrimination
  id: true,        // Common field across all union members
  name: true,      // User-specific field
  title: true,     // Post-specific field
  content: true,   // Comment-specific field
};
```

## Implementation Notes

### RemoteModel and Union Types

- **RemoteModel**: Defined for concrete types, not union types
- Users don't directly specify `__typename` in RemoteModel definitions
- The system automatically handles `__typename` for union types

### QuerySlice and Union Types

QuerySlice definitions must handle union types correctly:

1. Always include `__typename` in the selection when dealing with union types
2. Transform functions should use `__typename` for type narrowing
3. The selection builder must support conditional selections based on type

Example:

```typescript
const searchSlice: QuerySlice<SearchResult[], { query: string }> = {
  // ...
  selections: (builder, args) => ({
    search: builder.unionType("SearchResult", {
      __typename: true,
      // Conditional selections based on type
      "User": { id: true, name: true },
      "Post": { id: true, title: true },
      "Comment": { id: true, content: true },
    }),
  }),
  transform: (data) => {
    return data.search.map(item => {
      switch (item.__typename) {
        case "User":
          return { type: "user", ...item };
        case "Post":
          return { type: "post", ...item };
        case "Comment":
          return { type: "comment", ...item };
      }
    });
  },
};
```

## Future Considerations

### Inline Fragments

Support for GraphQL inline fragments in the selection builder:

```typescript
builder.inlineFragment("User", {
  id: true,
  name: true,
  email: true,
})
```

### Interface Types

Similar handling for GraphQL interface types, which also use `__typename`:

```typescript
interface Node {
  __typename: string;
  id: string;
}

type User implements Node {
  __typename: "User";
  id: string;
  name: string;
}
```

### Type Generation

Future build-time tooling should:
1. Automatically add `__typename` to union type selections
2. Generate proper TypeScript discriminated unions from GraphQL schema
3. Validate that all union members are covered in selections

## Testing Requirements

1. Unit tests must verify `__typename` is included in union type selections
2. Integration tests should verify correct GraphQL query generation
3. Type tests should ensure TypeScript discriminated unions work correctly

## Migration Path

Existing code using custom discriminator fields (e.g., `type`) should migrate to `__typename`:

```typescript
// Before
type Result = { type: "user"; ... } | { type: "post"; ... };

// After
type Result = { __typename: "User"; ... } | { __typename: "Post"; ... };
```

This aligns with GraphQL standards and ensures compatibility with GraphQL servers and tooling.