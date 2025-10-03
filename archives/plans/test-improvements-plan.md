# Test Improvements Implementation Plan

**Date**: 2025-10-03
**Status**: Planning
**Reviewed by**: Codex

## Overview

This document outlines improvements to the test infrastructure following the recent fixture-based and behavioral testing refactoring. The plan excludes Windows path compatibility (not required for this project).

---

## 1. Operation Spy Cleanup

### Goal
Guarantee every test fully isolates `gqlRuntime.operation` overrides and exposes reusable spy helpers.

### Current State
`withOperationSpy` in `tests/integration/zero_runtime_transform.test.ts:31` rewires `gqlRuntime.operation` inline per test.

```typescript
const withOperationSpy = async <T>(
  fn: (recordedOperations: Array<AnyOperationOf<OperationType>>) => Promise<T>,
): Promise<T> => {
  const recordedOperations: Array<AnyOperationOf<OperationType>> = [];
  const originalOperation = gqlRuntime.operation;
  try {
    gqlRuntime.operation = (input: any) => {
      const operation = originalOperation(input);
      recordedOperations.push(operation);
      return operation;
    };
    return await fn(recordedOperations);
  } finally {
    gqlRuntime.operation = originalOperation;
  }
};
```

### Proposed Changes

1. **Create shared utility**: `tests/utils/operationSpy.ts`

```typescript
import type { AnyOperationOf } from "@soda-gql/core";
import * as gqlRuntime from "../../packages/core/src/runtime";

export interface OperationSpy<T> {
  recordedOperations: Array<AnyOperationOf<T>>;
  restore: () => void;
}

export const createOperationSpy = <T>(): OperationSpy<T> => {
  const recordedOperations: Array<AnyOperationOf<T>> = [];
  const originalOperation = gqlRuntime.operation;

  gqlRuntime.operation = (input: any) => {
    const operation = originalOperation(input);
    recordedOperations.push(operation);
    return operation;
  };

  return {
    recordedOperations,
    restore: () => {
      gqlRuntime.operation = originalOperation;
    },
  };
};

export const withOperationSpy = async <T, R>(
  fn: (recordedOperations: Array<AnyOperationOf<T>>) => Promise<R>,
): Promise<R> => {
  const spy = createOperationSpy<T>();
  try {
    return await fn(spy.recordedOperations);
  } finally {
    spy.restore();
  }
};
```

2. **Update integration test** to import from shared utilities

```typescript
import { withOperationSpy } from "../utils/operationSpy";
```

3. **Add global cleanup** (optional, for additional safety)

```typescript
import { afterEach } from "bun:test";
import { __resetRuntimeRegistry } from "@soda-gql/core/runtime";

afterEach(() => {
  __resetRuntimeRegistry();
});
```

### Benefits
- Eliminates risk of lingering spies when tests abort early
- Centralizes behavior for future test suites
- Simplifies cleanup and test isolation
- Enables reuse across multiple test files

### Risks/Trade-offs
- Slightly more indirection
- Must ensure helper imports do not create circular dependencies

### Priority
**High** - Affects test reliability and isolation

### Effort
**Small** - ~1-2 hours implementation

---

## 2. Transpiler Reuse

### Goal
Reduce test runtime by reusing a single `Bun.Transpiler` per suite.

### Current State
`loadTransformedModule` creates a new transpiler instance each invocation (`tests/integration/zero_runtime_transform.test.ts:52`).

```typescript
const loadTransformedModule = async (filePath: string) => {
  const transformed = await readFile(filePath, "utf-8");
  const transpiler = new Bun.Transpiler({ loader: "ts" }); // New instance every time
  const jsCode = await transpiler.transform(transformed);
  // ...
};
```

### Proposed Changes

1. **Create shared module loader**: `tests/utils/moduleLoader.ts`

```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

// Reusable transpiler instance
const transpiler = new Bun.Transpiler({ loader: "ts" });

// Optional: Simple memoization cache
const transformCache = new Map<string, string>();

export const loadTransformedModule = async (
  filePath: string,
  outputDir: string,
  options?: { cache?: boolean },
) => {
  const transformed = await readFile(filePath, "utf-8");

  let jsCode: string;
  if (options?.cache && transformCache.has(filePath)) {
    jsCode = transformCache.get(filePath)!;
  } else {
    jsCode = await transpiler.transform(transformed);
    if (options?.cache) {
      transformCache.set(filePath, jsCode);
    }
  }

  const lastSlash = filePath.lastIndexOf("/src/");
  const relativePath = filePath.slice(lastSlash + 1).replace(/\.ts$/, ".js");
  const outputPath = join(outputDir, relativePath);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, jsCode);

  return import(outputPath);
};

// Cleanup for tests
export const clearTransformCache = () => {
  transformCache.clear();
};
```

