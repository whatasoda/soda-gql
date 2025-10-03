Carry-over Notes (as of 2025-09-24)

1. Intermediate module generation
   - `packages/builder/src/intermediate-module.ts` now rewrites the third argument of every `gql.model` call and the second argument of `select(..., resolver)` inside `gql.querySlice` resolvers to a placeholder arrow/function that returns `{}` with a `/* runtime function */` comment. This guarantees zero-runtime behavior.
   - Ensure the emitted intermediate module is valid JavaScript (no residual TypeScript syntax) so downstream consumers can import it without Bun's TS loader.

2. Analyzer & dependency graph
   - Both TS and SWC analyzers capture initializer expressions reliably; the SWC analyzer falls back to the TS implementation whenever the captured expression does not begin with `gql`.
   - Dependency graph nodes now store `references` maps and canonical dependencies, enabling the intermediate module generator to rewrite references correctly.

3. Test status
   - `bun test` (full suite) passes, including updated integration/contract/unit tests for the intermediate module workflow and placeholder behavior.

4. Outstanding tasks
   - T012: Enhance CLI handling (watch mode support, strengthened validation and logging) for the new runtime pipeline.
   - T013: Refactor human-readable reporters (`writer` / future reporters) to expose metrics and warnings cleanly.
   - Phase 3.4 / 3.5 tasks remain open.
   - New follow-ups:
     * T021: Emit intermediate modules as executable JavaScript (strip TS-only syntax or pre-transpile).
     * T022: Extend CLI UX/documentation around the intermediate-module workflow and placeholder semantics.
