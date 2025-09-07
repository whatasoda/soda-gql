# ADR-003: GraphQL Union Type Handling with __typename

## Status
Accepted

## Context
GraphQL uses the `__typename` field as a standard mechanism for type discrimination in union types and interfaces. Our initial implementation used a custom `type` field, but this doesn't align with GraphQL standards and would require additional mapping logic.

Union types in GraphQL require clients to specify which fields to select from each possible type. The `__typename` field is automatically available and is used to determine which concrete type is returned at runtime.

## Decision
We will use GraphQL's standard `__typename` field for union type discrimination in our TypeScript types and field selection system.

Key changes:
1. TypeScript union types use `__typename` as the discriminator field
2. Field selection for union types requires `__typename: true`
3. QuerySlice and future query builders will handle union types with conditional selections
4. RemoteModel remains for concrete types only; union handling happens at query composition level

## Consequences

### Positive
- **Standards compliance**: Aligns with GraphQL specification
- **Tooling compatibility**: Works with existing GraphQL tools and servers
- **Type safety**: TypeScript discriminated unions work naturally with `__typename`
- **No mapping required**: Direct correspondence between GraphQL and TypeScript types

### Negative
- **Breaking change**: Existing code using custom discriminators must migrate
- **Required field**: `__typename` must always be selected for union types
- **Complexity**: Union type handling adds complexity to the selection system

### Neutral
- Users defining RemoteModels for concrete types don't need to specify `__typename`
- The build-time transformation can automatically inject `__typename` where needed
- Query composition tools (QuerySlice, PageQuery) handle union complexity

## Implementation Notes

Example TypeScript union type:
```typescript
type SearchResult =
  | { __typename: "User"; id: string; name: string }
  | { __typename: "Post"; id: string; title: string }
  | { __typename: "Comment"; id: string; content: string };
```

Example field selection:
```typescript
const selection: FieldSelection<SearchResult> = {
  __typename: true, // Required
  id: true,
  name: true,
  title: true,
  content: true,
};
```

## References
- [GraphQL Specification - Union Types](https://spec.graphql.org/June2018/#sec-Unions)
- [GraphQL __typename field](https://graphql.org/learn/schema/#union-types)
- specs/003-graphql-union-types/README.md