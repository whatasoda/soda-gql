# Fragment Spread Patterns in soda-gql

## Important Finding: Tagged Templates Reject Interpolation

**Both `query\`...\`` and `fragment\`...\`` tagged templates throw an error if any `${...}` interpolated expressions are used.**

This means that fragment spreading **cannot** be done with tagged template syntax and **must** use callback builder syntax.

## Pattern 1: Direct Fragment Spread (Callback Builder Required)

**Intended syntax (from VISION.md):**
```typescript
// ❌ This does NOT work - tagged templates reject ${...} interpolation
query`query GetData {
  ...${someFragment}
}`
```

**Actual working syntax:**
```typescript
// ✅ This works - using callback builder with .spread()
gql.default(({ query }) =>
  query.operation({
    name: "GetData",
    fields: ({ $ }) => ({
      ...someFragment.spread({ /* variables */ }),
    }),
  })
)
```

## Pattern 2: Callback Interpolation (Callback Builder Required)

**Intended syntax (from VISION.md):**
```typescript
// ❌ This does NOT work - tagged templates reject ${...} interpolation
query`query GetData($var: Type!) {
  ...${({ $ }) => fragment.spread({ var: $.var })}
}`
```

**Actual working syntax:**
```typescript
// ✅ This works - using callback builder with explicit variable passing
gql.default(({ query, $var }) =>
  query.operation({
    name: "GetData",
    variables: {
      ...$var("var").Type("!"),
    },
    fields: ({ $ }) => ({
      ...fragment.spread({
        var: $.var, // Explicit variable passing
      }),
    }),
  })
)
```

## Key Principle: Explicit Variable Declaration

**Fragment variables are NOT automatically merged into parent operations.**

### Pattern: Fragments Declare Requirements; Operations Declare Contract

```typescript
// Fragment declares what variables it needs
const myFragment = gql.default(({ fragment }) =>
  fragment`fragment MyFragment($limit: Int, $filter: String) on Query {
    items(limit: $limit, filter: $filter) { id }
  }`()
);

// Operation MUST explicitly declare ALL variables (including fragment's)
const myQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "MyQuery",
    variables: {
      // Parent must explicitly declare fragment's variables
      ...$var("limit").Int("?"),
      ...$var("filter").String("?"),
      // Plus any operation-specific variables
      ...$var("sortBy").String("?"),
    },
    fields: ({ $ }) => ({
      // Pass variables explicitly to fragment
      ...myFragment.spread({
        limit: $.limit,
        filter: $.filter,
      }),
    }),
  })
);
```

### Why Explicit Declaration?

1. **Clarity**: Dependencies are visible in the operation signature
2. **Type Safety**: TypeScript ensures all required variables are provided
3. **No Magic**: Prevents unexpected variable pollution
4. **Flexibility**: Parent can choose how to map its variables to fragment requirements

## Summary: When to Use Callback Builder

For fragment spreading, you **MUST** use callback builder syntax because:
- Tagged templates reject any `${...}` interpolated expressions
- Operations with fragment spreads cannot use `query\`...\`` syntax
- The `fields: ({ $ }) => (...)` callback provides the `$` context for variable passing

## See Also

- Working examples: `operations.ts` (getEmployeeWithFragmentQuery, getProjectWithMultipleFragmentsQuery, getTeamProjectsWithFragmentQuery)
- Type verification: `fragment-spread-verification.ts`
- Simple tests: `fragment-spread-simple-test.ts`
