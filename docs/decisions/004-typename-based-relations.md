# ADR-004: TypeName-Based Relation Detection

## Status
Accepted

## Context
With the enforcement of `__typename` in all GraphQL types (ADR-003), we can now identify relations without needing a separate `__relation__` property. Any type that has `__typename` is a GraphQL type and can be traversed as a relation, while types without `__typename` are plain objects that can only be selected with boolean values.

This simplifies the type system and aligns better with GraphQL's native type system where all types have `__typename` available.

## Decision
We will use the presence of `__typename` in a type to determine if it's a relation that supports nested field selection.

Key changes:
1. Remove `__relation__` property from type definitions
2. Use `__typename` presence to identify traversable relations
3. Types with `__typename` support nested FieldSelection
4. Types without `__typename` can only be selected with boolean

## Consequences

### Positive
- **Simpler type definitions**: No need for separate `__relation__` property
- **Automatic relation detection**: Any GraphQL type is automatically a relation
- **Better GraphQL alignment**: Uses native GraphQL type discrimination
- **Less boilerplate**: Cleaner type definitions without wrapper objects

### Negative
- **Breaking change**: Existing code using `__relation__` must be updated
- **Implicit behavior**: Relation detection is implicit based on `__typename`
- **All GraphQL types are relations**: Cannot have a GraphQL type that isn't traversable

### Neutral
- Regular objects (configs, metadata) remain as non-relations
- Array handling remains the same - arrays are unwrapped for selection
- Field selection API remains consistent

## Implementation Notes

Before (with `__relation__`):
```typescript
type Post = {
  __typename: "Post";
  id: string;
  title: string;
  metadata: {
    views: number;
    likes: number;
  };
  __relation__: {
    author: Author;
    comments: Comment[];
  };
};
```

After (using `__typename` detection):
```typescript
type Post = {
  __typename: "Post";
  id: string;
  title: string;
  metadata: {        // No __typename = plain object
    views: number;
    likes: number;
  };
  author: Author;     // Has __typename = relation
  comments: Comment[]; // Has __typename = relation array
};
```

Field selection:
```typescript
const selection: FieldSelection<Post> = {
  __typename__: "Post",
  id: true,
  metadata: true,      // Plain object - boolean only
  author: {            // Relation - nested selection
    __typename__: "Author",
    id: true,
    name: true,
  },
  comments: {          // Relation array - selection for elements
    __typename__: "Comment",
    id: true,
    text: true,
  },
};
```

## Supersedes
- [ADR-001: Relation Field Selection](001-relation-field-selection.md) - Replaced by typename-based detection

## References
- [ADR-003: GraphQL Union Types](003-graphql-union-types.md) - Established `__typename` requirement
- GraphQL specification on `__typename` field