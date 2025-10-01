# Analyzer Refactoring Guide (Pre-release Reset)

## Intent
We are rewriting the analyzer stack to serve the new IR-first architecture described in `docs/improvement-plan.md`. Assume there are **no backward-compatibility requirements**. Prefer deleting legacy code over adapting it.

## Guiding Principles
- Treat the existing `packages/builder/src/ast/analyze-module-swc.ts` file as disposable. Split or remove it entirely.
- Emit typed IR events (`@soda-gql/ir`) instead of patching TypeScript source or string templates.
- Collapse TypeScript/SWC divergence. If an implementation only makes sense once, use the best tool and delete the rest.
- Rename modules, exports, and directories freely to match the new architecture.

## Execution Blueprint

### 1. Clean Slate Setup
1. Create `packages/analyzer-swc/` with an explicit entry point (`index.ts`) that wires parser configuration and exports `analyzeModule`.
2. Move only the minimal reusable utilities into `packages/analyzer-swc/internal/`. If a helper does not survive the IR design, delete it.
3. Remove the legacy analyzer exports from `packages/builder/src/ast/`. Consumers will be updated alongside this rewrite.

### 2. Build Feature-focused Passes
1. Implement independent passes for imports, exports, GraphQL tag discovery, and document assembly. Each pass should return a `Result<PartialIr, Diagnostic>`.
2. Compose passes in `analyzeModule` using functional pipelines. Short-circuit on the first diagnostic without throwing.
3. Persist traversal context in plain objects; avoid classes and mutable singletons.

### 3. Emit IR Instead of Code
1. Express analyzer output as `AnalyzerIr` (defined in `@soda-gql/ir/schema.ts`).
2. Push file system interactions into the artifact store; the analyzer should not touch `Bun.write` or random temp files.
3. Validate IR with Zod before returning to ensure downstream consumers receive verified data.

### 4. Delete TypeScript-only Path
1. If the SWC pass covers required behaviours, remove `packages/builder/src/ast/analyze-module.ts` outright.
2. Update any imports to use the new SWC analyzer. Do not maintain alias layers or deprecated entry points.

### 5. Wire Tests to the New World
1. Author focused unit tests under `tests/unit/analyzer-swc/` for each pass (`collectImports`, `collectExports`, etc.).
2. Replace integration fixtures with IR snapshots: `tests/contract/analyzer-ir/*.snap`.
3. Remove tests that assert on the old intermediate `.ts` files; they are no longer relevant.

## Validation Commands
```bash
bun test tests/unit/analyzer-swc --reporter spec
bun test tests/contract/analyzer-ir --update-snapshots
bun run typecheck
```

## Rollback Policy
If the rewrite stalls, it is acceptable to keep the new analyzer and remove obsolete callers. Do **not** reintroduce legacy files; instead, iterate on the new package until it is stable.