2. **Update integration test** to use shared utility

```typescript
import { loadTransformedModule, clearTransformCache } from "../utils/moduleLoader";

// In afterEach or test cleanup
afterEach(() => {
  clearTransformCache();
});
```

### Benefits
- Removes repeated transpiler setup cost
- Improves test suite performance
- Improves consistency when many fixtures load in one run
- Optional caching can further speed up repeated runs

### Risks/Trade-offs
- Shared instance may retain state if Bun changes behavior
- Memoization increases memory usage for large fixture sets
- Cache invalidation needs to be managed properly

### Priority
**Medium** - Performance optimization, not critical for correctness

### Effort
**Small** - ~1 hour implementation

---

## 3. Mutation & Subscription Fixtures

### Goal
Expand fixture coverage to mutation and subscription scenarios.

### Current State
`tests/fixtures/module-analysis/` only contains query and model fixtures.

```
tests/fixtures/module-analysis/
├── ts/
│   ├── top-level-with-metadata.ts (query + model)
│   ├── nested-object-values.ts (query)
│   └── ...
├── swc/
│   └── ...
└── shared/
    └── ...
```

### Proposed Changes

1. **Update GraphQL schema**: Add mutation and subscription types

```graphql
# tests/fixtures/runtime-app/schema.graphql

type Mutation {
  createPost(title: String!, body: String): Post!
  updateUser(id: ID!, name: String!): User!
  deletePost(id: ID!): Boolean!
}

type Subscription {
  postCreated: Post!
  userUpdated(userId: ID!): User!
}
```

2. **Create mutation fixtures**:

`tests/fixtures/module-analysis/ts/mutation-simple.ts`:
```typescript
import { gql } from "@/graphql-system";

export const createPostMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreatePost",
      variables: {
        ...$("title").scalar("String:!"),
        ...$("body").scalar("String:?"),
      },
    },
    ({ $, f }) => ({
      ...f.createPost(
        { title: $.title, body: $.body },
        ({ f }) => ({
          ...f.id(),
          ...f.title(),
        }),
      ),
    }),
  ),
);
```

`tests/fixtures/module-analysis/ts/mutation-with-slice.ts`:
```typescript
import { gql } from "@/graphql-system";

const postSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: {
        ...$("title").scalar("String:!"),
      },
    },
    ({ $, f }) => ({
      ...f.createPost({ title: $.title }, ({ f }) => ({ ...f.id() })),
    }),
    ({ select }) => select(["$.createPost"], (result) => result),
  ),
);

export const pageAction = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "PageAction",
      variables: {
        ...$("title").scalar("String:!"),
      },
    },
    ({ $ }) => ({
      post: postSlice.build({ title: $.title }),
    }),
  ),
);
```

3. **Create subscription fixtures**:

`tests/fixtures/module-analysis/ts/subscription-simple.ts`:
```typescript
import { gql } from "@/graphql-system";

export const postCreatedSubscription = gql.default(({ operation }) =>
  operation.subscription(
    {
      operationName: "PostCreated",
      variables: {},
    },
    ({ f }) => ({
      ...f.postCreated(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  ),
);
```

`tests/fixtures/module-analysis/ts/subscription-with-variables.ts`:
```typescript
import { gql } from "@/graphql-system";

export const userUpdatedSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      operationName: "UserUpdated",
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ $, f }) => ({
      ...f.userUpdated({ userId: $.userId }, ({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  ),
);
```

4. **Mirror fixtures in SWC directory** for SWC-specific tests

5. **Update integration tests** to cover new operation types

```typescript
describe("mutation operations", () => {
  test("transforms mutation with variables", async () => {
    const result = await withOperationSpy(async (recordedOperations) => {
      const module = await loadTransformedModule(
        join(fixturesDir, "ts/mutation-simple.ts")
      );
      return { module, recordedOperations };
    });

    expect(result.recordedOperations).toHaveLength(1);
    expect(result.recordedOperations[0].type).toBe("mutation");
  });
});

describe("subscription operations", () => {
  test("transforms subscription with variables", async () => {
    // Similar test structure
  });
});
```

### Benefits
- Validates behavior for broader operation types
- Prevents regressions in non-query flows
- Ensures mutation and subscription transformations work correctly
- Provides examples for future development

