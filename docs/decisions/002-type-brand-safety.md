# ADR-002: Runtime-Safe Type Brand Properties

## Status
Accepted

## Context
TypeScript interfaces often use "brand" properties for type inference and discrimination. In our GraphQL type system, we use brands like `_type`, `_data`, `_args` to help TypeScript infer generic parameters.

Initial implementation:
```typescript
interface RemoteModel<TType, TTransformed> {
  readonly _type: TType;
  readonly _transformed: TTransformed;
}
```

Problem: If these properties are accessed at runtime (even accidentally), they would throw errors because they don't actually exist.

## Decision
Replace direct type references with functions that return the type, making the properties runtime-safe while maintaining type inference.

### Implementation
```typescript
interface RemoteModel<TType, TTransformed> {
  readonly _type: () => TType;
  readonly _transformed: () => TTransformed;
}

// Helper function for creating brand properties
export const hiddenBrand = <T>(): (() => T) => () => {
  throw new Error('DO NOT CALL THIS FUNCTION -- property for type inference');
};

// Usage
const model: RemoteModel<User, NormalizedUser> = {
  _type: hiddenBrand(),
  _transformed: hiddenBrand(),
  // ... other properties
};
```

## Consequences

### Positive
- **Runtime safety**: Accessing brand properties returns a function instead of throwing
- **Type inference preserved**: TypeScript still correctly infers types
- **Consistent pattern**: All brand properties use the same approach
- **Better debugging**: Clear error message if function is actually called

### Negative
- **Slightly more complex**: Developers need to understand the pattern
- **Extra function wrapper**: Minor memory overhead (negligible in practice)

### Neutral
- These properties should never be accessed in production code
- The pattern is only used for type-level programming

## Implementation Notes

### Applied to These Interfaces
- `RemoteModel`: `_type`, `_transformed`, `_params`
- `QuerySlice`: `_data`, `_args`
- `MutationSlice`: `_data`, `_args`
- `PageQuery`: `_data`, `_variables`

### Type Inference Still Works
```typescript
type InferModelType<T> = T extends RemoteModel<infer U, any, any> ? U : never;
// Works the same whether _type is TType or () => TType
```

## Alternatives Considered

1. **Symbols**: Use unique symbols for brand properties
   - Rejected: More complex, doesn't solve the runtime access issue

2. **Never type**: Use `never` as the property type
   - Rejected: Breaks type inference

3. **Optional properties**: Make brands optional
   - Rejected: Weakens type safety

## References
- TypeScript handbook on branded types
- Implementation: `packages/core/src/types/brand-func.ts`