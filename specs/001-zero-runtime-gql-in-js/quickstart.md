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

## Step 2 — Define Models and Query Slices
```ts
// src/entities/user.model.ts
import { defineModel } from "@soda-gql/core";

export const userModel = defineModel({
  name: "User",
  fields: {
    id: field.string(),
    name: field.string(),
    posts: field.list("Post", { params: { limit: int() } }),
  },
  transform: (data) => ok({
    id: data.id,
    name: data.name,
    posts: data.posts.map(post => postModel.transform(post).unwrap()),
  }),
});
```
- Models declared at module top-level; transforms return neverthrow `Result`.

## Step 3 — Run Runtime Builder (Development Mode)
```bash
bun run soda-gql builder \
  --mode runtime \
  --entry ./src/pages/profile.page.ts \
  --out ./node_modules/.cache/soda-gql/runtime.json
```
- Evaluates refs/docs directly, generates GraphQL documents used by tests.
- JSON output validated before writing.

## Step 4 — Consume Generated Docs in Tests
```ts
import { gql } from "@/graphql-system";

test("profile page query merges slices", () => {
  const doc = gql("ProfilePageQuery");
  expect(doc.document).toMatchSnapshot();
});
```
- Contract tests should fail until builder emits expected document (RED phase).

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
