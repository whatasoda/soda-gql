# Request to Codex: Phase 5 Implementation Plan

## Context
- Phases 1-4 complete:
  - `generateArtifact` and `createBuilderService` APIs available
  - Plugin options support discriminated union
  - Plugin pre() is async and supports both artifact-file and builder modes
- Existing tests in `tests/contract/plugin-babel/plugin_babel.test.ts` only cover artifact-file mode

## Task
Please provide an implementation plan for Phase 5: Add integration and contract tests

## Requirements
1. Add tests for builder mode that verify:
   - Happy path: Plugin with builder config successfully generates artifacts and transforms code
   - Error handling: Builder errors are properly mapped to plugin error codes
   - Backward compatibility: Existing artifact-file mode still works (regression test)
2. Tests should be in `tests/contract/plugin-babel/plugin_babel.test.ts` or similar
3. Verify canonical IDs match between builder-generated and pre-built artifacts
4. Keep existing tests unchanged

## Current Test Structure
- Uses `transformAsync` with Babel
- Has helper function `transformWithPlugin`
- Uses fixtures from `tests/fixtures/runtime-app`
- Already has tests for artifact-file mode error cases

## What I Need from You
- What test cases to add for builder mode
- How to structure the builder config in tests
- How to verify the output is correct
- Any setup/teardown needed
- Should we add a separate test file or extend the existing one?

Note: I (Claude) will implement the actual code based on your plan.