### Risks/Trade-offs
- Additional fixtures lengthen test execution slightly
- Requires keeping fixture truthiness aligned with real schemas
- Schema regeneration needed after updates

### Priority
**High** - Important for comprehensive test coverage

### Effort
**Medium** - ~3-4 hours (schema update, fixtures, tests)

---

## 4. Fixture README

### Goal
Document fixture directory purpose and usage for contributors.

### Current State
No documentation inside `tests/fixtures/module-analysis`.

### Proposed Changes

Create `tests/fixtures/module-analysis/README.md`:

```markdown
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
   - Run `bun fixture:setup2` to regenerate GraphQL system types

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
```

### Benefits
- Onboards contributors faster
- Reduces risk of misplacing future fixtures
- Documents conventions and best practices
- Provides clear guidelines for adding new fixtures

### Risks/Trade-offs
- Documentation can drift if not maintained
- Requires updates when structure changes

### Priority
**Medium** - Improves maintainability but not urgent

### Effort
**Small** - ~30 minutes

---

## 5. Shared Test Utilities

### Goal
Centralize repeated helper logic for integration and unit tests.

### Current State
Utilities (operation spy, module loader, fixture helpers) live inline in individual test files.

### Proposed Changes

1. **Create utility directory structure**:

```
tests/utils/
├── index.ts           # Re-exports all utilities
├── operationSpy.ts    # Operation spy helpers
├── moduleLoader.ts    # Module loading and transpilation
└── fixtureHelpers.ts  # Fixture path and loading helpers
```

2. **Implement `tests/utils/fixtureHelpers.ts`**:

```typescript
import { join } from "node:path";
import { readFileSync } from "node:fs";

const FIXTURES_ROOT = join(__dirname, "../fixtures");

export const getFixturePath = (
  category: string,
  name: string,
): string => {
  return join(FIXTURES_ROOT, category, `${name}.ts`);
};

export const loadFixture = (
  category: string,
  name: string,
): { filePath: string; source: string } => {
  const filePath = getFixturePath(category, name);
  return {
    filePath,
    source: readFileSync(filePath, "utf-8"),
  };
};

export const getModuleAnalysisFixturePath = (
  analyzer: "ts" | "swc" | "shared",
  name: string,
): string => {
  return getFixturePath(`module-analysis/${analyzer}`, name);
};
```

3. **Create `tests/utils/index.ts`**:

```typescript
export * from "./operationSpy";
export * from "./moduleLoader";
export * from "./fixtureHelpers";
```

4. **Update existing tests** to use shared utilities:

```typescript
// Before
const fixturesDir = join(__dirname, "../../fixtures/module-analysis/ts");
const fixturePath = join(fixturesDir, "top-level-simple.ts");
const source = readFileSync(fixturePath, "utf-8");

// After
import { loadFixture } from "../utils";
const { filePath, source } = loadFixture("module-analysis/ts", "top-level-simple");
```

### Benefits
- Reduces code duplication across test files
- Clarifies responsibilities and separation of concerns
- Simplifies future refactors and maintenance
- Provides consistent API for common test operations
- Easier to update behavior in one place

### Risks/Trade-offs
- Requires careful path updates during migration
- Overly generic helpers may become grab-bag if not curated
- Additional indirection may make tests slightly harder to read initially

### Priority
**Medium** - Improves code quality but not blocking

### Effort
**Medium** - ~2-3 hours (create utilities + migrate existing tests)

---

## Implementation Order

Recommended order based on priority and dependencies:

1. **Operation Spy Cleanup** (High, Small) - Improves test reliability
2. **Mutation & Subscription Fixtures** (High, Medium) - Expands coverage
3. **Transpiler Reuse** (Medium, Small) - Performance optimization
4. **Shared Test Utilities** (Medium, Medium) - Code organization
5. **Fixture README** (Medium, Small) - Documentation

## Success Criteria

- [ ] All tests remain passing (148+ tests)
- [ ] Type checks pass with 0 errors
- [ ] Test utilities are reusable and well-documented
- [ ] Mutation and subscription operations are covered
- [ ] Test isolation is guaranteed even on failure paths
- [ ] Test suite runs faster with transpiler reuse
- [ ] New contributors can understand fixture structure from README

## Notes

- This plan excludes Windows path compatibility (not required)
- All changes should maintain backward compatibility with existing tests
- Follow TDD methodology: write tests first, then implement
- Update CLAUDE.md if new testing conventions are established
