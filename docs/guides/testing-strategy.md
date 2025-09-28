# Testing Strategy Implementation Guide

## Purpose and Scope
This guide translates the P0 testing initiative from `docs/improvement-plan.md` into actionable tasks. It defines a multi-layer strategy covering builders, plugins, and CLI flows, with clear commands and rollback steps.

## Prerequisites
- Bun v1.1+ (verify with `bun --version`).
- Node-compatible environment for running integration fixtures under `tests/fixtures`.
- Clean working tree (`git status`).

## Strategy Overview
1. Strengthen unit coverage for AST helpers and error handling.
2. Expand integration tests to cover zero-runtime and multi-schema flows.
3. Add contract tests for plugin output stability.
4. Wire coverage and watch workflows into CI/local scripts.

## Step-by-Step Implementation

### Step 1 — Baseline Metrics
1. Run `bun test --coverage` and copy the generated summary from `/Users/whatasoda/workspace/soda-gql/coverage/coverage-final.json`.
2. Snapshot current failing tests (if any) with `bun test --reporter verbose`.

### Step 2 — Introduce Builder AST Unit Tests
1. Create `tests/unit/builder/ast/collect_imports.test.ts` targeting the new helpers from `packages/builder/src/ast/shared/imports.ts`.
2. Use fixtures from `tests/fixtures/analyzer/` (create if missing) to assert on parsed import/export metadata.
3. Mock SWC modules with the existing helper in `tests/utils/transform.ts`.

#### Before / After Example
```ts title="Before — no direct unit coverage"
// Implicitly tested via integration only.
```
```ts title="After — tests/unit/builder/ast/collect_imports.test.ts"
it("collects namespace imports", () => {
  const module = parseFixture("namespace.ts");
  expect(collectImports(module)).toContainEqual({
    source: "./foo",
    imported: "*",
    kind: "namespace",
  });
});
```

### Step 3 — Harden Integration Flows
1. Update `tests/integration/runtime_builder_flow.test.ts:73-95` to avoid manual `throw new Error` checks.

```ts title="Before — tests/integration/runtime_builder_flow.test.ts:73-95"
if (result.isErr()) {
  throw new Error(`builder failed: ${result.error.code}`);
}
```
```ts title="After — tests/integration/runtime_builder_flow.test.ts"
const builderResult = await runBuilder(...);
expect(builderResult).toBeOk();
```
2. Add custom Jest-style matchers (`tests/utils/result-expect.ts`) and register them in `tests/setup.ts`.
3. Mirror the matcher usage in `tests/integration/zero_runtime_transform.test.ts:84-107` and builder cache tests.

### Step 4 — Add Contract Snapshots for Babel Plugin
1. Extend `tests/contract/plugin-babel/plugin_babel.test.ts` to snapshot transformed output for `gql.model`, `gql.querySlice`, and `gql.query` builders.
2. Store snapshot files under `tests/contract/plugin-babel/__snapshots__/`.
3. Update fixtures in `tests/contract/plugin-babel/fixtures/` to cover error conditions surfaced by the new Result-based API.

### Step 5 — Wire Commands into Developer Workflow
1. Add npm scripts in `package.json`:
   - `"test:unit": "bun test tests/unit"`
   - `"test:integration": "bun test tests/integration"`
   - `"test:watch": "bun test --watch"`
2. Document the scripts in `README.md` under the "Contributing" section.
3. Configure `.github/workflows/ci.yml` (if present) to run unit, integration, and contract jobs in parallel.

### Step 6 — Maintain Coverage and Regression Gates
1. Set a coverage threshold (e.g. 85%) in `bunfig.toml` or `jest.config.ts` equivalent.
2. Fail CI when coverage drops below the threshold.
3. Add a `tests/scripts/watch-module-analysis.ts` utility to rerun analyzer-specific tests in watch mode while refactoring.

## Validation Commands
```bash
bun test tests/unit/builder/ast --reporter spec
bun test tests/integration/runtime_builder_flow.test.ts
bun test tests/contract/plugin-babel --update-snapshots
bun run typecheck
bun run biome:check
```

## Rollback Procedure
1. `git restore tests unit tests/integration tests/contract`
2. Remove newly added scripts: `git restore package.json README.md`
3. Delete coverage threshold config changes: `git clean -f bunfig.toml jest.config.ts`
4. Re-run `bun test --coverage` to confirm baseline parity.
