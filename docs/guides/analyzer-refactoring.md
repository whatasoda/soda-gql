# Analyzer Refactoring Guide

## Purpose and Scope
This guide walks through decomposing the current SWC-based analyzer (`packages/builder/src/ast/analyze-module-swc.ts`) into composable modules shared with the TypeScript analyzer. Follow these instructions when starting the P0 refactor described in `docs/improvement-plan.md`.

## Prerequisites
- Working Bun toolchain (`bun --version`)
- Familiarity with SWC AST types and the builder dependency graph
- Clean git state (`git status` shows no staged or unstaged changes)

## Implementation Checklist

### 1. Capture the Baseline
1. Run `bun test --filter module_analysis` to snapshot current behaviour.
2. Open `packages/builder/src/ast/analyze-module-swc.ts` and note hot spots:
   - `collectImports` at lines 74-133
   - `collectExports` at lines 135-214
   - `analyzeModule` entry point at lines 719-889

### 2. Introduce Shared AST Utilities
1. Create `packages/builder/src/ast/shared/` with the following files:
   - `context.ts` — shared location/position helpers currently in lines 35-72.
   - `imports.ts` — `collectImports` extraction.
   - `exports.ts` — `collectExports` extraction.
   - `gql-calls.ts` — wrappers for `gqlCallKinds` and traversal logic from lines 216-410.
2. Export shared helpers through `packages/builder/src/ast/shared/index.ts` for reuse.
3. Re-export the shared helpers inside `packages/builder/src/ast/analyze-module.ts` to keep parity with the TS analyzer.

#### Before / After Example
```ts title="Before — packages/builder/src/ast/analyze-module-swc.ts:74-133"
const collectImports = (module: Module): ModuleImport[] => {
  const imports: ModuleImport[] = [];
  module.body.forEach((item) => {
    if (item.type === "ImportDeclaration") {
      handle(item);
    }
  });
  return imports;
};
```
```ts title="After — packages/builder/src/ast/shared/imports.ts"
export const collectImports = (module: Module): ModuleImport[] => {
  return visitModule(module, new ImportCollector()).toArray();
};
```

### 3. Refactor the SWC Analyzer Entry Point
1. Replace inline helpers in `analyze-module-swc.ts` with imports from the new shared modules.
2. Restructure the main `analyzeModule` implementation (lines 719-889) to:
   - Derive `ModuleTraversalContext` from `shared/context.ts`.
   - Compose pure helpers (`collectImports`, `collectExports`, `collectGqlCalls`).
   - Pipe results into `buildModuleAnalysis` exported from `analyze-module.ts`.
3. Keep legacy function signatures stable to avoid breaking callers in `packages/builder/src/module-loader.ts:88`.

#### Before / After Example
```ts title="Before — packages/builder/src/ast/analyze-module-swc.ts:719-742"
export const analyzeModule = (input: AnalyzeModuleInput): ModuleAnalysis => {
  const module = parseSync({
    filename: input.filePath,
    syntax: "typescript",
    source: input.contents,
  });
  const imports = collectImports(module);
  // ...
};
```
```ts title="After — packages/builder/src/ast/analyze-module-swc.ts"
export const analyzeModule = (input: AnalyzeModuleInput): ModuleAnalysis => {
  const module = parseSource(input);
  const context = createTraversalContext(input, module);
  return buildModuleAnalysis({
    imports: collectImports(module),
    exports: collectExports(module),
    gqlCalls: collectGqlCalls(module, context),
    context,
  });
};
```

### 4. Align Type-Only Path
1. Mirror the shared helper usage inside `packages/builder/src/ast/analyze-module.ts`.
2. Ensure both analyzers export the same `AnalyzeModuleResult` shape by centralising it in `shared/types.ts`.

### 5. Update Tests and Fixtures
1. Add unit coverage under `tests/unit/builder/ast/` for each new helper.
2. Update integration fixtures:
   - `tests/integration/builder_cache_flow.test.ts:60-108`
   - `tests/integration/runtime_builder_flow.test.ts:60-112`
3. Regenerate fixtures if AST output changes (`bun test --update-snapshots`).

## Validation Commands
```bash
bun test --filter module_analysis
bun test tests/integration/builder_cache_flow.test.ts
bun run typecheck
bun run biome:check
```

## Rollback Procedure
1. `git restore packages/builder/src/ast/analyze-module-swc.ts packages/builder/src/ast/analyze-module.ts`
2. `git clean -fd packages/builder/src/ast/shared`
3. Re-run `bun test --filter module_analysis` to confirm parity.
