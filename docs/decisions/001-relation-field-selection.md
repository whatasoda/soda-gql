# ADR-001: Explicit Relation Marking with __relation__

## Status
Accepted

## Context
In GraphQL type systems, we need to distinguish between:
1. Regular nested objects (e.g., embedded JSON data)
2. Relations to other GraphQL types (e.g., User -> Posts)

Initially, we attempted to infer relations by checking if a field's type extends `object`. However, this approach proved insufficient because:
- Not all objects are relations (e.g., metadata objects, embedded JSON)
- Arrays of primitives vs arrays of relations need different handling
- Nested objects within relations need special treatment

## Decision
We will use a special `__relation__` property to explicitly mark relation fields in generated types.

### Type Structure
```typescript
type User = {
  // Regular scalar fields
  id: string;
  name: string;
  
  // Regular nested object (NOT a relation)
  profile: {
    bio: string;
    avatar: string;
  };
  
  // Relations are explicitly defined here
  __relation__: {
    posts: Post[];        // Array relation
    company: Company;     // Single relation
    manager: User;        // Self-reference
  };
};
```

### Field Selection Behavior
```typescript
const selection: FieldSelection<User> = {
  id: true,                    // Scalar: boolean
  profile: true,                // Object: boolean only (not a relation)
  posts: {                      // Relation: nested selection
    id: true,
    title: true,
  },
  company: {                    // Relation: nested selection
    name: true,
  },
};
```

## Consequences

### Positive
- **Explicit control**: No ambiguity about what constitutes a relation
- **Type safety**: TypeScript can properly distinguish selection patterns
- **Code generation friendly**: Generated types can easily include `__relation__`
- **Nested support**: `__relation__` can be nested within relation types
- **Array handling**: Same selection syntax for `T` and `T[]`

### Negative
- **Special syntax**: Developers must understand the `__relation__` convention
- **Generated types only**: Hand-written types must follow this pattern
- **Migration effort**: Existing types need to be updated

### Neutral
- The `__relation__` property is never present at runtime
- It's purely a type-level construct for selection building

## Implementation Details

### Type Helpers
```typescript
// Extract relations from a type
type ExtractRelations<T> = T extends { __relation__: infer R } ? R : {};

// Extract non-relation fields
type ExtractNonRelations<T> = Omit<T, "__relation__">;

// Unwrap arrays for selection
type UnwrapArray<T> = T extends Array<infer U> ? U : T;
```

### Nested Relations
Relations can have their own `__relation__` properties:
```typescript
type Post = {
  id: string;
  __relation__: {
    author: {
      id: string;
      name: string;
      __relation__: {
        profile: Profile;  // Nested relation
      };
    };
  };
};
```

## References
- GraphQL specification on object types and fields
- TypeScript 5.x conditional types documentation
- Implementation: `packages/core/src/types/field-selection.ts`