# Error Handling Migration Guide

## Purpose and Scope
This guide standardises soda-gql error handling on `neverthrow` Results, replacing ad-hoc `throw new Error` sites called out in `docs/improvement-plan.md`. The focus is on the builder, Babel plugin, and CLI layers that currently surface raw exceptions.

## Prerequisites
- `bun install` has been executed (ensures `neverthrow@8.x` is available in each package).
- Familiarity with the existing `Result` helpers in `packages/builder/src/artifact.ts` and `packages/cli/src/utils/parse-args.ts`.
- Clean working tree (`git status` should report no pending changes).

## Implementation Steps

### 1. Baseline Verification
1. Run `bun test tests/integration/runtime_builder_flow.test.ts`.
2. Capture current CLI behaviour with `bun run packages/cli/src/index.ts -- --help` (ensures no regressions after migration).

### 2. Establish a Central Error Catalogue
1. Create `packages/tool-utils/src/errors.ts` exporting:
   - `SodaGqlErrorCode` union covering documented codes (`SODA_GQL_EXPORT_NOT_FOUND`, `RUNTIME_MODULE_TRANSFORM_FAILURE`, etc.).
   - `createSodaGqlError({ code, message, meta })` returning `{ code, message, meta }`.
2. Re-export the helper via `packages/tool-utils/src/index.ts` (if not already exported).
3. Update `packages/builder/src/types.ts` to import `SodaGqlError` for downstream typing.

### 3. Migrate Builder Throws to Results
1. Update `packages/builder/src/intermediate-module.ts:120-140`:
   - Replace the `throw new Error("RUNTIME_MODULE_TRANSFORM_FAILURE")` guard with an `err(createSodaGqlError(...))` return.
   - Ensure the function signature becomes `Result<string, SodaGqlError>` and update callers (`packages/builder/src/dependency-graph.ts:214`, `packages/builder/src/writer.ts:54`).

#### Before / After Example
```ts title="Before — packages/builder/src/intermediate-module.ts:120-128"
if (!expressionStatement || !ts.isExpressionStatement(expressionStatement)) {
  transformed.dispose();
  throw new Error("RUNTIME_MODULE_TRANSFORM_FAILURE");
}
```
```ts title="After — packages/builder/src/intermediate-module.ts"
if (!expressionStatement || !ts.isExpressionStatement(expressionStatement)) {
  transformed.dispose();
  return err(createSodaGqlError({
    code: "RUNTIME_MODULE_TRANSFORM_FAILURE",
    message: "SWC transform did not yield an expression statement",
    meta: { file: input.filePath },
  }));
}
```
2. Propagate the new `Result` through `renderEntry` and friends so callers unwrap via `.map` / `.mapErr` instead of `unwrapNullish`.
3. Update `packages/builder/src/module-loader.ts:86-140` to forward errors without catching.

### 4. Convert Babel Plugin Exceptions
1. Wrap the logic in `packages/plugin-babel/src/plugin.ts:270-345` in helper functions returning `Result<GqlCall, SodaGqlError>`.
2. Replace direct throws (`SODA_GQL_EXPORT_NOT_FOUND`, `gql.query requires ...`) with `err(createSodaGqlError({ ... }))` and include AST locations via `path.node.loc` when available.

#### Before / After Example
```ts title="Before — packages/plugin-babel/src/plugin.ts:275-288"
const segments = collectExportSegments(nodePath);
if (!segments) {
  throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
}
```
```ts title="After — packages/plugin-babel/src/plugin.ts"
const segmentsResult = collectExportSegments(nodePath);
if (segmentsResult.isErr()) {
  return err(createSodaGqlError({
    code: "SODA_GQL_EXPORT_NOT_FOUND",
    message: segmentsResult.error.message,
    meta: { file: state.filename, loc: nodePath.node.loc },
  }));
}
```
3. Update callers (`analyzeGqlCall`, `buildModelRuntimeCall`) to operate on `Result` pipelines, returning errors to the main plugin visitor.

### 5. Normalise CLI Error Surfaces
1. In `packages/cli/src/commands/builder.ts:35-104`, consume the new builder `Result` without `try/catch`.
2. Format errors using a shared helper (`renderCliError`) that prints `code`, `message`, and `meta` as a table before exiting with `process.exit(1)`.
3. Ensure integration tests such as `tests/integration/zero_runtime_transform.test.ts:70-116` expect structured diagnostics instead of generic `Error` strings.

### 6. Documentation and Follow-up
1. Document error codes and meanings in `docs/decisions/README.md`.
2. Update `docs/improvement-plan.md` status once migration is complete.

## Validation Commands
```bash
bun test --filter runtime_builder_flow
bun test tests/integration/zero_runtime_transform.test.ts
bun run typecheck
bun run biome:check
```

## Rollback Procedure
1. `git restore packages/tool-utils/src/errors.ts packages/builder/src/intermediate-module.ts packages/plugin-babel/src/plugin.ts packages/cli/src/commands/builder.ts`
2. `git checkout -- tests/integration`
3. Re-run `bun test tests/integration/runtime_builder_flow.test.ts` to confirm the pre-migration behaviour.
