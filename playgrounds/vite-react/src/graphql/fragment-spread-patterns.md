# Fragment Spread Patterns in soda-gql

## Fragment Spreading Syntax

Fragment spreading uses tagged template interpolation or the options-object path with `.spread()`.

## Pattern 1: Direct Fragment Spread (Tagged Template)

```typescript
// ✅ Tagged template interpolation works for fragment-to-fragment and operation spreads
gql.default(({ query }) =>
  query("GetData")`{
    ...${someFragment}
  }`()
)
```

For operations needing the options-object path:
```typescript
// ✅ Options-object path with .spread()
gql.default(({ query }) =>
  query("GetData")({
    fields: ({ $ }) => ({
      ...someFragment.spread({ /* variables */ }),
    }),
  })({})
)
```

## Pattern 2: Variable Passing with Fragment Spread (Options-Object Path)

```typescript
// ✅ Options-object path with explicit variable passing
gql.default(({ query }) =>
  query("GetData")({
    variables: `($var: Type!)`,
    fields: ({ $ }) => ({
      ...fragment.spread({
        var: $.var, // Explicit variable passing
      }),
    }),
  })({})
)
```

## Key Principle: Explicit Variable Declaration

**Fragment variables are NOT automatically merged into parent operations.**

### Pattern: Fragments Declare Requirements; Operations Declare Contract

```typescript
// Fragment declares what variables it needs
const myFragment = gql.default(({ fragment }) =>
  fragment("MyFragment", "Query")`($limit: Int, $filter: String) {
    items(limit: $limit, filter: $filter) { id }
  }`()
);

// Operation MUST explicitly declare ALL variables (including fragment's)
const myQuery = gql.default(({ query }) =>
  query("MyQuery")({
    variables: `($limit: Int, $filter: String, $sortBy: String)`,
    fields: ({ $ }) => ({
      // Pass variables explicitly to fragment
      ...myFragment.spread({
        limit: $.limit,
        filter: $.filter,
      }),
    }),
  })({})
);
```

### Why Explicit Declaration?

1. **Clarity**: Dependencies are visible in the operation signature
2. **Type Safety**: TypeScript ensures all required variables are provided
3. **No Magic**: Prevents unexpected variable pollution
4. **Flexibility**: Parent can choose how to map its variables to fragment requirements

## Summary: When to Use Options-Object Path

For fragment spreading with variable passing or advanced features, use the options-object path because:
- The `fields: ({ $ }) => (...)` callback provides the `$` context for variable passing
- Operations needing `$colocate`, aliases, or directives require the options-object path
- Tagged template interpolation works for simple fragment spreads without variable binding

## See Also

- Working examples: `operations.ts` (getEmployeeWithFragmentQuery, getProjectWithMultipleFragmentsQuery, getTeamProjectsWithFragmentQuery)
- Type verification: `fragment-spread-verification.ts`
- Simple tests: `fragment-spread-simple-test.ts`
