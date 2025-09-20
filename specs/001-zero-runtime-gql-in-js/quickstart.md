# Quickstart — soda-gql Runtime → Zero-runtime Flow

> Goal: Validate that developers can adopt soda-gql with runtime GraphQL document generation first, then switch to zero-runtime transforms without code changes beyond config.

## Prerequisites
- Bun 1.x installed (`bun --version`)
- GraphQL schema available as SDL or introspection JSON
- Project configured to import generated entrypoint as `@/graphql-system`

## Step 1 — Generate Typed Runtime Entry (`codegen`)
```bash
bun run soda-gql codegen \
  --schema ./schema.graphql \
  --out packages/graphql-system/src/index.ts \
  --format json
```
- Validates schema with zod; exits non-zero on failure (expect RED test initially).
- Emits types + `createGql` wiring for runtime APIs.

## Step 2 — Define Models and Query Slices with the Generated `gql`
```ts
// src/entities/user.ts
import { gql } from "@/graphql-system";

export const userModel = gql.model(
  ["user", { categoryId: gql.scalar("id", "?") }],
  ({ f, $ }) => ({
    ...f.id(),
    ...f.name(),
    posts: f.posts({ categoryId: $.categoryId }, ({ f }) => ({
      ...f.id(),
      ...f.title(),
    })),
  }),
  (data) => ({
    id: data.id,
    name: data.name,
    posts: data.posts.map((post) => ({
      id: post.id,
      title: post.title,
    })),
  }),
);

export const userSlice = gql.querySlice(
  [{
    id: gql.scalar("id", "!"),
    categoryId: gql.scalar("id", "?"),
  }],
  ({ f, $ }) => ({
    users: f.users({ id: [$.id] }, () => ({
      ...userModel.fragment({ categoryId: $.categoryId }),
    })),
  }),
  ({ select }) =>
    select("$.users", (result) => {
      if (result.isError()) {
        return { error: result.error };
      }

      if (result.isEmpty()) {
        return { data: [] };
      }

      return {
        data: result.data.map((user) => userModel.transform(user)),
      };
    }),
);
```
- Models and slices are declared at module top-level; the transform callback
  returns domain-friendly data while preserving neverthrow-like ergonomics.

## Step 3 — Run Runtime Builder (Development Mode)
```bash
bun run soda-gql builder \
  --mode runtime \
  --entry ./src/pages/profile.page.ts \
  --out ./node_modules/.cache/soda-gql/runtime.json
```
- Evaluates refs/docs directly, generates GraphQL documents used by tests.
- JSON output validated before writing.

## Step 4 — Compose a Page Query and Assert Types
```ts
// src/pages/profile.query.ts
import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const profileQuery = gql.query(
  "ProfilePageQuery",
  { userId: gql.scalar("id", "!") },
  ({ $ }) => ({
    users: userSlice({ id: $.userId }),
  }),
);

// In contract tests
test("profile query exposes typed transform", () => {
  const response = profileQuery.transform({ users: [] });

  if ("error" in response.users) {
    throw new Error("unexpected error");
  }

  expect(response.users.data).toEqual([]);
});
```
- Contract tests should fail in RED phase until the builder and adapters produce
  real GraphQL documents and runtime execution results.

## Step 5 — Enable Zero-runtime Transform (Babel Plugin)
```js
// babel.config.js
module.exports = {
  plugins: [["@soda-gql/plugin-babel", {
    mode: "zero-runtime",
    artifactsPath: "./node_modules/.cache/soda-gql/runtime.json"
  }]]
};
```
- Plugin replaces in-file definitions with `@/graphql-system` imports referencing generated docs.
- Runtime `builder` step now runs during build `pre` hook to refresh artifacts.

## Step 6 — Verify End-to-End Flow
1. Run contract tests: `bun test tests/contract --watch`. First run should fail (RED) until implementations land.  
2. Implement missing functionality following tasks.md order (future phase).  
3. Confirm integration tests pass with zero runtime overhead (docs imported from generated module).  
4. Track performance (≤100 ms/file) via builder report emitted to console/logs.

## Rollback Strategy
- Toggle plugin mode back to `runtime` to debug issues quickly.  
- Re-run `codegen` when schema changes; type errors surface in consuming code through `createGql` exports.

---
Future tasks (Phase 2+) will formalize test scaffolding and implementation steps.
