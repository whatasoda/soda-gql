# Diagnostics Platform Guide (Pre-release Reset)

## Intent
We are replacing throw-based error flows with a unified diagnostics platform that feeds the new CLI, analyzer, and plugin pipelines. Because soda-gql is pre-release, plan for **complete API and output changes**.

## Core Tenets
- Every boundary returns `Result<T, Diagnostic>`; exceptions are for catastrophic failures only.
- Diagnostics live in `@soda-gql/diagnostics` and are expressed as JSON-serializable objects validated by Zod.
- CLI output defaults to structured NDJSON; human-readable formatting is an optional skin.
- Delete legacy helpers (`unwrapNullish`, ad-hoc `console.error`) rather than adapting them.

## Step-by-step Plan

### 1. Stand Up Diagnostics Package
1. Create `packages/diagnostics/` with `schema.ts`, `codes.ts`, and `factory.ts`.
2. Export helpers: `createDiagnostic`, `augmentWithLocation`, `formatCliDiagnostic`.
3. Re-export from `packages/tooling-kit` (or equivalent) so other packages import from a single surface.

### 2. Convert Builder and Analyzer
1. Update analyzer passes to return `Result<AnalyzerIr, Diagnostic>`. Remove `throw new Error` sites entirely.
2. Ensure artifacts include `diagnostics.json` per build. Use content hashes for determinism.
3. Rewrite integration tests to snapshot diagnostics instead of string error messages.

### 3. Rebuild Babel Plugin Handling
1. Introduce a `PluginContext` that accumulates diagnostics; stop using exceptions to break out of Babel visitors.
2. Return `Result<PluginArtifact, Diagnostic[]>` from the main transform. The CLI will decide how to react to errors versus warnings.
3. Remove legacy compatibility code (`SODA_GQL_EXPORT_NOT_FOUND` string parsing). Map all failures to structured diagnostics.

### 4. Rewire CLI
1. CLI commands should pipe diagnostics to stdout in NDJSON. Drop flags that emulate the old string-based output.
2. Exit codes:
   - `0` when artifacts are produced and no `severity === "error"` diagnostics remain.
   - `2` when diagnostics contain errors (retain artifacts in temp storage for debugging).
3. Provide `--format pretty` to call `formatCliDiagnostic` for local usability.

### 5. Testing
1. Add contract tests under `tests/contract/diagnostics/` that assert on JSON payloads and severity handling.
2. Update CLI integration tests to expect NDJSON lines.
3. Remove any tests that relied on thrown errors or stack traces.

## Validation Commands
```bash
bun test tests/contract/diagnostics
bun test tests/integration/pipeline --reporter spec
bun run typecheck
```

## Rollback Policy
If a consumer depends on legacy diagnostics, break it now and document the new behavior. Do **not** ship adapters unless Codex explicitly directs otherwise.
