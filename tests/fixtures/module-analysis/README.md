# Module Analysis Test Fixtures

This directory contains TypeScript fixtures used for testing the module analysis and transformation capabilities of soda-gql.

## Directory Structure

```
module-analysis/
├── ts/           # TypeScript analyzer fixtures (using tsc AST)
├── swc/          # SWC analyzer fixtures (using SWC parser)
└── shared/       # Fixtures shared between both analyzers
```

## Fixture Categories

### Query Operations
- `top-level-with-metadata.ts` - Basic query with operation metadata
- `nested-object-values.ts` - Complex nested query structure
- `local-and-imported-deps.ts` - Query with slice dependencies

### Mutation Operations
- `mutation-simple.ts` - Basic mutation with variables
- `mutation-with-slice.ts` - Mutation using slice composition

### Subscription Operations
- `subscription-simple.ts` - Basic subscription
- `subscription-with-variables.ts` - Subscription with parameters

### Models & Slices
- `top-level-simple.ts` - Basic model definition
- `nested-in-function.ts` - Model inside function scope
- `arrow-function.ts` - Model in arrow function

### Edge Cases
- `multiple-schemas.ts` - Multi-schema testing
- `duplicate-names.ts` - Same names in different scopes
- `nested-non-top-level.ts` - Non-top-level definitions

## Adding New Fixtures

1. **Choose the right directory**:
   - Use `ts/` for TypeScript-specific syntax
   - Use `swc/` for SWC-specific tests
   - Use `shared/` for analyzer-agnostic fixtures

2. **Follow naming conventions**:
   - Descriptive kebab-case names (e.g., `mutation-with-variables.ts`)
   - Prefix with operation type when relevant

3. **Use @ts-expect-error for intentional errors**:
   ```typescript
   // @ts-expect-error - Testing invalid field access
   ...f.nonExistentField()
   ```

4. **Update tests**:
   - Add to relevant test suites in `tests/unit/builder/`
   - Update integration tests if needed

5. **Keep schemas in sync**:
   - Update `tests/fixtures/runtime-app/schema.graphql` if new fields needed
   - Run `bun fixture:setup` to regenerate GraphQL system types

## Related Tests

- **Unit tests**: `tests/unit/builder/module_analysis*.test.ts`
- **Integration tests**: `tests/integration/zero_runtime_transform.test.ts`

## GraphQL System

Fixtures use the generated GraphQL system from:
- Schema: `tests/fixtures/runtime-app/schema.graphql`
- Generated: `tests/fixtures/runtime-app/graphql-system/index.ts`

Import the system in fixtures:
```typescript
import { gql } from "@/graphql-system";
```

## Type Checking

All fixtures are included in `tests/tsconfig.typecheck.json` to ensure type safety.

Run type checks:
```bash
bun typecheck
```

## Pattern Guidelines

### Operations (query/mutation/subscription)

Operations compose slices and define variables at the top level:

```typescript
export const createPostMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreatePost",
      variables: [$("title").scalar("String:!")],
    },
    ({ $ }) => ({
      post: createPostSlice.build({ title: $.title }),
    }),
  ),
);
```

### Slices

Slices provide field access and return arrays of field selections:

```typescript
const createPostSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [$("title").scalar("String:!")],
    },
    ({ f, $ }) => [
      f.createPost({ title: $.title })(({ f }) => [
        f.id(),
        f.title(),
      ]),
    ],
    ({ select }) =>
      select(["$.createPost"], (result) => result.safeUnwrap(([post]) => post)),
  ),
);
```

### Field Selection Notes

- Use array syntax for field selections: `[f.id(), f.name()]`
- Field factories are curried: `f.user({ id: 1 })(({ f }) => [...])`
- Variables defined as arrays: `variables: [$("id").scalar("ID:!")]`
- Use array for select paths: `select(["$.field"], ...)`
